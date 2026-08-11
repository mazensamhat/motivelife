/**
 * Nearby concerts / sports / shows via Ticketmaster Discovery API.
 * Optional — only runs when TICKETMASTER_API_KEY is set.
 * Maps to FamilyDriveEvent kind "other" (pink star orbs).
 */

import type { FamilyDriveEvent } from "@forward/shared";
import { haversineKm } from "./drive-impact";

const CACHE_TTL_MS = 15 * 60_000;
const CACHE_MAX = 32;
const cache = new Map<
  string,
  { at: number; events: FamilyDriveEvent[] }
>();

function cacheSet(
  key: string,
  value: { at: number; events: FamilyDriveEvent[] }
) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest == null) break;
    cache.delete(oldest);
  }
}

type TmEvent = {
  id?: string;
  name?: string;
  dates?: { start?: { localDate?: string; localTime?: string; dateTime?: string } };
  _embedded?: {
    venues?: Array<{
      name?: string;
      location?: { latitude?: string; longitude?: string };
      city?: { name?: string };
    }>;
  };
  classifications?: Array<{
    segment?: { name?: string };
    genre?: { name?: string };
  }>;
};

function apiKey(): string | null {
  const key = process.env.TICKETMASTER_API_KEY?.trim();
  return key || null;
}

function formatWhen(ev: TmEvent): string {
  const start = ev.dates?.start;
  if (!start) return "Soon";
  if (start.localDate && start.localTime) {
    return `${start.localDate} · ${start.localTime.slice(0, 5)}`;
  }
  if (start.localDate) return start.localDate;
  if (start.dateTime) {
    try {
      return new Date(start.dateTime).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "Soon";
    }
  }
  return "Soon";
}

function segmentLabel(ev: TmEvent): string {
  const seg = ev.classifications?.[0]?.segment?.name?.trim();
  const genre = ev.classifications?.[0]?.genre?.name?.trim();
  if (seg && genre && genre.toLowerCase() !== "undefined") return `${seg} · ${genre}`;
  return seg || "Event";
}

export async function fetchTicketmasterEventsNear(opts: {
  center: { lat: number; lng: number };
  memberId: string | null;
  memberName: string | null;
  radiusKm?: number;
  limit?: number;
}): Promise<FamilyDriveEvent[]> {
  const key = apiKey();
  if (!key) return [];

  const radiusKm = opts.radiusKm ?? 25;
  const limit = opts.limit ?? 6;
  const cacheKey = `${opts.center.lat.toFixed(2)},${opts.center.lng.toFixed(2)}:${radiusKm}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.events.map((e) => ({
      ...e,
      memberId: opts.memberId,
      memberName: opts.memberName,
    }));
  }

  const start = new Date();
  const end = new Date(Date.now() + 36 * 60 * 60_000);
  const params = new URLSearchParams({
    apikey: key,
    latlong: `${opts.center.lat},${opts.center.lng}`,
    radius: String(Math.min(100, Math.max(5, Math.round(radiusKm)))),
    unit: "km",
    size: String(Math.min(20, limit * 2)),
    sort: "date,asc",
    startDateTime: start.toISOString().replace(/\.\d{3}Z$/, "Z"),
    endDateTime: end.toISOString().replace(/\.\d{3}Z$/, "Z"),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?${params}`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      }
    );
    if (!res.ok) return hit?.events ?? [];
    const json = (await res.json()) as {
      _embedded?: { events?: TmEvent[] };
    };
    const raw = json._embedded?.events ?? [];
    const events: FamilyDriveEvent[] = [];

    for (const ev of raw) {
      const venue = ev._embedded?.venues?.[0];
      const lat = Number(venue?.location?.latitude);
      const lng = Number(venue?.location?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const km = haversineKm(opts.center, { lat, lng });
      if (km > radiusKm) continue;
      const name = (ev.name ?? "Event").trim();
      const venueName = venue?.name?.trim() || "Venue";
      const when = formatWhen(ev);
      events.push({
        id: `tm-${ev.id ?? `${lat},${lng},${name}`}`,
        kind: "other",
        title: name.length > 42 ? `${name.slice(0, 40)}…` : name,
        detail: `${segmentLabel(ev)} · ${venueName} · ${when}`,
        severity: "info",
        memberId: opts.memberId,
        memberName: opts.memberName,
        lat,
        lng,
        etaDeltaMin: 1,
        distanceAheadKm: Number(km.toFixed(2)),
        badge: km >= 10 ? `${Math.round(km)}` : km.toFixed(1),
        visual: "other",
      });
      if (events.length >= limit) break;
    }

    cacheSet(cacheKey, { at: Date.now(), events });
    return events;
  } catch {
    return hit?.events ?? [];
  } finally {
    clearTimeout(timer);
  }
}
