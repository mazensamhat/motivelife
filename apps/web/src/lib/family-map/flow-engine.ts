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

  const etasHome = members
    .filter(
      (m) =>
        !m.isAtHome && m.likelyDestination?.toLowerCase() === "home" && m.etaMinutes != null
    )
    .map((m) => ({ name: m.displayName, eta: m.etaMinutes! }));

  const atHomeOrArriving = members.filter(
    (m) =>
      m.isAtHome || (m.likelyDestination?.toLowerCase() === "home" && m.etaMinutes != null)
  );

  let everyoneHomeByLabel: string | null = null;
  if (atHomeOrArriving.length === members.length && members.length > 0) {
    const maxEta = Math.max(0, ...etasHome.map((e) => e.eta), 0);
    const stillOut = etasHome.length > 0;
    everyoneHomeByLabel = stillOut
      ? `Everyone home around ${formatEtaClock(now, maxEta)}`
      : "Everyone is home";
  } else if (etasHome.length > 0) {
    const maxEta = Math.max(...etasHome.map((e) => e.eta));
    everyoneHomeByLabel = `Expected home wave by ${formatEtaClock(now, maxEta)}`;
  }

  const drivers = members.filter(
    (m) => (m.presence === "driving" || m.presence === "moving") && m.etaMinutes != null
  );
  const pickup = members.find(
    (m) =>
      m.placeName?.toLowerCase().includes("soccer") ||
      m.statusLabel.toLowerCase().includes("soccer") ||
      m.statusLabel.toLowerCase().includes("pickup")
  );

  let conflictNote: string | null = null;
  let opportunityNote: string | null = null;

  if (pickup && drivers.length > 0) {
    const pickupEta = pickup.etaMinutes ?? 25;
    const nearest = [...drivers].sort(
      (a, b) => (a.etaMinutes ?? 99) - (b.etaMinutes ?? 99)
    )[0]!;
    const overlap = Math.abs((nearest.etaMinutes ?? 0) - pickupEta);
    if (overlap <= 20) {
      conflictNote = `${nearest.displayName}'s current ETA and ${pickup.displayName}'s pickup overlap by approximately ${Math.max(1, overlap)} minutes.`;
      const other = drivers.find((d) => d.id !== nearest.id);
      if (other && (other.etaMinutes ?? 99) + 5 < (nearest.etaMinutes ?? 99)) {
        opportunityNote = `${other.displayName} can reach pickup approximately ${Math.max(1, (nearest.etaMinutes ?? 0) - (other.etaMinutes ?? 0))} minutes earlier.`;
      } else {
        opportunityNote = `Leaving 10 minutes earlier for pickup would clear the overlap.`;
      }
    }
  }

  const shopper = members.find((m) => m.placeName?.toLowerCase().includes("costco"));
  if (shopper && !opportunityNote) {
    opportunityNote = `${shopper.displayName} is at Costco — a good moment to share the household list.`;
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
