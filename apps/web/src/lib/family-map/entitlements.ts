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

/**
 * Invited members get the $9.99 Family Pro Upgrade only while they belong to a
 * household whose owner is on active MyMotiveFamily. Stops “join then leave /
 * never use Family” arbitrage for the household discount.
 */
export async function memberEligibleForFamilyProUpgrade(opts: {
  role: "OWNER" | "MEMBER" | string;
  householdOwnerUserId: string | null | undefined;
  viewerIsPremium: boolean;
}): Promise<boolean> {
  if (opts.viewerIsPremium) return false;
  if (opts.role !== "MEMBER") return false;
  if (!opts.householdOwnerUserId) return false;
  return ownerHasActiveFamilyPlan(opts.householdOwnerUserId);
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
