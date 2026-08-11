/**
 * Best-effort place labels for unsaved stops (Life360-style areas visited).
 * Uses OpenStreetMap Nominatim; falls back to a short coordinate label.
 */

type GeoLabel = {
  label: string;
  city?: string | null;
};

const GEO_CACHE_MAX = 240;
const cache = new Map<string, GeoLabel>();

function cacheKey(lat: number, lng: number) {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

function cacheSet(key: string, value: GeoLabel) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > GEO_CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest == null) break;
    cache.delete(oldest);
  }
}

export function shortCoordLabel(_lat: number, _lng: number) {
  // Avoid showing raw lat/lng in history ("Stop · 42.309, -83.024").
  return "Nearby stop";
}

export function isCoordStyleLabel(label: string | null | undefined) {
  if (!label) return false;
  const t = label.trim();
  return (
    t === "Nearby stop" ||
    /^Stop\s*[·•]\s*-?\d+\.\d+,\s*-?\d+\.\d+$/i.test(t) ||
    // Bare "42.309, -83.024" from older on-device history
    /^-?\d+\.\d{2,},\s*-?\d+\.\d{2,}$/.test(t)
  );
}

export async function reverseGeocodeLabel(
  lat: number,
  lng: number
): Promise<GeoLabel> {
  const key = cacheKey(lat, lng);
  const hit = cache.get(key);
  if (hit) return hit;

  const fallback: GeoLabel = { label: shortCoordLabel(lat, lng) };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("zoom", "17");
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "MotiveLife-FamilyMap/1.0 (support@mymotivelife.com)",
      },
    });
    clearTimeout(timer);
    if (!res.ok) {
      cacheSet(key, fallback);
      return fallback;
    }
    const data = (await res.json()) as {
      name?: string;
      display_name?: string;
      address?: {
        house_number?: string;
        road?: string;
        neighbourhood?: string;
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
      };
    };
    const addr = data.address ?? {};
    const city = addr.city ?? addr.town ?? addr.village ?? null;
    let label: string;
    if (data.name && data.name.length < 48) {
      label = data.name;
    } else if (addr.road) {
      label = addr.house_number ? `${addr.house_number} ${addr.road}` : addr.road;
      if (city) label = `${label}, ${city}`;
    } else if (addr.neighbourhood || addr.suburb) {
      label = [addr.neighbourhood ?? addr.suburb, city].filter(Boolean).join(", ");
    } else if (city) {
      label = city;
    } else {
      label = fallback.label;
    }
    const out = { label: label.slice(0, 80), city };
    cacheSet(key, out);
    return out;
  } catch {
    cacheSet(key, fallback);
    return fallback;
  }
}
