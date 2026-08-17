import {
  FAMILY_BASE_MEMBERS,
  FAMILY_EXTRA_SEATS_PACK_PRICE_LABEL,
  FAMILY_EXTRA_SEATS_PACK_SIZE,
  FAMILY_MAX_EXTRA_SEAT_PACKS,
  countLinkedHouseholdMembers,
  householdSeatLimit,
} from "@forward/shared";
import { prisma } from "@forward/database";
import type Stripe from "stripe";
import { hasCompFamilyAccess } from "@/lib/admin";
import {
  getStripe,
  isStripeFamilyExtraSeatsConfigured,
  resolveStripeFamilyExtraSeatsPriceId,
} from "@/lib/stripe";
import { getUserSubscription } from "@/lib/subscription";

export type FamilySeatInfo = {
  linkedCount: number;
  seatLimit: number;
  baseMembers: number;
  extraSeatPacks: number;
  maxExtraSeatPacks: number;
  packSize: number;
  packPriceLabel: string;
  canAddPack: boolean;
  isOwner: boolean;
  hasFamilyPlan: boolean;
  extraSeatsConfigured: boolean;
};

export function extraSeatPacksFromStripeSubscription(
  sub: Stripe.Subscription,
  extraSeatsPriceId: string | null
): number {
  if (!extraSeatsPriceId) return 0;
  let packs = 0;
  for (const item of sub.items?.data ?? []) {
    const price = item.price;
    const priceId = typeof price === "string" ? price : price?.id;
    if (priceId === extraSeatsPriceId) {
      packs = item.quantity ?? 0;
      break;
    }
  }
  return Math.max(0, Math.min(FAMILY_MAX_EXTRA_SEAT_PACKS, packs));
}

export async function syncHouseholdExtraSeatPacks(
  ownerUserId: string,
  packs: number
): Promise<void> {
  const clamped = Math.max(0, Math.min(FAMILY_MAX_EXTRA_SEAT_PACKS, Math.floor(packs)));
  await prisma.familyHousehold.updateMany({
    where: { ownerUserId },
    data: { extraSeatPacks: clamped },
  });
}

export async function syncHouseholdExtraSeatPacksFromStripe(
  ownerUserId: string,
  sub: Stripe.Subscription
): Promise<number> {
  const stripe = getStripe();
  const extraPriceId = stripe ? await resolveStripeFamilyExtraSeatsPriceId(stripe) : null;
  const packs = extraSeatPacksFromStripeSubscription(sub, extraPriceId);
  await syncHouseholdExtraSeatPacks(ownerUserId, packs);
  return packs;
}

export async function getFamilySeatInfoForUser(userId: string): Promise<FamilySeatInfo | null> {
  const household = await prisma.familyHousehold.findFirst({
    where: {
      OR: [{ ownerUserId: userId }, { members: { some: { userId } } }],
    },
    include: { members: true },
  });
  if (!household) return null;

  const isOwner = household.ownerUserId === userId;
  const linkedCount = countLinkedHouseholdMembers(household.members);
  const extraSeatPacks = household.extraSeatPacks ?? 0;
  const seatLimit = householdSeatLimit(extraSeatPacks);

  let hasFamilyPlan = false;
  if (isOwner) {
    const owner = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (owner?.email && hasCompFamilyAccess(owner.email)) {
      hasFamilyPlan = true;
    } else {
      const sub = await getUserSubscription(userId);
      hasFamilyPlan = sub.plan === "family" && sub.isPremium;
    }
  }

  const canAddPack =
    isOwner &&
    hasFamilyPlan &&
    extraSeatPacks < FAMILY_MAX_EXTRA_SEAT_PACKS;

  return {
    linkedCount,
    seatLimit,
    baseMembers: FAMILY_BASE_MEMBERS,
    extraSeatPacks,
    maxExtraSeatPacks: FAMILY_MAX_EXTRA_SEAT_PACKS,
    packSize: FAMILY_EXTRA_SEATS_PACK_SIZE,
    packPriceLabel: FAMILY_EXTRA_SEATS_PACK_PRICE_LABEL,
    canAddPack,
    isOwner,
    hasFamilyPlan,
    extraSeatsConfigured: isStripeFamilyExtraSeatsConfigured(),
  };
}

export async function addFamilyExtraSeatPack(ownerUserId: string): Promise<{
  extraSeatPacks: number;
  seatLimit: number;
}> {
  const household = await prisma.familyHousehold.findUnique({
    where: { ownerUserId },
    include: { members: true },
  });
  if (!household) throw new Error("NO_HOUSEHOLD");

  const current = household.extraSeatPacks ?? 0;
  if (current >= FAMILY_MAX_EXTRA_SEAT_PACKS) throw new Error("SEAT_PACKS_MAX");

  const owner = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { email: true, stripeSubscriptionId: true },
  });
  if (!owner) throw new Error("NO_OWNER");

  const sub = await getUserSubscription(ownerUserId);
  const comp = owner.email ? hasCompFamilyAccess(owner.email) : false;
  if (!comp && (sub.plan !== "family" || !sub.isPremium)) {
    throw new Error("FAMILY_PLAN_REQUIRED");
  }

  if (comp) {
    const next = current + 1;
    await syncHouseholdExtraSeatPacks(ownerUserId, next);
    return { extraSeatPacks: next, seatLimit: householdSeatLimit(next) };
  }

  const stripe = getStripe();
  if (!stripe || !owner.stripeSubscriptionId) throw new Error("STRIPE_SUB_REQUIRED");

  const extraPriceId = await resolveStripeFamilyExtraSeatsPriceId(stripe);
  if (!extraPriceId) throw new Error("EXTRA_SEATS_PRICE_MISSING");

  const subscription = await stripe.subscriptions.retrieve(owner.stripeSubscriptionId, {
    expand: ["items.data.price"],
  });

  const existing = subscription.items.data.find(
    (item) => item.price.id === extraPriceId
  );

  if (existing) {
    await stripe.subscriptionItems.update(existing.id, {
      quantity: (existing.quantity ?? 0) + 1,
      proration_behavior: "create_prorations",
    });
  } else {
    await stripe.subscriptionItems.create({
      subscription: owner.stripeSubscriptionId,
      price: extraPriceId,
      quantity: 1,
      proration_behavior: "create_prorations",
    });
  }

  const next = current + 1;
  await syncHouseholdExtraSeatPacks(ownerUserId, next);
  return { extraSeatPacks: next, seatLimit: householdSeatLimit(next) };
}
