import { prisma } from "@forward/database";
import {
  PLUS_VOICE_ORGANIZE_CAP,
  TRIAL_VOICE_ORGANIZE_CAP,
} from "@forward/shared";
import {
  compProDaysLeft,
  isCompProExpired,
} from "@/lib/comp-access";

export type SubscriptionPlan = "trial" | "plus" | "free";

export type SubscriptionTier = "plus" | "trial" | "free";

export interface UserSubscription {
  plan: SubscriptionPlan;
  status: "active" | "trial" | "expired" | "cancelled" | "paused" | "past_due";
  trialEndsAt: string | null;
  proExpiresAt: string | null;
  isCompAccess: boolean;
  isPremium: boolean;
  trialDaysLeft: number | null;
  compDaysLeft: number | null;
  voiceOrganizeCap: number;
  priceLabel: string;
}

const TRIAL_DAYS = 14;
export const PLAN_NAME = "MotiveLife Pro";
export const PLAN_PRICE_LABEL = "$14.99/mo";
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

export async function getUserSubscription(userId: string): Promise<UserSubscription> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionPlan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      proExpiresAt: true,
      stripeSubscriptionId: true,
    },
  });

  if (!user) return EMPTY_SUB;

  const paidViaStripe = Boolean(user.stripeSubscriptionId);
  const proExpiresIso = user.proExpiresAt?.toISOString() ?? null;
  const compDaysLeft = paidViaStripe ? null : compProDaysLeft(user.proExpiresAt);

  if (user.subscriptionStatus === "paused") {
    return {
      plan: user.subscriptionPlan === "plus" ? "plus" : "trial",
      status: "paused",
      trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
      proExpiresAt: proExpiresIso,
      isCompAccess: user.subscriptionPlan === "plus" && !paidViaStripe,
      isPremium: true,
      trialDaysLeft: null,
      compDaysLeft,
      voiceOrganizeCap:
        user.subscriptionPlan === "plus" ? PLUS_VOICE_ORGANIZE_CAP : TRIAL_VOICE_ORGANIZE_CAP,
      priceLabel: PRICE_LABEL,
    };
  }

  if (
    user.subscriptionPlan === "plus" &&
    user.subscriptionStatus !== "cancelled" &&
    user.subscriptionStatus !== "past_due"
  ) {
    if (isCompProExpired(user.proExpiresAt, paidViaStripe)) {
      return {
        ...EMPTY_SUB,
        status: "expired",
        proExpiresAt: proExpiresIso,
        trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
        compDaysLeft: 0,
      };
    }

    return {
      plan: "plus",
      status: "active",
      trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
      proExpiresAt: proExpiresIso,
      isCompAccess: !paidViaStripe,
      isPremium: true,
      trialDaysLeft: null,
      compDaysLeft,
      voiceOrganizeCap: PLUS_VOICE_ORGANIZE_CAP,
      priceLabel: PRICE_LABEL,
    };
  }

  const trialEnd = user.trialEndsAt;
  if (trialEnd && trialEnd.getTime() > Date.now()) {
    const trialDaysLeft = Math.ceil((trialEnd.getTime() - Date.now()) / 86400000);
    return {
      plan: "trial",
      status: "trial",
      trialEndsAt: trialEnd.toISOString(),
      proExpiresAt: proExpiresIso,
      isCompAccess: false,
      isPremium: true,
      trialDaysLeft,
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

export async function getSubscriptionTier(userId: string): Promise<"plus" | "trial" | "free"> {
  const sub = await getUserSubscription(userId);
  if (sub.plan === "plus" && sub.isPremium) return "plus";
  if (sub.plan === "trial" && sub.isPremium) return "trial";
  return "free";
}
