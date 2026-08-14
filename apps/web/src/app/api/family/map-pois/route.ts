import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { json, unauthorized, badRequest } from "@/lib/api";
import type { KinzoPoi, KinzoPoiKind } from "@/lib/family-map/kinzo-pois";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  south: z.coerce.number().min(-90).max(90),
  west: z.coerce.number().min(-180).max(180),
  north: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
  /** focused | calm | vivid — caps result size */
  density: z.enum(["calm", "focused", "vivid"]).optional().default("focused"),
});

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function classify(tags: Record<string, string> | undefined): KinzoPoiKind | null {
  if (!tags) return null;
  const amenity = tags.amenity ?? "";
  const tourism = tags.tourism ?? "";
  const shop = tags.shop ?? "";
  const healthcare = tags.healthcare ?? "";

  if (
    amenity === "hospital" ||
    amenity === "clinic" ||
    healthcare === "hospital" ||
    healthcare === "clinic"
  ) {
    return "hospital";
  }
  if (amenity === "fuel" || amenity === "charging_station") return "gas";
  if (tourism === "hotel" || tourism === "motel" || tourism === "guest_house") {
    return "hotel";
  }
  if (
    amenity === "restaurant" ||
    amenity === "fast_food" ||
    amenity === "cafe" ||
    amenity === "food_court"
  ) {
    return "restaurant";
  }
  if (amenity === "parking" || amenity === "parking_entrance") return "parking";
  if (amenity === "school" || amenity === "kindergarten" || amenity === "college") {
    return "school";
  }
  if (
    shop === "mall" ||
    shop === "supermarket" ||
    shop === "department_store" ||
    shop === "convenience"
  ) {
    return "shopping";
  }
  return null;
}

const KINZO_POI_FALLBACK: Record<KinzoPoiKind, string> = {
  hospital: "Hospital",
  gas: "Gas station",
  hotel: "Hotel",
  restaurant: "Restaurant",
  parking: "Parking",
  school: "School",
  shopping: "Shopping",
};

function poiName(tags: Record<string, string> | undefined, kind: KinzoPoiKind): string {
  const n = tags?.name?.trim() || tags?.brand?.trim() || tags?.operator?.trim();
  if (n) return n;
  return KINZO_POI_FALLBACK[kind];
}

function buildQuery(bbox: string, density: string): string {
  // Hard-load the categories the family asked for; keep the query tight for mobile.
  const hotel =
    density === "calm"
      ? ""
      : `nwr["tourism"~"^(hotel|motel|guest_house)$"](${bbox});`;
  const food =
    density === "calm"
      ? ""
      : `nwr["amenity"~"^(restaurant|fast_food|cafe)$"](${bbox});`;
  const parking =
    density === "vivid" ? `nwr["amenity"="parking"](${bbox});` : "";
  const shop =
    density === "calm"
      ? ""
      : `nwr["shop"~"^(mall|supermarket|department_store)$"](${bbox});`;

  return `
[out:json][timeout:18];
(
  nwr["amenity"~"^(hospital|clinic)$"](${bbox});
  nwr["healthcare"~"^(hospital|clinic)$"](${bbox});
  nwr["amenity"="fuel"](${bbox});
  nwr["amenity"~"^(school|kindergarten|college)$"](${bbox});
  ${hotel}
  ${food}
  ${parking}
  ${shop}
);
out center 120;
`.trim();
}

async function fetchOverpass(query: string): Promise<OverpassElement[]> {
  let lastErr: unknown = null;
  for (const endpoint of OVERPASS_URLS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 16_000);
      const res = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          Accept: "application/json",
          "User-Agent": "MotiveLife-KINZO/1.0 (+https://motivelife.ai; family-map POIs)",
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastErr = new Error(`Overpass ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { elements?: OverpassElement[] };
      return data.elements ?? [];
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Overpass failed");
}

/**
 * GET /api/family/map-pois?south=&west=&north=&east=&density=
 * Hard-loads OSM restaurants, gas, hotels, hospitals (etc.) for the viewport.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) return unauthorized();

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    south: url.searchParams.get("south"),
    west: url.searchParams.get("west"),
    north: url.searchParams.get("north"),
    east: url.searchParams.get("east"),
    density: url.searchParams.get("density") ?? "focused",
  });
  if (!parsed.success) return badRequest("Invalid map bounds.");

  const { south, west, north, east, density } = parsed.data;
  if (north <= south || east <= west) return badRequest("Invalid bbox.");

  // Cap viewport size (~0.35° ≈ 35km) so Overpass stays snappy on phones.
  if (north - south > 0.4 || east - west > 0.4) {
    return json({ pois: [] as KinzoPoi[], truncated: true });
  }

  const bbox = `${south},${west},${north},${east}`;
  try {
    const elements = await fetchOverpass(buildQuery(bbox, density));
    const pois: KinzoPoi[] = [];
    const seen = new Set<string>();

    for (const el of elements) {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat == null || lng == null) continue;
      if (lat < south || lat > north || lng < west || lng > east) continue;
      const kind = classify(el.tags);
      if (!kind) continue;
      const id = `${el.type}/${el.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      pois.push({
        id,
        kind,
        name: poiName(el.tags, kind),
        lat,
        lng,
      });
    }

    // Prefer named places; hospitals/gas first.
    const rank: Record<KinzoPoiKind, number> = {
      hospital: 0,
      gas: 1,
      school: 2,
      hotel: 3,
      restaurant: 4,
      shopping: 5,
      parking: 6,
    };
    pois.sort((a, b) => {
      const rd = rank[a.kind] - rank[b.kind];
      if (rd !== 0) return rd;
      const an = a.name === KINZO_POI_FALLBACK[a.kind] ? 1 : 0;
      const bn = b.name === KINZO_POI_FALLBACK[b.kind] ? 1 : 0;
      return an - bn;
    });

    return json({ pois, count: pois.length });
  } catch (e) {
    console.error("[map-pois]", e);
    return json({ pois: [] as KinzoPoi[], error: "poi_unavailable" });
  }
}
