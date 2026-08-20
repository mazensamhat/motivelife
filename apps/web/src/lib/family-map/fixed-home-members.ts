/**
 * Until MyMotiveFamily public map launch, some household members stay pinned
 * at Home and never get location prompts (e.g. kids testing the household).
 */
import { FAMILY_PUBLIC_SIGNUP_OPEN } from "@/lib/family-marketing";

/** Display names (case-insensitive) held at Home until public map launch. */
export const FAMILY_FIXED_HOME_MEMBER_NAMES = ["Mahdi"] as const;

export function familyLiveMapTrackingOpen(): boolean {
  return FAMILY_PUBLIC_SIGNUP_OPEN;
}

export function isFixedHomeMember(
  displayName: string | null | undefined
): boolean {
  if (familyLiveMapTrackingOpen()) return false;
  const n = (displayName ?? "").trim().toLowerCase();
  if (!n) return false;
  return FAMILY_FIXED_HOME_MEMBER_NAMES.some((name) => {
    const target = name.toLowerCase();
    return n === target || n.startsWith(`${target} `);
  });
}

export const FAMILY_FIXED_HOME_HINT =
  "You're shown at Home for now — live location stays off until the KINZO map is fully enabled for your account.";
