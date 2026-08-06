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

type EntitlementCacheEntry = {
  at: number;
  value: FamilyEntitlements;
};

/** Short process cache — map SSE/poll was re-resolving billing every tick. */
const entitlementsCache = new Map<string, EntitlementCacheEntry>();
const ENTITLEMENTS_TTL_MS = 60_000;

export function peekCachedFamilyEntitlements(
  ownerUserId: string,
  viewerUserId: string
): FamilyEntitlements | null {
  const key = `${ownerUserId}:${viewerUserId}`;
  const hit = entitlementsCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ENTITLEMENTS_TTL_MS * 5) {
    // Keep a longer stale read for timeout fallbacks (don't flash free).
    return hit.value;
  }
  return hit.value;
}

export async function resolveFamilyEntitlements(opts: {
  ownerUserId: string;
  viewerUserId: string;
}): Promise<FamilyEntitlements> {
  const viewerIsOwner = opts.ownerUserId === opts.viewerUserId;
  const key = `${opts.ownerUserId}:${opts.viewerUserId}`;
  const cached = entitlementsCache.get(key);
  if (cached && Date.now() - cached.at < ENTITLEMENTS_TTL_MS) {
    return cached.value;
  }

  try {
    const ownerHasFamilyPlan = await ownerHasActiveFamilyPlan(opts.ownerUserId);
    const value =
      typeof familyEntitlementsForOwnerPlan === "function"
        ? familyEntitlementsForOwnerPlan({
            ownerHasFamilyPlan,
            viewerIsOwner,
          })
        : ownerHasFamilyPlan
          ? {
              liveMap: true,
              intelligence: true,
              canUpgrade: false,
              plan: "family" as const,
              upgradeHeadline: "",
              upgradeBody: "",
            }
          : freeFamilyEntitlements(viewerIsOwner);
    entitlementsCache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    // Prefer last known unlock over free — billing blips were flashing the
    // "Ask the household owner" lock on every live map refresh.
    if (cached?.value?.intelligence) return cached.value;
    return freeFamilyEntitlements(viewerIsOwner);
  }
}
