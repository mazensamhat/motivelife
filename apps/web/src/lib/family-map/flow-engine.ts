import {
  formatEtaClock,
  type FamilyFlowSummary,
  type FamilyMemberPresence,
  type FamilyMemberPresenceStatus,
} from "@forward/shared";

export type FlowMemberInput = {
  id: string;
  displayName: string;
  presence: FamilyMemberPresenceStatus;
  statusLabel: string;
  placeName: string | null;
  etaMinutes: number | null;
  batteryPercent: number | null;
  likelyDestination: string | null;
  destinationConfidence: number | null;
  isAtHome: boolean;
};

/** No-show / pickup deadlines for Family logistics AI. */
export type FlowDeadline = {
  memberId: string;
  placeName: string;
  byTimeLocal: string; // "17:30"
  enabled?: boolean;
};

export type FlowPlaceHint = {
  name: string;
  category: string;
};

function isMoving(presence: FamilyMemberPresenceStatus) {
  return presence === "driving" || presence === "moving";
}

function headingHome(m: FlowMemberInput) {
  if (isMoving(m.presence) === false) return false;
  if (m.etaMinutes == null) return false;
  if (m.likelyDestination?.toLowerCase() !== "home") return false;
  // Ignore low-confidence home bias from destination prediction.
  return (m.destinationConfidence ?? 0) >= 0.65;
}

function localMinutes(now: Date) {
  return now.getHours() * 60 + now.getMinutes();
}

function parseTimeLocal(byTimeLocal: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(byTimeLocal.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

function namesMatch(a: string, b: string) {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * Family Flow™ + Family logistics AI.
 * Detects pickup / no-show risk from deadlines + live ETAs / destinations.
 */
export function buildFamilyFlow(
  members: FlowMemberInput[],
  opts: {
    now?: Date;
    deadlines?: FlowDeadline[];
    places?: FlowPlaceHint[];
  } = {}
): FamilyFlowSummary {
  const now = opts.now ?? new Date();
  const presenceMembers: FamilyMemberPresence[] = members.map((m) => ({
    memberId: m.id,
    displayName: m.displayName,
    statusLabel: m.statusLabel,
    presence: m.presence,
    placeName: m.placeName,
    etaMinutes: m.etaMinutes,
    batteryPercent: m.batteryPercent,
    likelyDestination: m.likelyDestination,
    destinationConfidence: m.destinationConfidence,
  }));

  const trulyHome = members.filter((m) => m.isAtHome && !isMoving(m.presence));
  const enRouteHome = members.filter((m) => headingHome(m));
  const outAndAbout = members.filter((m) => !m.isAtHome || isMoving(m.presence));

  let everyoneHomeByLabel: string | null = null;

  if (members.length === 0) {
    everyoneHomeByLabel = null;
  } else if (outAndAbout.length === 0) {
    everyoneHomeByLabel = "Everyone is home";
  } else if (trulyHome.length + enRouteHome.length === members.length && enRouteHome.length > 0) {
    const maxEta = Math.max(...enRouteHome.map((m) => m.etaMinutes ?? 0));
    everyoneHomeByLabel = `Everyone home around ${formatEtaClock(now, maxEta)}`;
  } else if (enRouteHome.length > 0) {
    const maxEta = Math.max(...enRouteHome.map((m) => m.etaMinutes ?? 0));
    const names = enRouteHome.map((m) => m.displayName).slice(0, 2).join(", ");
    everyoneHomeByLabel =
      enRouteHome.length === 1
        ? `${names} heading home · ETA ${formatEtaClock(now, maxEta)}`
        : `${enRouteHome.length} heading home by ${formatEtaClock(now, maxEta)}`;
  } else if (outAndAbout.length === 1) {
    const m = outAndAbout[0]!;
    everyoneHomeByLabel = isMoving(m.presence)
      ? `${m.displayName} is ${m.presence === "driving" ? "driving" : "on the move"}`
      : `${m.displayName} is out`;
  } else {
    const movers = outAndAbout.filter((m) => isMoving(m.presence)).length;
    everyoneHomeByLabel =
      movers > 0
        ? `${outAndAbout.length} out · ${movers} moving`
        : `${outAndAbout.length} out · ${trulyHome.length} home`;
  }

  let conflictNote: string | null = null;
  let opportunityNote: string | null = null;

  const logistics = detectLogisticsConflict({
    members,
    deadlines: (opts.deadlines ?? []).filter((d) => d.enabled !== false),
    places: opts.places ?? [],
    now,
  });
  if (logistics.conflict) conflictNote = logistics.conflict;
  if (logistics.opportunity) opportunityNote = logistics.opportunity;

  if (!opportunityNote) {
    const lowBatteryOut = outAndAbout.find(
      (m) => m.batteryPercent != null && m.batteryPercent <= 15 && isMoving(m.presence)
    );
    if (lowBatteryOut) {
      opportunityNote = `${lowBatteryOut.displayName} is moving with ${lowBatteryOut.batteryPercent}% battery.`;
    }
  }

  return {
    everyoneHomeByLabel,
    conflictNote,
    opportunityNote,
    members: presenceMembers,
  };
}

function detectLogisticsConflict(opts: {
  members: FlowMemberInput[];
  deadlines: FlowDeadline[];
  places: FlowPlaceHint[];
  now: Date;
}): { conflict: string | null; opportunity: string | null } {
  const nowMin = localMinutes(opts.now);
  const byId = new Map(opts.members.map((m) => [m.id, m]));

  // 1) Explicit no-show / pickup deadlines
  for (const deadline of opts.deadlines) {
    const member = byId.get(deadline.memberId);
    if (!member) continue;
    const needBy = parseTimeLocal(deadline.byTimeLocal);
    if (needBy == null) continue;

    const atPlace =
      member.placeName != null &&
      namesMatch(member.placeName, deadline.placeName) &&
      !isMoving(member.presence);
    if (atPlace) continue;

    const headingThere =
      member.likelyDestination != null &&
      namesMatch(member.likelyDestination, deadline.placeName) &&
      member.etaMinutes != null &&
      (member.destinationConfidence ?? 0) >= 0.45;

    const arriveMin = headingThere ? nowMin + member.etaMinutes! : null;
    const lateWindow = nowMin >= needBy - 20; // only surface near / past deadline

    if (!lateWindow && !(headingThere && arriveMin != null && arriveMin > needBy)) {
      continue;
    }

    if (headingThere && arriveMin != null && arriveMin > needBy) {
      const lateBy = arriveMin - needBy;
      const conflict = `${member.displayName} won’t reach ${deadline.placeName} until ~${formatEtaClock(
        opts.now,
        member.etaMinutes!
      )} (${lateBy} min after ${deadline.byTimeLocal}).`;

      const helper = opts.members.find(
        (o) =>
          o.id !== member.id &&
          o.likelyDestination != null &&
          namesMatch(o.likelyDestination, deadline.placeName) &&
          o.etaMinutes != null &&
          o.etaMinutes + nowMin <= needBy &&
          (o.destinationConfidence ?? 0) >= 0.45
      );
      const opportunity = helper
        ? `${helper.displayName} could cover ${deadline.placeName} by ~${formatEtaClock(
            opts.now,
            helper.etaMinutes!
          )}.`
        : null;
      return { conflict, opportunity };
    }

    if (nowMin >= needBy && !atPlace) {
      return {
        conflict: `${member.displayName} isn’t at ${deadline.placeName} yet (needed by ${deadline.byTimeLocal}).`,
        opportunity: null,
      };
    }
  }

  // 2) Soft school/sports pickup overlap — two people heading to same place with clashing ETAs
  const pickupPlaces = opts.places.filter((p) =>
    ["school", "sports"].includes(p.category)
  );
  for (const place of pickupPlaces) {
    const heading = opts.members.filter(
      (m) =>
        m.likelyDestination != null &&
        namesMatch(m.likelyDestination, place.name) &&
        m.etaMinutes != null &&
        isMoving(m.presence) &&
        (m.destinationConfidence ?? 0) >= 0.55
    );
    if (heading.length < 2) continue;
    const sorted = [...heading].sort((a, b) => (a.etaMinutes ?? 0) - (b.etaMinutes ?? 0));
    const first = sorted[0]!;
    const second = sorted[1]!;
    const gap = (second.etaMinutes ?? 0) - (first.etaMinutes ?? 0);
    if (gap >= 12 && gap <= 45) {
      return {
        conflict: `${first.displayName} and ${second.displayName} are both heading to ${place.name} — arrivals ~${gap} min apart.`,
        opportunity: `${first.displayName} arrives first (~${formatEtaClock(
          opts.now,
          first.etaMinutes!
        )}); ${second.displayName} may not need the same pickup.`,
      };
    }
  }

  return { conflict: null, opportunity: null };
}

export function buildSomethingDifferentNote(opts: {
  displayName: string;
  placeName: string;
  usualLeaveLabel: string;
  batteryPercent: number | null;
}): {
  memberName: string;
  title: string;
  body: string;
  tone: string;
} {
  const battery =
    opts.batteryPercent != null ? ` Battery: ${opts.batteryPercent}%.` : "";
  return {
    memberName: opts.displayName,
    title: "Something’s different",
    body: `${opts.displayName} usually leaves ${opts.placeName} around ${opts.usualLeaveLabel}. They’re still there.${battery}`,
    tone: "This is unusual — not an emergency.",
  };
}
