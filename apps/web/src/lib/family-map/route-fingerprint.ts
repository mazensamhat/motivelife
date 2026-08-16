import type { DriveTripSummary, FamilyMapMemberView } from "@forward/shared";

/**
 * Compare today's trip to the household’s learned OD fingerprint (distance + duration).
 * Uses recentTrips already on map state — no extra queries or path geometry.
 */

export type RouteFingerprint = {
  unusual: boolean;
  badge: string;
  title: string;
  detail: string | null;
  typicalMinutes: number | null;
  typicalKm: number | null;
  deltaMinutes: number | null;
  deltaKm: number | null;
};

function odKey(from: string | null | undefined, to: string | null | undefined) {
  const a = (from ?? "").trim().toLowerCase();
  const b = (to ?? "").trim().toLowerCase();
  if (!a || !b) return null;
  return `${a}→${b}`;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function labelsClose(a: string, b: string) {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Build OD baselines from completed trips. */
export function buildOdBaselines(trips: DriveTripSummary[]) {
  const byOd = new Map<string, { durations: number[]; distances: number[] }>();
  for (const t of trips) {
    if (t.endedAt == null && t.durationMinutes < 2) continue;
    const key = odKey(t.fromLabel, t.toLabel);
    if (!key) continue;
    const row = byOd.get(key) ?? { durations: [], distances: [] };
    if (t.durationMinutes > 0 && t.durationMinutes < 180) {
      row.durations.push(t.durationMinutes);
    }
    if (t.distanceKm > 0.3 && t.distanceKm < 400) {
      row.distances.push(t.distanceKm);
    }
    byOd.set(key, row);
  }
  return byOd;
}

/**
 * Fingerprint for a moving member vs their usual OD (from→likelyDestination),
 * or for a completed trip summary.
 */
export function buildRouteFingerprint(
  member: FamilyMapMemberView,
  trips: DriveTripSummary[]
): RouteFingerprint | null {
  const dest = member.likelyDestination?.trim();
  if (!dest) return null;
  if (member.presence !== "driving" && member.presence !== "moving") return null;

  const from = member.placeName?.trim() || null;
  // Prefer OD from last completed trip that matches destination, else from→dest.
  const baselines = buildOdBaselines(trips);
  let key =
    from && odKey(from, dest)
      ? odKey(from, dest)
      : null;

  if (!key) {
    // Fall back: any OD ending at this destination with enough samples.
    for (const [k, row] of baselines) {
      if (!k.endsWith(`→${dest.toLowerCase()}`)) continue;
      if (row.durations.length >= 3) {
        key = k;
        break;
      }
    }
  }

  if (!key) return null;
  const row = baselines.get(key);
  if (!row || row.durations.length < 3) return null;

  const typicalMinutes = median(row.durations);
  const typicalKm = median(row.distances);
  const liveEta = member.etaMinutes;
  const typicalEta = member.typicalEtaMinutes ?? typicalMinutes;

  if (typicalMinutes == null && typicalEta == null) return null;

  const baseline = typicalEta ?? typicalMinutes!;
  let deltaMinutes: number | null = null;
  let unusual = false;
  let title = "Typical trip";
  let badge = "ROUTINE";
  let detail: string | null =
    typicalMinutes != null
      ? `Usual ${Math.round(typicalMinutes)} min` +
        (typicalKm != null ? ` · ${typicalKm.toFixed(1)} km` : "")
      : null;

  if (liveEta != null && liveEta > 0) {
    deltaMinutes = Math.round(liveEta - baseline);
    if (deltaMinutes >= 6) {
      unusual = true;
      badge = `+${deltaMinutes} MIN`;
      title = "Slower than your normal route";
      detail = `Usually ~${Math.round(baseline)} min · ETA ${liveEta} min now`;
    } else if (deltaMinutes <= -5) {
      unusual = true;
      badge = `${deltaMinutes} MIN`;
      title = "Faster than your normal route";
      detail = `Usually ~${Math.round(baseline)} min · ETA ${liveEta} min now`;
    }
  }

  // Distance stretch vs OD median (alternate / longer path).
  const memberTrip = trips.find(
    (t) =>
      t.memberId === member.id &&
      !t.endedAt &&
      labelsClose(t.toLabel, dest)
  );
  if (
    !unusual &&
    memberTrip &&
    typicalKm != null &&
    memberTrip.distanceKm > typicalKm * 1.18 &&
    memberTrip.distanceKm - typicalKm >= 1.2
  ) {
    unusual = true;
    const extra = memberTrip.distanceKm - typicalKm;
    badge = `+${extra.toFixed(1)} KM`;
    title = "Different route today";
    detail = `Usual ${typicalKm.toFixed(1)} km · ${memberTrip.distanceKm.toFixed(1)} km so far`;
    deltaMinutes = deltaMinutes ?? null;
  }

  if (!unusual && liveEta == null) return null;

  return {
    unusual,
    badge,
    title,
    detail,
    typicalMinutes: typicalMinutes != null ? Math.round(typicalMinutes) : null,
    typicalKm: typicalKm != null ? Math.round(typicalKm * 10) / 10 : null,
    deltaMinutes,
    deltaKm:
      memberTrip && typicalKm != null
        ? Math.round((memberTrip.distanceKm - typicalKm) * 10) / 10
        : null,
  };
}

/** Compare a finished trip to OD habit (for history / member sheet). */
export function compareFinishedTrip(
  trip: DriveTripSummary,
  trips: DriveTripSummary[]
): RouteFingerprint | null {
  const key = odKey(trip.fromLabel, trip.toLabel);
  if (!key) return null;
  const baselines = buildOdBaselines(
    trips.filter((t) => t.id !== trip.id && t.endedAt != null)
  );
  const row = baselines.get(key);
  if (!row || row.durations.length < 3) return null;
  const typicalMinutes = median(row.durations);
  const typicalKm = median(row.distances);
  if (typicalMinutes == null) return null;

  const deltaMinutes = Math.round(trip.durationMinutes - typicalMinutes);
  const deltaKm =
    typicalKm != null
      ? Math.round((trip.distanceKm - typicalKm) * 10) / 10
      : null;

  let unusual = false;
  let badge = "ROUTINE";
  let title = "On your usual route";
  let detail = `Typical ${Math.round(typicalMinutes)} min`;

  if (Math.abs(deltaMinutes) >= 6) {
    unusual = true;
    badge = deltaMinutes > 0 ? `+${deltaMinutes} MIN` : `${deltaMinutes} MIN`;
    title =
      deltaMinutes > 0
        ? "Slower than your normal commute"
        : "Faster than your normal commute";
    detail = `Today ${Math.round(trip.durationMinutes)} min · usual ${Math.round(typicalMinutes)} min`;
  } else if (deltaKm != null && Math.abs(deltaKm) >= 1.5 && typicalKm != null) {
    unusual = true;
    badge = deltaKm > 0 ? `+${deltaKm} KM` : `${deltaKm} KM`;
    title = "Different route today";
    detail = `Today ${trip.distanceKm.toFixed(1)} km · usual ${typicalKm.toFixed(1)} km`;
  }

  return {
    unusual,
    badge,
    title,
    detail,
    typicalMinutes: Math.round(typicalMinutes),
    typicalKm: typicalKm != null ? Math.round(typicalKm * 10) / 10 : null,
    deltaMinutes,
    deltaKm,
  };
}
