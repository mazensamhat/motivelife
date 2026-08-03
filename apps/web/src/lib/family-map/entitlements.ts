/**
 * Family Map freemium — free = live map + speed; Family plan unlocks intelligence.
 * Entitlement is household-scoped (owner’s MyMotiveFamily plan covers members).
 */

import type { FamilyEntitlements } from "@forward/shared";
import { familyEntitlementsForOwnerPlan } from "@forward/shared";
import { getUserSubscription } from "@/lib/subscription";

export function canUseFamilyIntelligence(entitlements: Pick<FamilyEntitlements, "intelligence">) {
  return entitlements.intelligence === true;
}

/** Owner has an active MyMotiveFamily SKU (not Life Pro alone). */
export async function ownerHasActiveFamilyPlan(ownerUserId: string): Promise<boolean> {
  const sub = await getUserSubscription(ownerUserId);
  return sub.plan === "family" && sub.isPremium && sub.status !== "cancelled";
}

export async function resolveFamilyEntitlements(opts: {
  ownerUserId: string;
  viewerUserId: string;
}): Promise<FamilyEntitlements> {
  const ownerHasFamilyPlan = await ownerHasActiveFamilyPlan(opts.ownerUserId);
  return familyEntitlementsForOwnerPlan({
    ownerHasFamilyPlan,
    viewerIsOwner: opts.ownerUserId === opts.viewerUserId,
  });
}
