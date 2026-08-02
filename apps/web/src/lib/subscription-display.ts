/**
 * Client-safe subscription labels + types.
 * Do NOT import @/lib/subscription from client components — that file pulls Prisma/fs.
 */

export type SubscriptionPlan = "trial" | "plus" | "free";

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

export const PLAN_NAME = "MyMotiveLife Pro";
export const PLAN_PRICE_LABEL = "$14.99/mo";
export const FAMILY_PLAN_NAME = "MyMotiveFamily";
export const FAMILY_PLAN_PRICE_LABEL = "$19.99/mo";
