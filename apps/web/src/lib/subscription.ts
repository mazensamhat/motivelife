import { prisma } from "@forward/database";
import {
  PLUS_VOICE_ORGANIZE_CAP,
  TRIAL_VOICE_ORGANIZE_CAP,
} from "@forward/shared";
import {
  compProDaysLeft,
  isCompProExpired,
} from "@/lib/comp-access";
import { hasCompFamilyAccess } from "@/lib/admin";
import { isPaidStoreSubscription } from "@/lib/apple-iap";
import {
  FAMILY_PLAN_PRICE_LABEL,
  PLAN_NAME,
  PLAN_PRICE_LABEL,
  isPaidPremiumPlan,
  type UserSubscription,
} from "@/lib/subscription-display";

export type { SubscriptionPlan, UserSubscription } from "@/lib/subscription-display";
export {
  FAMILY_PLAN_NAME,
  FAMILY_PLAN_PRICE_LABEL,
  PLAN_NAME,
  PLAN_PRICE_LABEL,
} from "@/lib/subscription-display";

export type SubscriptionTier = "plus" | "family" | "trial" | "free";

const TRIAL_DAYS = 14;
const PRICE_LABEL = PLAN_PRICE_LABEL;

const EMPTY_SUB: UserSubscription = {
  plan: "free",
  status: "expired",
  trialEndsAt: null,
  proExpiresAt: null,
  isCompAccess: false,
  isPremium: false,
  trialDaysLeft: null,
  compDaysLeft: null,
  voiceOrganizeCap: 0,
  priceLabel: PRICE_LABEL,
};

export function defaultTrialEndsAt(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d;
}

/**
 * Family invitees do NOT get a Pro trial.
 * They join the household map for free; full Twin / Life OS Pro requires Family Pro
 * Upgrade ($9.99) while on an active MyMotiveFamily household, or standalone Pro ($14.99).
 */
export function isFamilyInviteSignup(opts: {
  familyInviteCode?: string | null;
  signupIntent?: string | null;
}) {
  const code = opts.familyInviteCode?.trim();
  if (code) return true;
  return opts.signupIntent === "family_invite";
}

/** Prisma create fields for invitee accounts — blocked from Pro until they pay. */
export function freeFamilyMemberSignupFields() {
  return {
    trialEndsAt: null as Date | null,
    subscriptionPlan: "free" as const,
    subscriptionStatus: "active" as const,
  };
}

/** Standard new-account Pro trial (not used for family invitees). */
export function trialSignupFields() {
  return {
    trialEndsAt: defaultTrialEndsAt(),
    subscriptionPlan: "trial" as const,
    subscriptionStatus: "active" as const,
  };
}

/** Prisma update fields to (re)start a 14-day Pro trial. */
export function restartTrialFields(from = new Date()) {
  return {
    trialEndsAt: defaultTrialEndsAt(from),
    subscriptionPlan: "trial" as const,
    subscriptionStatus: "active" as const,
    proExpiresAt: null as Date | null,
  };
}

/**
 * True when the row should receive MyMotiveLife Pro trial access right now.
 * Source of truth is trialEndsAt (not the plan string alone).
 */
export function isTrialWindowActive(trialEndsAt: Date | string | null | undefined) {
  if (!trialEndsAt) return false;
  const end = typeof trialEndsAt === "string" ? new Date(trialEndsAt) : trialEndsAt;
  return Number.isFinite(end.getTime()) && end.getTime() > Date.now();
}

export function trialDaysRemaining(trialEndsAt: Date | string | null | undefined): number | null {
  if (!isTrialWindowActive(trialEndsAt)) return null;
  const end = typeof trialEndsAt === "string" ? new Date(trialEndsAt) : trialEndsAt!;
  return Math.max(1, Math.ceil((end.getTime() - Date.now()) / 86400000));
}

export async function getUserSubscription(userId: string): Promise<UserSubscription> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      proExpiresAt: true,
      stripeSubscriptionId: true,
      appleOriginalTransactionId: true,
    },
  });

  if (!user) return EMPTY_SUB;

  const paidViaStore = isPaidStoreSubscription(user);
  const proExpiresIso = user.proExpiresAt?.toISOString() ?? null;
  const compDaysLeft = paidViaStore ? null : compProDaysLeft(user.proExpiresAt);

  // Founder / admin / COMP_FAMILY_EMAILS — never geo-wall or freemium-lock the owner.
  if (hasCompFamilyAccess(user.email)) {
    // Persist Family plan in DB so Admin + Stripe views match runtime access.
    // Skip Stripe-billed accounts — don't overwrite their paid row.
    if (
      user.subscriptionPlan !== "family" &&
      !user.stripeSubscriptionId &&
      !user.appleOriginalTransactionId
    ) {
      void prisma.user
        .update({
          where: { id: userId },
          data: {
            subscriptionPlan: "family",
            subscriptionStatus: "active",
            proExpiresAt: null,
          },
        })
        .catch(() => null);
    }
    return {
      plan: "family",
      status: "active",
      trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
      proExpiresAt: proExpiresIso,
      isCompAccess: true,
      isPremium: true,
      trialDaysLeft: null,
      compDaysLeft: null,
      voiceOrganizeCap: PLUS_VOICE_ORGANIZE_CAP,
      priceLabel: FAMILY_PLAN_PRICE_LABEL,
    };
  }

  if (user.subscriptionStatus === "paused") {
    const pausedPaid = isPaidPremiumPlan(user.subscriptionPlan);
    return {
      plan: user.subscriptionPlan === "family" ? "family" : pausedPaid ? "plus" : "trial",
      status: "paused",
      trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
      proExpiresAt: proExpiresIso,
      isCompAccess: pausedPaid && !paidViaStore,
      isPremium: true,
      trialDaysLeft: null,
      compDaysLeft,
      voiceOrganizeCap: pausedPaid ? PLUS_VOICE_ORGANIZE_CAP : TRIAL_VOICE_ORGANIZE_CAP,
      priceLabel:
        user.subscriptionPlan === "family" ? FAMILY_PLAN_PRICE_LABEL : PRICE_LABEL,
    };
  }

  if (
    isPaidPremiumPlan(user.subscriptionPlan) &&
    user.subscriptionStatus !== "cancelled" &&
    user.subscriptionStatus !== "past_due"
  ) {
    if (isCompProExpired(user.proExpiresAt, paidViaStore)) {
      return {
        ...EMPTY_SUB,
        status: "expired",
        proExpiresAt: proExpiresIso,
        trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
        compDaysLeft: 0,
      };
    }

    const isFamily = user.subscriptionPlan === "family";
    return {
      plan: isFamily ? "family" : "plus",
      status: "active",
      trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
      proExpiresAt: proExpiresIso,
      isCompAccess: !paidViaStore,
      isPremium: true,
      trialDaysLeft: null,
      compDaysLeft,
      voiceOrganizeCap: PLUS_VOICE_ORGANIZE_CAP,
      priceLabel: isFamily ? FAMILY_PLAN_PRICE_LABEL : PRICE_LABEL,
    };
  }

  const trialEnd = user.trialEndsAt;
  if (isTrialWindowActive(trialEnd)) {
    return {
      plan: "trial",
      status: "trial",
      trialEndsAt: trialEnd!.toISOString(),
      proExpiresAt: proExpiresIso,
      isCompAccess: false,
      isPremium: true,
      trialDaysLeft: trialDaysRemaining(trialEnd),
      compDaysLeft: null,
      voiceOrganizeCap: TRIAL_VOICE_ORGANIZE_CAP,
      priceLabel: PRICE_LABEL,
    };
  }

  return {
    plan: "free",
    status: user.subscriptionStatus === "cancelled" ? "cancelled" : "expired",
    trialEndsAt: trialEnd?.toISOString() ?? null,
    proExpiresAt: proExpiresIso,
    isCompAccess: false,
    isPremium: false,
    trialDaysLeft: 0,
    compDaysLeft: null,
    voiceOrganizeCap: 0,
    priceLabel: PRICE_LABEL,
  };
}

export async function isPremiumUser(userId: string) {
  const sub = await getUserSubscription(userId);
  return sub.isPremium;
}

export async function getSubscriptionTier(
  userId: string
): Promise<"plus" | "family" | "trial" | "free"> {
  const sub = await getUserSubscription(userId);
  if (sub.plan === "family" && sub.isPremium) return "family";
  if (sub.plan === "plus" && sub.isPremium) return "plus";
  if (sub.plan === "trial" && sub.isPremium) return "trial";
  return "free";
}
