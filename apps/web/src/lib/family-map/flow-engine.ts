import {
  formatEtaClock,
  type FamilyFlowSummary,
  type FamilyMemberPresence,
  type FamilyMemberPresenceStatus,
} from "@forward/shared";

type FlowMemberInput = {
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

export function buildFamilyFlow(members: FlowMemberInput[], now = new Date()): FamilyFlowSummary {
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

  // Real conflicts — overlapping arrivals or two people racing to the same place.
  let conflictNote: string | null = null;
  let opportunityNote: string | null = null;

  const headed = members.filter(
    (m) =>
      isMoving(m.presence) &&
      m.likelyDestination &&
      (m.destinationConfidence ?? 0) >= 0.55 &&
      m.etaMinutes != null
  );
  for (let i = 0; i < headed.length; i++) {
    for (let j = i + 1; j < headed.length; j++) {
      const a = headed[i]!;
      const b = headed[j]!;
      if (a.likelyDestination?.toLowerCase() !== b.likelyDestination?.toLowerCase()) continue;
      const etaGap = Math.abs((a.etaMinutes ?? 0) - (b.etaMinutes ?? 0));
      if (etaGap <= 25) {
        conflictNote = `${a.displayName} and ${b.displayName} are both heading to ${a.likelyDestination} around the same time.`;
        break;
      }
    }
    if (conflictNote) break;
  }

  if (!conflictNote) {
    const drivingLow = members.find(
      (m) => m.presence === "driving" && m.batteryPercent != null && m.batteryPercent <= 10
    );
    if (drivingLow) {
      conflictNote = `${drivingLow.displayName} is driving with ${drivingLow.batteryPercent}% battery — may drop offline.`;
    }
  }

  const lowBatteryOut = outAndAbout.find(
    (m) => m.batteryPercent != null && m.batteryPercent <= 15 && isMoving(m.presence)
  );
  if (lowBatteryOut && !conflictNote) {
    opportunityNote = `${lowBatteryOut.displayName} is moving with ${lowBatteryOut.batteryPercent}% battery.`;
  } else if (!opportunityNote && headed.length === 1 && headed[0]!.etaMinutes != null) {
    opportunityNote = `${headed[0]!.displayName} ETA ${headed[0]!.etaMinutes} min to ${headed[0]!.likelyDestination}.`;
  }

  return {
    everyoneHomeByLabel,
    conflictNote,
    opportunityNote,
    members: presenceMembers,
  };
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
