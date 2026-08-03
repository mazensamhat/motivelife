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

/** Safe free-tier defaults — never depends on shared helpers that might be stale in builds. */
export function freeFamilyEntitlements(viewerIsOwner: boolean): FamilyEntitlements {
  return {
    liveMap: true,
    intelligence: false,
    canUpgrade: viewerIsOwner,
    plan: "free",
    upgradeHeadline: "Unlock Family Intelligence",
    upgradeBody: viewerIsOwner
      ? "Upgrade to MyMotiveFamily for drive history, Weekly Driving Report, Inbox alerts, and AI insights. Free keeps live location + speed only."
      : "Ask the household owner to upgrade to MyMotiveFamily. Free keeps live location + speed only.",
  };
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
  const viewerIsOwner = opts.ownerUserId === opts.viewerUserId;
  try {
    const ownerHasFamilyPlan = await ownerHasActiveFamilyPlan(opts.ownerUserId);
    if (typeof familyEntitlementsForOwnerPlan === "function") {
      return familyEntitlementsForOwnerPlan({
        ownerHasFamilyPlan,
        viewerIsOwner,
      });
    }
    return ownerHasFamilyPlan
      ? {
          liveMap: true,
          intelligence: true,
          canUpgrade: false,
          plan: "family",
          upgradeHeadline: "",
          upgradeBody: "",
        }
      : freeFamilyEntitlements(viewerIsOwner);
  } catch {
    return freeFamilyEntitlements(viewerIsOwner);
  }
}
