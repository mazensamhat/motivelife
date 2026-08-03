import bcrypt from "bcryptjs";
import { prisma } from "@forward/database";
import { adminRedirectPath } from "@/lib/admin";
import { grantReferralReward, linkLifeCircleFromInvite } from "@/lib/life-circle-server";
import { LEGAL_VERSION } from "@/lib/legal";
import { resolveSignupGeo } from "@/lib/geo/signup-geo";
import { defaultTrialEndsAt } from "@/lib/subscription";
import { createSession } from "@/lib/session";
import type { AuthOAuthStatePayload } from "@/lib/auth/oauth-state";
import { postAuthRedirect } from "@/lib/auth/oauth-state";
import { ensureAuthOAuthSchema } from "@/lib/auth/ensure-oauth-schema";

export type OAuthIdentity = {
  provider: "google" | "apple";
  subject: string;
  email: string;
  emailVerified?: boolean;
  name?: string | null;
};

/** Random unusable hash — OAuth accounts sign in via provider, not password. */
async function oauthPasswordPlaceholder() {
  return bcrypt.hash(`oauth:${crypto.randomUUID()}:${Date.now()}`, 12);
}

export async function findOrCreateOAuthUser(
  identity: OAuthIdentity,
  state: AuthOAuthStatePayload,
  request: Request,
): Promise<{ redirectTo: string }> {
  await ensureAuthOAuthSchema();

  const email = identity.email.trim().toLowerCase();
  if (!email) {
    throw new Error("oauth_email_required");
  }

  const subField = identity.provider === "google" ? "googleSub" : "appleSub";

  let user = await prisma.user.findFirst({
    where: { [subField]: identity.subject },
    select: { id: true, email: true, name: true, disabledAt: true },
  });

  if (!user) {
    const byEmail = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        disabledAt: true,
        googleSub: true,
        appleSub: true,
      },
    });

    if (byEmail) {
      if (byEmail.disabledAt) throw new Error("account_disabled");
      const existingSub =
        identity.provider === "google" ? byEmail.googleSub : byEmail.appleSub;
      if (existingSub && existingSub !== identity.subject) {
        throw new Error("oauth_conflict");
      }
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: {
          ...(identity.provider === "google"
            ? { googleSub: identity.subject }
            : { appleSub: identity.subject }),
          ...(byEmail.name || !identity.name ? {} : { name: identity.name }),
          lastSeenAt: new Date(),
        },
        select: { id: true, email: true, name: true, disabledAt: true },
      });
    }
  }

  if (user?.disabledAt) throw new Error("account_disabled");

  if (!user) {
    if (state.mode === "login") {
      // First-time social sign-in creates the account (common consumer UX).
    }
    if (state.mode === "register" && !state.legalAccepted) {
      throw new Error("legal_required");
    }

    const now = new Date();
    const geo = await resolveSignupGeo(request);
    const passwordHash = await oauthPasswordPlaceholder();
    const acquisitionChannel =
      state.acquisitionChannel ??
      (state.plan === "family" ? "mymotivelife_family_oauth" : `${identity.provider}_oauth`);

    user = await prisma.user.create({
      data: {
        email,
        name: identity.name?.trim() || null,
        passwordHash,
        ...(identity.provider === "google"
          ? { googleSub: identity.subject }
          : { appleSub: identity.subject }),
        trialEndsAt: defaultTrialEndsAt(),
        subscriptionPlan: "trial",
        subscriptionStatus: "active",
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        legalConsentVersion: LEGAL_VERSION,
        marketingEmailConsent: state.marketingEmailConsent ?? false,
        marketingEmailConsentAt: state.marketingEmailConsent ? now : null,
        signupCountry: geo.country,
        signupRegion: geo.region,
        signupCity: geo.city,
        signupContinent: geo.continent,
        signupLatitude: geo.latitude,
        signupLongitude: geo.longitude,
        acquisitionChannel,
        lastSeenAt: now,
      },
      select: { id: true, email: true, name: true, disabledAt: true },
    });

    if (state.partnerInviteCode) {
      await linkLifeCircleFromInvite(
        user.id,
        identity.name ?? undefined,
        state.partnerInviteCode,
        state.circleTag,
      );
      await grantReferralReward(state.partnerInviteCode, user.id);
    } else if (state.referralCode) {
      await linkLifeCircleFromInvite(
        user.id,
        identity.name ?? undefined,
        state.referralCode,
        state.circleTag,
      );
      await grantReferralReward(state.referralCode, user.id);
    }
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });
  }

  await createSession({ id: user.id, email: user.email, name: user.name });
  return {
    redirectTo: postAuthRedirect(
      state.plan,
      adminRedirectPath(user.email),
      state.familyInviteCode
    ),
  };
}
