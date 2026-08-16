/**
 * Deterministic Ask KINZO — answers from household trips/visits (no LLM).
 */

export type AskKinzoMember = {
  id: string;
  displayName: string;
};

export type AskKinzoTrip = {
  memberId: string;
  memberName?: string | null;
  fromLabel: string;
  toLabel: string;
  distanceKm: number;
  durationMinutes: number;
  startedAt?: string;
  endedAt?: string | null;
  driveScore?: number;
};

export type AskKinzoVisit = {
  memberId: string;
  placeName: string;
  arrivedAt: string;
  departedAt: string | null;
  dwellMinutes: number | null;
  isActive?: boolean;
};

export type AskKinzoAnswer = {
  answer: string;
  memberId: string | null;
  placeName: string | null;
};

function firstName(name: string) {
  return name.split(/\s+/)[0] || name;
}

function resolveMember(
  q: string,
  members: AskKinzoMember[]
): AskKinzoMember | null {
  const lower = q.toLowerCase();
  let best: AskKinzoMember | null = null;
  let bestLen = 0;
  for (const m of members) {
    const full = m.displayName.toLowerCase();
    const first = firstName(m.displayName).toLowerCase();
    if (lower.includes(full) && full.length > bestLen) {
      best = m;
      bestLen = full.length;
    } else if (lower.includes(first) && first.length > 2 && first.length > bestLen) {
      best = m;
      bestLen = first.length;
    }
  }
  return best;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "recently";
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function hoursFromMin(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function placeInQuestion(q: string, placeNames: string[]): string | null {
  const lower = q.toLowerCase();
  let best: string | null = null;
  let bestLen = 0;
  for (const name of placeNames) {
    const n = name.trim().toLowerCase();
    if (n.length < 2) continue;
    if (lower.includes(n) && n.length > bestLen) {
      best = name;
      bestLen = n.length;
    }
  }
  // Common aliases
  if (!best) {
    if (/\bhome\b/i.test(q)) {
      const home = placeNames.find((p) => /home/i.test(p));
      if (home) return home;
    }
    if (/\bwork\b/i.test(q)) {
      const work = placeNames.find((p) => /work|office/i.test(p));
      if (work) return work;
    }
  }
  return best;
}

/**
 * Answer a natural-language question from in-memory trips/visits.
 */
export function answerAskKinzo(opts: {
  question: string;
  members: AskKinzoMember[];
  trips: AskKinzoTrip[];
  visits: AskKinzoVisit[];
  placeNames?: string[];
}): AskKinzoAnswer {
  const q = opts.question.trim();
  if (!q) {
    return {
      answer: "Ask about a place, a drive, or when someone got home.",
      memberId: null,
      placeName: null,
    };
  }

  const member = resolveMember(q, opts.members);
  const placeNames =
    opts.placeNames ??
    [
      ...new Set([
        ...opts.visits.map((v) => v.placeName),
        ...opts.trips.flatMap((t) => [t.fromLabel, t.toLabel]),
      ]),
    ].filter(Boolean);
  const place = placeInQuestion(q, placeNames);

  const memberTrips = member
    ? opts.trips.filter((t) => t.memberId === member.id)
    : opts.trips;
  const memberVisits = member
    ? opts.visits.filter((v) => v.memberId === member.id)
    : opts.visits;

  // Who spent most time driving
  if (/most.*(time|hours).*driv|who.*driv.*most|most.*driv/i.test(q)) {
    const byMember = new Map<string, number>();
    for (const t of opts.trips) {
      byMember.set(t.memberId, (byMember.get(t.memberId) ?? 0) + t.durationMinutes);
    }
    let topId: string | null = null;
    let topMin = 0;
    for (const [id, mins] of byMember) {
      if (mins > topMin) {
        topMin = mins;
        topId = id;
      }
    }
    const m = opts.members.find((x) => x.id === topId);
    if (m && topMin > 0) {
      return {
        answer: `${firstName(m.displayName)} spent the most time driving — about ${hoursFromMin(topMin)} in this window.`,
        memberId: m.id,
        placeName: null,
      };
    }
  }

  // How often does X go to Y / how many times
  if (/how (often|many)|how many times|visit(ed|s)?/i.test(q) && place) {
    const hits = memberVisits.filter((v) =>
      v.placeName.toLowerCase().includes(place.toLowerCase())
    );
    const who = member ? firstName(member.displayName) : "The family";
    if (hits.length === 0) {
      return {
        answer: `${who} has no recorded visits to ${place} in this history window.`,
        memberId: member?.id ?? null,
        placeName: place,
      };
    }
    return {
      answer: `${who} visited ${place} ${hits.length} time${hits.length === 1 ? "" : "s"} in this window. Last: ${formatWhen(hits[0]!.arrivedAt)}.`,
      memberId: member?.id ?? null,
      placeName: place,
    };
  }

  // Last time at place / when was the last time
  if (/last time|when (was|did)|went there|was (I|we|everyone) at/i.test(q) && place) {
    const hits = memberVisits
      .filter((v) => v.placeName.toLowerCase().includes(place.toLowerCase()))
      .sort(
        (a, b) => new Date(b.arrivedAt).getTime() - new Date(a.arrivedAt).getTime()
      );
    const who = member ? firstName(member.displayName) : "Someone";
    if (!hits[0]) {
      return {
        answer: `No visit to ${place} found in this history window.`,
        memberId: member?.id ?? null,
        placeName: place,
      };
    }
    return {
      answer: `${who} was at ${place} ${formatWhen(hits[0].arrivedAt)}${
        hits[0].dwellMinutes != null
          ? ` · stayed ${hoursFromMin(hits[0].dwellMinutes)}`
          : ""
      }.`,
      memberId: member?.id ?? null,
      placeName: place,
    };
  }

  // When did everyone / X get home
  if (/get home|got home|home friday|home on|arrive(d)? home/i.test(q)) {
    const homeVisits = memberVisits
      .filter((v) => /home/i.test(v.placeName))
      .sort(
        (a, b) => new Date(b.arrivedAt).getTime() - new Date(a.arrivedAt).getTime()
      );
    if (member) {
      const hit = homeVisits[0];
      if (!hit) {
        return {
          answer: `No Home arrival for ${firstName(member.displayName)} in this window.`,
          memberId: member.id,
          placeName: "Home",
        };
      }
      return {
        answer: `${firstName(member.displayName)} got to ${hit.placeName} ${formatWhen(hit.arrivedAt)}.`,
        memberId: member.id,
        placeName: hit.placeName,
      };
    }
    // Family: latest home arrival per member in window
    const latest = new Map<string, AskKinzoVisit>();
    for (const v of homeVisits) {
      if (!latest.has(v.memberId)) latest.set(v.memberId, v);
    }
    if (latest.size === 0) {
      return {
        answer: "No Home arrivals found in this history window.",
        memberId: null,
        placeName: "Home",
      };
    }
    const lines = [...latest.entries()]
      .map(([id, v]) => {
        const m = opts.members.find((x) => x.id === id);
        return `${m ? firstName(m.displayName) : "Someone"} ${formatWhen(v.arrivedAt)}`;
      })
      .slice(0, 5);
    return {
      answer: `Home arrivals: ${lines.join("; ")}.`,
      memberId: null,
      placeName: "Home",
    };
  }

  // Where were we / where was X
  if (/where (was|were|is)/i.test(q)) {
    const sorted = [...memberVisits].sort(
      (a, b) => new Date(b.arrivedAt).getTime() - new Date(a.arrivedAt).getTime()
    );
    const hit = sorted[0];
    const who = member ? firstName(member.displayName) : "Someone";
    if (hit) {
      return {
        answer: `${who} was at ${hit.placeName} ${formatWhen(hit.arrivedAt)}.`,
        memberId: member?.id ?? hit.memberId,
        placeName: hit.placeName,
      };
    }
    const trip = memberTrips
      .slice()
      .sort(
        (a, b) =>
          new Date(b.startedAt ?? 0).getTime() -
          new Date(a.startedAt ?? 0).getTime()
      )[0];
    if (trip) {
      return {
        answer: `${who} drove ${trip.fromLabel} → ${trip.toLabel}${
          trip.startedAt ? ` (${formatWhen(trip.startedAt)})` : ""
        }.`,
        memberId: member?.id ?? trip.memberId,
        placeName: trip.toLabel,
      };
    }
  }

  // Last drive
  if (/last (drive|trip|commute)|recent drive/i.test(q)) {
    const trip = memberTrips
      .slice()
      .sort(
        (a, b) =>
          new Date(b.endedAt ?? b.startedAt ?? 0).getTime() -
          new Date(a.endedAt ?? a.startedAt ?? 0).getTime()
      )[0];
    const who = member ? firstName(member.displayName) : "Someone";
    if (!trip) {
      return {
        answer: "No completed drives in this history window yet.",
        memberId: member?.id ?? null,
        placeName: null,
      };
    }
    return {
      answer: `${who}: ${trip.fromLabel} → ${trip.toLabel} · ${trip.distanceKm.toFixed(1)} km · ${Math.round(trip.durationMinutes)} min${
        trip.driveScore != null ? ` · score ${trip.driveScore}` : ""
      }.`,
      memberId: member?.id ?? trip.memberId,
      placeName: trip.toLabel,
    };
  }

  // Dwell / time at place
  if (/how long|time at|spent at|dwell/i.test(q) && place) {
    const hits = memberVisits.filter((v) =>
      v.placeName.toLowerCase().includes(place.toLowerCase())
    );
    const total = hits.reduce((a, v) => a + (v.dwellMinutes ?? 0), 0);
    const who = member ? firstName(member.displayName) : "The family";
    if (total <= 0 && hits.length === 0) {
      return {
        answer: `No dwell time recorded at ${place} in this window.`,
        memberId: member?.id ?? null,
        placeName: place,
      };
    }
    return {
      answer: `${who} spent about ${hoursFromMin(total)} at ${place} across ${hits.length} visit${hits.length === 1 ? "" : "s"}.`,
      memberId: member?.id ?? null,
      placeName: place,
    };
  }

  return {
    answer:
      "Try: “When was the last time at Costco?”, “How often does Liam go there?”, “What time did everyone get home?”, “Who drove the most?”, or “Where was Zeinab?”",
    memberId: member?.id ?? null,
    placeName: place,
  };
}
