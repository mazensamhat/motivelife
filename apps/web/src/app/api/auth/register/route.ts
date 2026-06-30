import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@forward/database";
import { badRequest, json, serverError } from "@/lib/api";
import { linkAccountabilityFromInvite } from "@/lib/accountability-link";
import { defaultTrialEndsAt } from "@/lib/subscription";
import { LEGAL_VERSION } from "@/lib/legal";
import { parseAcquisitionChannel, resolveSignupGeo } from "@/lib/geo/signup-geo";
import {
  buildSignupGeoFromForm,
  type SignupCountryCode,
} from "@/lib/geo/signup-locations";
import { normalizePhoneNumber, maskPhoneNumber } from "@/lib/phone";
import { issuePhoneVerification } from "@/lib/phone-verification";
import { sendVerificationCodeSms } from "@/lib/sms";

const requiredConsent = z.literal(true, {
  errorMap: () => ({ message: "Required consent missing" }),
});

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  birthYear: z.number().int().min(1940).max(new Date().getFullYear() - 13).optional(),
  partnerInviteCode: z.string().min(6).max(20).optional(),
  acceptTerms: requiredConsent,
  acceptPrivacy: requiredConsent,
  acceptAge: requiredConsent,
  acceptAiProcessing: requiredConsent,
  acceptSubscriptionTerms: requiredConsent,
  marketingEmailConsent: z.boolean().optional().default(false),
  acquisitionChannel: z.string().max(64).optional(),
  signupCountry: z.enum(["CA", "US", "GB", "AU", "OTHER"]),
  otherCountry: z.string().max(64).optional().default(""),
  signupRegion: z.string().min(1).max(128),
  signupCity: z.string().min(1).max(128),
  phone: z.string().min(7).max(24),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return badRequest(
        "Registration requires location, phone number, and acceptance of all required agreements."
      );
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

    if (signupCountry === "OTHER" && !otherCountry.trim()) {
      return badRequest("Enter your country name.");
    }

    const phoneNumber = normalizePhoneNumber(signupCountry, phone);
    if (!phoneNumber) {
      return badRequest("Enter a valid phone number (include area code).");
    }

    const ipGeo = await resolveSignupGeo(request);
    const geo = buildSignupGeoFromForm({
      country: signupCountry as SignupCountryCode,
      otherCountry: otherCountry ?? "",
      region: signupRegion,
      city: signupCity,
      ipLatitude: ipGeo.latitude,
      ipLongitude: ipGeo.longitude,
      ipContinent: ipGeo.continent,
    });

    const acquisitionChannel =
      parsed.data.acquisitionChannel ?? parseAcquisitionChannel(request) ?? "direct";

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return badRequest("Email already registered");

    const existingPhone = await prisma.user.findUnique({ where: { phoneNumber } });
    if (existingPhone) return badRequest("Phone number already registered");

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
        lastSeenAt: now,
      },
      select: { id: true, email: true, name: true },
    });

    if (partnerInviteCode) {
      await linkAccountabilityFromInvite(user.id, name, partnerInviteCode);
    }

    const { challengeId, code } = await issuePhoneVerification({
      userId: user.id,
      phoneNumber,
      purpose: "signup",
    });

    const sms = await sendVerificationCodeSms(phoneNumber, code, "signup");
    if (!sms.ok && process.env.NODE_ENV === "production") {
      console.error("[auth/register] SMS failed:", sms.error);
      return serverError("Could not send verification code. Try again in a moment.");
    }

    const masked = maskPhoneNumber(phoneNumber);
    const redirectTo = `/verify-phone?challenge=${encodeURIComponent(challengeId)}&purpose=signup&masked=${encodeURIComponent(masked)}`;

    return json({ requiresPhoneVerification: true, redirectTo, maskedPhone: masked });
  } catch (error) {
    console.error("[auth/register]", error);
    return serverError("Could not create account. Check that the database is set up.");
  }
}
