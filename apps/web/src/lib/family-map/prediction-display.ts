import type { FamilyMapMemberView, FamilyMapState } from "@forward/shared";

/**
 * Display helpers for KINZO PREDICT / ACT — pure functions over map state.
 * No extra API calls; reasons come from fields already on the member view.
 */

export type KinzoPredictionCard = {
  destination: string;
  confidencePct: number;
  etaMinutes: number | null;
  typicalEtaMinutes: number | null;
  /** e.g. "Usually 18–22 min at this time" */
  typicalDriveLabel: string | null;
  /** e.g. "11:38–11:50 PM" */
  arriveWindowLabel: string | null;
  reasons: string[];
  tripKind: string | null;
};

export type KinzoLeaveSoon = {
  memberId: string;
  memberName: string;
  placeName: string;
  leaveInMinutes: number;
  label: string;
};

function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Arrival window from live ETA ± slack based on confidence. */
export function arriveWindowLabel(
  etaMinutes: number | null | undefined,
  confidence: number | null | undefined,
  now = new Date()
): string | null {
  if (etaMinutes == null || !Number.isFinite(etaMinutes) || etaMinutes <= 0) {
    return null;
  }
  const slack =
    confidence != null && confidence >= 0.8
      ? 3
      : confidence != null && confidence >= 0.6
        ? 5
        : 7;
  const lo = new Date(now.getTime() + Math.max(1, etaMinutes - slack) * 60_000);
  const hi = new Date(now.getTime() + (etaMinutes + slack) * 60_000);
  return `${formatClock(lo)}–${formatClock(hi)}`;
}

function guessTripKind(
  member: FamilyMapMemberView,
  destination: string
): string | null {
  const dest = destination.toLowerCase();
  const from = (member.placeName ?? "").toLowerCase();
  const hour = new Date().getHours();
  const weekday = (() => {
    const d = new Date().getDay();
    return d >= 1 && d <= 5;
  })();

  if (/home/.test(dest) && weekday && hour >= 14 && hour <= 21) {
    return "Likely commute home";
  }
  if (
    (/work/.test(dest) || /office/.test(dest)) &&
    weekday &&
    hour >= 5 &&
    hour <= 11
  ) {
    return "Likely work commute";
  }
  if (
    (/school/.test(dest) || /school/.test(from)) &&
    weekday &&
    ((hour >= 6 && hour <= 9) || (hour >= 14 && hour <= 17))
  ) {
    return "Likely school run";
  }
  if (/gym|fitness|goodlife|planet/.test(dest)) {
    return "Likely workout trip";
  }
  return null;
}

/**
 * Build the KINZO PREDICTS card for a driving member from existing fields.
 */
export function buildKinzoPrediction(
  member: FamilyMapMemberView,
  now = new Date()
): KinzoPredictionCard | null {
  if (member.presence !== "driving" && member.presence !== "moving") {
    return null;
  }
  const destination = member.likelyDestination?.trim() || null;
  if (!destination) return null;
  const confidence = member.destinationConfidence;
  if (confidence == null || confidence < 0.36) return null;

  const confidencePct = Math.round(Math.min(0.99, Math.max(0.36, confidence)) * 100);
  const etaMinutes = member.etaMinutes;
  const typicalEtaMinutes =
    typeof member.typicalEtaMinutes === "number" && member.typicalEtaMinutes > 0
      ? Math.round(member.typicalEtaMinutes)
      : null;
  const reasons: string[] = [];

  if (member.predictionWhy) {
    for (const part of member.predictionWhy.split(" · ")) {
      const t = part.trim();
      if (t && !reasons.includes(t)) reasons.push(t);
    }
  }

  if (reasons.length === 0) {
    reasons.push(`${confidencePct}% match to household patterns`);
    if (etaMinutes != null && etaMinutes > 0) {
      reasons.push(`About ${etaMinutes} min away`);
    }
    if (member.headingDeg != null && Number.isFinite(member.headingDeg)) {
      reasons.push(`Current direction toward ${destination}`);
    }
    if (member.placeName) {
      reasons.push(`Left ${member.placeName}`);
    }
  }

  let typicalDriveLabel: string | null = null;
  if (typicalEtaMinutes != null) {
    const lo = Math.max(1, typicalEtaMinutes - 2);
    const hi = typicalEtaMinutes + 2;
    typicalDriveLabel = `Usually ${lo}–${hi} min at this time`;
    if (
      etaMinutes != null &&
      etaMinutes > typicalEtaMinutes + 4 &&
      !reasons.some((r) => /slower|typical/i.test(r))
    ) {
      reasons.unshift(
        `${etaMinutes - typicalEtaMinutes} min slower than your normal trip`
      );
    }
  }

  const tripKind = guessTripKind(member, destination);

  return {
    destination,
    confidencePct,
    etaMinutes: etaMinutes ?? null,
    typicalEtaMinutes,
    typicalDriveLabel,
    arriveWindowLabel: arriveWindowLabel(etaMinutes, confidence, now),
    reasons: reasons.slice(0, 5),
    tripKind,
  };
}

/** “Coming up” leave countdowns from leaveInMinutes on stationary members. */
export function buildLeaveSoonList(
  state: FamilyMapState,
  limit = 3
): KinzoLeaveSoon[] {
  const out: KinzoLeaveSoon[] = [];
  for (const m of state.members) {
    if (m.presence !== "stationary") continue;
    if (m.leaveInMinutes == null || m.leaveInMinutes < 0 || m.leaveInMinutes > 90) {
      continue;
    }
    if (!m.placeName) continue;
    const first = m.displayName.split(" ")[0] || m.displayName;
    out.push({
      memberId: m.id,
      memberName: m.displayName,
      placeName: m.placeName,
      leaveInMinutes: m.leaveInMinutes,
      label:
        m.leaveInMinutes <= 1
          ? `${first} usually leaves ${m.placeName} now`
          : `${first} usually leaves ${m.placeName} in ~${m.leaveInMinutes} min`,
    });
  }
  out.sort((a, b) => a.leaveInMinutes - b.leaveInMinutes);
  return out.slice(0, limit);
}
