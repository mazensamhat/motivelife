/**
 * KINZO hard-loaded map POIs (Leaflet overlays — works on phone raster).
 * Alive, not busy: zoom + Eye density gate how many show.
 */

import type { KinzoEyeDensity } from "@/lib/family-map/kinzo-map-style";
import { KINZO_ORB } from "@/lib/family-map/kinzo-map-style";

export type KinzoPoiKind =
  | "restaurant"
  | "gas"
  | "hotel"
  | "hospital"
  | "parking"
  | "school"
  | "shopping";

export type KinzoPoi = {
  id: string;
  kind: KinzoPoiKind;
  name: string;
  lat: number;
  lng: number;
};

export const KINZO_POI_META: Record<
  KinzoPoiKind,
  { label: string; color: string; glyph: string; minZoom: number }
> = {
  hospital: { label: "Hospital", color: KINZO_ORB.traffic, glyph: "+", minZoom: 12 },
  gas: { label: "Gas", color: KINZO_ORB.construction, glyph: "⛽", minZoom: 13 },
  hotel: { label: "Hotel", color: KINZO_ORB.intelligence, glyph: "H", minZoom: 13 },
  restaurant: { label: "Food", color: "#F97316", glyph: "🍴", minZoom: 14 },
  parking: { label: "Parking", color: KINZO_ORB.weather, glyph: "P", minZoom: 14 },
  school: { label: "School", color: KINZO_ORB.destination, glyph: "🎓", minZoom: 13 },
  shopping: { label: "Shop", color: KINZO_ORB.intelligence, glyph: "🛍", minZoom: 14 },
};

/** How many of each kind to keep for a viewport. */
export function kinzoPoiLimits(density: KinzoEyeDensity): Record<KinzoPoiKind, number> {
  if (density === "calm") {
    return {
      hospital: 8,
      gas: 6,
      hotel: 0,
      restaurant: 0,
      parking: 0,
      school: 4,
      shopping: 0,
    };
  }
  if (density === "vivid") {
    return {
      hospital: 16,
      gas: 14,
      hotel: 12,
      restaurant: 24,
      parking: 12,
      school: 12,
      shopping: 14,
    };
  }
  // focused
  return {
    hospital: 12,
    gas: 10,
    hotel: 8,
    restaurant: 14,
    parking: 8,
    school: 8,
    shopping: 8,
  };
}

export function kinzoPoiMinZoom(density: KinzoEyeDensity): number {
  if (density === "calm") return 13;
  if (density === "vivid") return 12.5;
  return 13;
}

export function filterPoisForView(
  pois: KinzoPoi[],
  zoom: number,
  density: KinzoEyeDensity
): KinzoPoi[] {
  const limits = kinzoPoiLimits(density);
  const counts: Partial<Record<KinzoPoiKind, number>> = {};
  const out: KinzoPoi[] = [];
  for (const p of pois) {
    const meta = KINZO_POI_META[p.kind];
    if (zoom < meta.minZoom) continue;
    const n = counts[p.kind] ?? 0;
    if (n >= limits[p.kind]) continue;
    counts[p.kind] = n + 1;
    out.push(p);
  }
  return out;
}

export function kinzoPoiIconHtml(poi: KinzoPoi): string {
  const meta = KINZO_POI_META[poi.kind];
  const name =
    poi.name.length > 18 ? `${poi.name.slice(0, 16)}…` : poi.name;
  const safeName = name
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<div class="kinzo-poi-orb" style="--orb:${meta.color}">
    <div class="kinzo-poi-bubble" aria-hidden="true">${meta.glyph}</div>
    <div class="kinzo-poi-label">${safeName}</div>
  </div>`;
}
