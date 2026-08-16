import type { FamilyDriveImpact, FamilyMapState } from "@forward/shared";
import { buildKinzoPrediction, buildLeaveSoonList } from "./prediction-display";
import { buildRouteFingerprint } from "./route-fingerprint";

/**
 * One attention signal for the map canvas — KINZO decides what deserves focus.
 * Pure + sync over existing map state (no extra API).
 */

export type KinzoAttentionKind =
  | "different"
  | "impact"
  | "prediction"
  | "route"
  | "leave_soon"
  | "everyone_home";

export type KinzoAttention = {
  kind: KinzoAttentionKind;
  /** Short chip label, e.g. "91% HOME" */
  badge: string;
  title: string;
  detail: string | null;
  memberId: string | null;
  tone: "violet" | "sky" | "amber" | "emerald";
};

/** Pick at most one thing worth knowing right now. */
export function pickKinzoAttention(
  state: FamilyMapState,
  driveImpact?: FamilyDriveImpact | null
): KinzoAttention | null {
  const impact = driveImpact ?? state.areaIntel?.driveImpact ?? null;

  if (state.somethingDifferent) {
    const d = state.somethingDifferent;
    return {
      kind: "different",
      badge: "DIFFERENT",
      title: d.title,
      detail: d.body,
      memberId: d.memberId,
      tone: "violet",
    };
  }

  if (impact && impact.etaDeltaMin > 0) {
    return {
      kind: "impact",
      badge: `+${Math.round(impact.etaDeltaMin)} MIN`,
      title: impact.headline,
      detail: impact.summary || null,
      memberId: impact.primaryMemberId ?? null,
      tone: "amber",
    };
  }

  for (const m of state.members) {
    if (m.presence !== "driving" && m.presence !== "moving") continue;
    const fp = buildRouteFingerprint(m, state.recentTrips ?? []);
    if (fp?.unusual) {
      return {
        kind: "route",
        badge: fp.badge,
        title: `${m.displayName.split(" ")[0]} · ${fp.title}`,
        detail: fp.detail,
        memberId: m.id,
        tone: "amber",
      };
    }
  }

  for (const m of state.members) {
    if (m.presence !== "driving" && m.presence !== "moving") continue;
    const card = buildKinzoPrediction(m);
    if (!card) continue;
    const destShort =
      card.destination.length > 12
        ? `${card.destination.slice(0, 11)}…`
        : card.destination;
    return {
      kind: "prediction",
      badge: `${card.confidencePct}% ${destShort.toUpperCase()}`,
      title: `Likely heading ${card.destination}`,
      detail: card.arriveWindowLabel
        ? `Expected ${card.arriveWindowLabel}`
        : card.typicalDriveLabel,
      memberId: m.id,
      tone: "violet",
    };
  }

  const leave = buildLeaveSoonList(state, 1)[0];
  if (leave && leave.leaveInMinutes <= 25) {
    return {
      kind: "leave_soon",
      badge: `~${Math.max(1, leave.leaveInMinutes)} MIN`,
      title: leave.label,
      detail: `From ${leave.placeName}`,
      memberId: leave.memberId,
      tone: "sky",
    };
  }

  const homeLabel = state.flow.everyoneHomeByLabel;
  if (homeLabel) {
    const short = homeLabel
      .replace(/^Everyone (is )?home (by |around )?/i, "")
      .trim();
    return {
      kind: "everyone_home",
      badge: short && short.length <= 12 ? short.toUpperCase() : "HOME ETA",
      title: homeLabel,
      detail: null,
      memberId: null,
      tone: "emerald",
    };
  }

  return null;
}
