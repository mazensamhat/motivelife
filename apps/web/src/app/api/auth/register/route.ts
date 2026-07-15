import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@forward/database";
import { createSession } from "@/lib/session";
import { badRequest, json, serverError } from "@/lib/api";
import { adminRedirectPath } from "@/lib/admin";
import { grantReferralReward, linkLifeCircleFromInvite } from "@/lib/life-circle-server";
import { defaultTrialEndsAt } from "@/lib/subscription";
import { LEGAL_VERSION } from "@/lib/legal";
import { parseAcquisitionChannel, resolveSignupGeo } from "@/lib/geo/signup-geo";
import {
  buildSignupGeoFromForm,
  type SignupCountryCode,
} from "@/lib/geo/signup-locations";
import { normalizePhoneNumber } from "@/lib/phone";
import { ML_ACQ_POST_COOKIE } from "@/lib/marketing-attribution";

const requiredConsent = z.literal(true, {
  errorMap: () => ({ message: "Required consent missing" }),
});

function cookieValue(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("=") || "");
  }
  return null;
}

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  birthYear: z.number().int().min(1940).max(new Date().getFullYear() - 13).optional(),
  partnerInviteCode: z.string().min(6).max(20).optional(),
  referralCode: z.string().min(6).max(20).optional(),
  circleTag: z.string().max(16).optional(),
  acceptTerms: requiredConsent,
  acceptPrivacy: requiredConsent,
  acceptAge: requiredConsent,
  acceptAiProcessing: requiredConsent,
  acceptSubscriptionTerms: requiredConsent,
  marketingEmailConsent: z.boolean().optional().default(false),
  acquisitionChannel: z.string().max(64).optional(),
  // Optional profile fields — not required for core account creation (App Store 5.1.1).
  signupCountry: z.enum(["CA", "US", "GB", "AU", "OTHER"]).optional(),
  otherCountry: z.string().max(64).optional().default(""),
  signupRegion: z.string().max(128).optional().default(""),
  signupCity: z.string().max(128).optional().default(""),
  phone: z.string().max(24).optional().default(""),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Registration requires a valid email, password, and acceptance of all required agreements.");
    }

    const {
      email,
      password,
      name,
      birthYear,
      partnerInviteCode,
      marketingEmailConsent,
      signupCountry,
      otherCountry,
      signupRegion,
      signupCity,
      phone,
    } = parsed.data;

    if (signupCountry === "OTHER" && !(otherCountry ?? "").trim()) {
      return badRequest("Enter your country name.");
    }

    const phoneRaw = (phone ?? "").trim();
    let phoneNumber: string | null = null;
    if (phoneRaw) {
      phoneNumber = normalizePhoneNumber(signupCountry ?? "US", phoneRaw);
      if (!phoneNumber) {
        return badRequest("Enter a valid phone number (include area code), or leave it blank.");
      }
    }

    const ipGeo = await resolveSignupGeo(request);
    const geo = signupCountry
      ? buildSignupGeoFromForm({
          country: signupCountry as SignupCountryCode,
          otherCountry: otherCountry ?? "",
          region: signupRegion ?? "",
          city: signupCity ?? "",
          ipLatitude: ipGeo.latitude,
          ipLongitude: ipGeo.longitude,
          ipContinent: ipGeo.continent,
        })
      : {
          signupCountry: ipGeo.country,
          signupRegion: ipGeo.region,
          signupCity: ipGeo.city,
          signupContinent: ipGeo.continent,
          signupLatitude: ipGeo.latitude,
          signupLongitude: ipGeo.longitude,
        };

    const acquisitionChannel =
      parsed.data.acquisitionChannel ?? parseAcquisitionChannel(request) ?? "direct";
    const acquisitionPostId = cookieValue(request, ML_ACQ_POST_COOKIE)?.slice(0, 64) || null;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return badRequest("Email already registered");

    if (phoneNumber) {
      const existingPhone = await prisma.user.findUnique({ where: { phoneNumber } });
      if (existingPhone) return badRequest("Phone number already registered");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        birthYear,
        phoneNumber,
        trialEndsAt: defaultTrialEndsAt(),
        subscriptionPlan: "trial",
        subscriptionStatus: "active",
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        legalConsentVersion: LEGAL_VERSION,
        marketingEmailConsent: marketingEmailConsent ?? false,
        marketingEmailConsentAt: marketingEmailConsent ? now : null,
        ...geo,
        acquisitionChannel,
        acquisitionPostId,
        lastSeenAt: now,
      },
      select: { id: true, email: true, name: true },
    });

    if (partnerInviteCode) {
      await linkLifeCircleFromInvite(user.id, name, partnerInviteCode, parsed.data.circleTag);
      await grantReferralReward(partnerInviteCode, user.id);
    } else if (parsed.data.referralCode) {
      await linkLifeCircleFromInvite(user.id, name, parsed.data.referralCode, parsed.data.circleTag);
      await grantReferralReward(parsed.data.referralCode, user.id);
    }

    await createSession(user);
    return json({
      user,
      redirectTo: adminRedirectPath(user.email),
    });
  } catch (error) {
    console.error("[auth/register]", error);
    return serverError("Could not create account. Check that the database is set up.");
  }
}
