import { prisma } from "@forward/database";

/** True when the user pays via Stripe or Apple IAP (not admin comp). */
export function isPaidStoreSubscription(user: {
  stripeSubscriptionId?: string | null;
  appleOriginalTransactionId?: string | null;
}): boolean {
  return Boolean(user.stripeSubscriptionId || user.appleOriginalTransactionId);
}

export async function activateApplePro(params: {
  userId: string;
  originalTransactionId: string;
  productId?: string | null;
  revenueCatAppUserId?: string | null;
}) {
  await prisma.user.update({
    where: { id: params.userId },
    data: {
      subscriptionPlan: "plus",
      subscriptionStatus: "active",
      appleOriginalTransactionId: params.originalTransactionId,
      appleProductId: params.productId ?? null,
      revenueCatAppUserId: params.revenueCatAppUserId ?? params.userId,
      // Clear Stripe ids so we don't treat this as Stripe-managed billing.
      stripeSubscriptionId: null,
      proExpiresAt: null,
    },
  });
}

export async function deactivateApplePro(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionPlan: "trial",
      subscriptionStatus: "cancelled",
      appleOriginalTransactionId: null,
      appleProductId: null,
    },
  });
}

export async function findUserIdByAppleTransaction(
  originalTransactionId: string
): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { appleOriginalTransactionId: originalTransactionId },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function findUserIdByRevenueCatAppUserId(
  appUserId: string
): Promise<string | null> {
  const byRc = await prisma.user.findFirst({
    where: { revenueCatAppUserId: appUserId },
    select: { id: true },
  });
  if (byRc) return byRc.id;

  // App user id is often our MotiveLife user id.
  const byId = await prisma.user.findUnique({
    where: { id: appUserId },
    select: { id: true },
  });
  return byId?.id ?? null;
}
