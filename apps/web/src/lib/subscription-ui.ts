/** Client-safe subscription helpers (no Prisma / server imports). */

export type SubscriptionPlanUi = "trial" | "plus" | "free";

export interface SubscriptionUiState {
  plan: SubscriptionPlanUi;
  status: string;
  isPremium: boolean;
  isCompAccess: boolean;
  trialDaysLeft: number | null;
  priceLabel: string;
}

export function canUpgradeSubscription(sub: SubscriptionUiState): boolean {
  return sub.plan === "trial" || (!sub.isPremium && sub.plan !== "plus");
}

export function canManagePaidBilling(sub: SubscriptionUiState): boolean {
  return sub.plan === "plus" && sub.isPremium && !sub.isCompAccess;
}
