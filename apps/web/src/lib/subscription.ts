import { prisma } from "@forward/database";
import {
  PLUS_VOICE_ORGANIZE_CAP,
  TRIAL_VOICE_ORGANIZE_CAP,
} from "@forward/shared";
import {
  compProDaysLeft,
  isCompProExpired,
} from "@/lib/comp-access";
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

export async function getUserSubscription(userId: string): Promise<UserSubscription> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
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

export async function getSubscriptionTier(
  userId: string
): Promise<"plus" | "family" | "trial" | "free"> {
  const sub = await getUserSubscription(userId);
  if (sub.plan === "family" && sub.isPremium) return "family";
  if (sub.plan === "plus" && sub.isPremium) return "plus";
  if (sub.plan === "trial" && sub.isPremium) return "trial";
  return "free";
}
