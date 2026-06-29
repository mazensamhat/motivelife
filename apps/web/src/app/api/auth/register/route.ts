import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@forward/database";
import { createSession } from "@/lib/session";
import { badRequest, json, serverError } from "@/lib/api";
import { linkAccountabilityFromInvite } from "@/lib/accountability-link";
import { defaultTrialEndsAt } from "@/lib/subscription";
import { LEGAL_VERSION } from "@/lib/legal";
import { parseAcquisitionChannel, resolveSignupGeo } from "@/lib/geo/signup-geo";

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
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return badRequest(
        "Registration requires acceptance of Terms, Privacy Policy, age confirmation, AI processing notice, and subscription terms."
      );
    }

    const {
      email,
      password,
      name,
      birthYear,
      partnerInviteCode,
      marketingEmailConsent,
    } = parsed.data;

    const geo = await resolveSignupGeo(request);
    const acquisitionChannel =
      parsed.data.acquisitionChannel ?? parseAcquisitionChannel(request) ?? "direct";

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return badRequest("Email already registered");

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        birthYear,
        trialEndsAt: defaultTrialEndsAt(),
        subscriptionPlan: "trial",
        subscriptionStatus: "active",
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        legalConsentVersion: LEGAL_VERSION,
        marketingEmailConsent: marketingEmailConsent ?? false,
        marketingEmailConsentAt: marketingEmailConsent ? now : null,
        signupCountry: geo.country,
        signupRegion: geo.region,
        signupCity: geo.city,
        signupContinent: geo.continent,
        signupLatitude: geo.latitude,
        signupLongitude: geo.longitude,
        acquisitionChannel,
        lastSeenAt: now,
      },
      select: { id: true, email: true, name: true },
    });

    if (partnerInviteCode) {
      await linkAccountabilityFromInvite(user.id, name, partnerInviteCode);
    }

    await createSession(user);
    return json({ user });
  } catch (error) {
    console.error("[auth/register]", error);
    return serverError("Could not create account. Check that the database is set up.");
  }
}
