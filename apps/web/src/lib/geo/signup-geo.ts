import { countryToContinent } from "@/lib/geo/continents";

export interface SignupGeo {
  country: string | null;
  region: string | null;
  city: string | null;
  continent: string | null;
  latitude: number | null;
  longitude: number | null;
}

function parseCoord(value: string | null): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function decodeHeader(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Resolve signup location from CDN/platform headers (Vercel, Cloudflare). */
export function resolveSignupGeoFromHeaders(request: Request): SignupGeo {
  const h = request.headers;
  const country =
    h.get("x-vercel-ip-country") ??
    h.get("cf-ipcountry") ??
    h.get("x-country-code") ??
    null;
  const region = decodeHeader(h.get("x-vercel-ip-country-region"));
  const city = decodeHeader(h.get("x-vercel-ip-city"));
  const latitude = parseCoord(h.get("x-vercel-ip-latitude"));
  const longitude = parseCoord(h.get("x-vercel-ip-longitude"));
  const continent = countryToContinent(country);

  return { country, region, city, continent, latitude, longitude };
}

/** Best-effort geo for signup; headers first, optional IP lookup in dev. */
export async function resolveSignupGeo(request: Request): Promise<SignupGeo> {
  const fromHeaders = resolveSignupGeoFromHeaders(request);
  if (fromHeaders.country) return fromHeaders;

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded && forwarded !== "127.0.0.1" && forwarded !== "::1" ? forwarded : null;
  if (!ip || process.env.NODE_ENV === "production") {
    return fromHeaders;
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,lat,lon`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return fromHeaders;
    const data = (await res.json()) as {
      status?: string;
      countryCode?: string;
      regionName?: string;
      city?: string;
      lat?: number;
      lon?: number;
    };
    if (data.status !== "success" || !data.countryCode) return fromHeaders;
    return {
      country: data.countryCode,
      region: data.regionName ?? null,
      city: data.city ?? null,
      continent: countryToContinent(data.countryCode),
      latitude: data.lat ?? null,
      longitude: data.lon ?? null,
    };
  } catch {
    return fromHeaders;
  }
}

export function parseAcquisitionChannel(request: Request): string | null {
  const url = new URL(request.url);
  return (
    url.searchParams.get("ref") ??
    url.searchParams.get("utm_source") ??
    request.headers.get("x-acquisition-channel") ??
    null
  );
}
