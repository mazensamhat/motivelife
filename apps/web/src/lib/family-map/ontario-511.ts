/**
 * Ontario 511 public traveller events (construction, incidents, closures).
 * Free open feed — no API key. Server-side only (no CORS).
 */

import type { FamilyDriveEvent, FamilyDriveEventKind } from "@forward/shared";

export type Ontario511Event = {
  id: string;
  kind: FamilyDriveEventKind;
  title: string;
  detail: string;
  lat: number;
  lng: number;
  roadway: string | null;
  severity: "info" | "watch" | "warning";
};

type Raw511 = {
  ID?: number;
  EventType?: string;
  EventSubType?: string | null;
  Description?: string;
  RoadwayName?: string;
  Latitude?: number;
  Longitude?: number;
  LanesAffected?: string | null;
  IsFullClosure?: boolean | string | null;
};

const CACHE_TTL_MS = 5 * 60_000;
let cache: { at: number; events: Ontario511Event[] } | null = null;

function mapKind(raw: Raw511): FamilyDriveEventKind {
  const t = (raw.EventType ?? "").toLowerCase();
  if (t.includes("accident") || t.includes("incident")) return "accident";
  if (t.includes("closure") || raw.IsFullClosure === true || raw.IsFullClosure === "true") {
    return "closure";
  }
  if (t.includes("roadwork") || t.includes("construction")) return "construction";
  if (t.includes("weather")) return "weather";
  return "hazard";
}

function mapTitle(kind: FamilyDriveEventKind, roadway: string | null): string {
  const road = roadway?.trim() || "Road";
  switch (kind) {
    case "accident":
      return `Incident · ${road}`;
    case "closure":
      return `Closure · ${road}`;
    case "construction":
      return `Construction · ${road}`;
    case "weather":
      return `Weather · ${road}`;
    default:
      return `Alert · ${road}`;
  }
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const lat1 = toR(a.lat);
  const lat2 = toR(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export async function fetchOntario511Events(): Promise<Ontario511Event[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.events;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch("https://511on.ca/api/v2/get/event", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return cache?.events ?? [];
    const raw = (await res.json()) as Raw511[];
    if (!Array.isArray(raw)) return cache?.events ?? [];

    const events: Ontario511Event[] = [];
    for (const row of raw) {
      if (row.Latitude == null || row.Longitude == null) continue;
      if (!Number.isFinite(row.Latitude) || !Number.isFinite(row.Longitude)) continue;
      const kind = mapKind(row);
      const roadway = row.RoadwayName?.trim() || null;
      const detail = (row.Description ?? "").trim() || mapTitle(kind, roadway);
      const fullClose =
        row.IsFullClosure === true ||
        row.IsFullClosure === "true" ||
        /all lanes closed/i.test(detail);
      events.push({
        id: `on511-${row.ID ?? `${row.Latitude},${row.Longitude}`}`,
        kind,
        title: mapTitle(kind, roadway),
        detail: detail.length > 140 ? `${detail.slice(0, 137)}…` : detail,
        lat: row.Latitude,
        lng: row.Longitude,
        roadway,
        severity: fullClose || kind === "accident" ? "warning" : "watch",
      });
    }

    cache = { at: Date.now(), events };
    return events;
  } catch {
    return cache?.events ?? [];
  } finally {
    clearTimeout(timer);
  }
}

/** Keep events near a point or along a route corridor. */
export function filterOntario511Near(
  events: Ontario511Event[],
  opts: {
    center: { lat: number; lng: number } | null;
    routePath?: Array<{ lat: number; lng: number }> | null;
    radiusKm?: number;
    limit?: number;
  }
): Ontario511Event[] {
  const radius = opts.radiusKm ?? 12;
  const limit = opts.limit ?? 6;
  const path = opts.routePath?.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );

  const scored = events
    .map((e) => {
      let minKm = opts.center ? haversineKm(opts.center, e) : Infinity;
      if (path && path.length) {
        for (const p of path) {
          const d = haversineKm(p, e);
          if (d < minKm) minKm = d;
        }
      }
      return { e, minKm };
    })
    .filter((x) => x.minKm <= radius)
    .sort((a, b) => a.minKm - b.minKm)
    .slice(0, limit);

  return scored.map((x) => x.e);
}

export function ontario511ToDriveEvents(
  events: Ontario511Event[],
  opts: { memberId: string | null; memberName: string | null }
): FamilyDriveEvent[] {
  return events.map((e) => ({
    id: e.id,
    kind: e.kind,
    title: e.title,
    detail: e.detail,
    severity: e.severity,
    memberId: opts.memberId,
    memberName: opts.memberName,
    lat: e.lat,
    lng: e.lng,
    etaDeltaMin: e.kind === "closure" ? 8 : e.kind === "accident" ? 6 : 3,
    distanceAheadKm: null,
  }));
}
