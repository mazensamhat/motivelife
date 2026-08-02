/**
 * Kids / guardian controls — Family Circle only.
 * Children stay under adult care; they cannot silently leave or weaken privacy past a floor.
 */

export type MemberKind = "ADULT" | "TEEN" | "CHILD";

export function asMemberKind(value: string | null | undefined): MemberKind {
  if (value === "TEEN" || value === "CHILD" || value === "ADULT") return value;
  return "ADULT";
}

/** Child accounts cannot turn location fully off or go destination-only without a guardian. */
const CHILD_ALLOWED_LEVELS = new Set([
  "precise",
  "approximate",
  "eta_only",
  "driving_status_only",
]);

export function clampSharingForMemberKind(
  kind: MemberKind,
  level: string
): string {
  if (kind !== "CHILD") return level;
  if (level === "off" || level === "destination_only") return "approximate";
  if (!CHILD_ALLOWED_LEVELS.has(level)) return "approximate";
  return level;
}

/** Only household owners / adults can reclassify someone as CHILD or assign guardians. */
export function canManageMemberKind(opts: {
  actorKind: MemberKind;
  actorIsOwner: boolean;
}): boolean {
  return opts.actorIsOwner || opts.actorKind === "ADULT";
}

/** Child members cannot leave the household on their own. */
export function canLeaveHousehold(kind: MemberKind): boolean {
  return kind !== "CHILD";
}
