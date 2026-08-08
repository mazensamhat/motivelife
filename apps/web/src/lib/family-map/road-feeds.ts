/**
 * Pluggable regional road-event feeds → unified FamilyDriveEvent[].
 *
 * Global strategy:
 * - Household GPS pace (always) → traffic feel
 * - Open regional open-data feeds when the driver is inside their coverage
 *   (Ontario 511 today; add US state 511 / EU National Access Points later)
 * - Paid congestion heatmaps are optional later — not required for v1
 */

import type { FamilyDriveEvent } from "@forward/shared";
import {
  fetchOntario511Events,
  filterOntario511Near,
  ontario511ToDriveEvents,
} from "./ontario-511";

/** Southern Ontario / Windsor–Toronto corridor where 511on.ca is useful. */
function inOntarioCoverage(lat: number, lng: number): boolean {
  return lat >= 41.5 && lat <= 47.2 && lng >= -85.0 && lng <= -74.0;
}

export async function fetchNearbyRoadEvents(opts: {
  center: { lat: number; lng: number } | null;
  routePath?: Array<{ lat: number; lng: number }> | null;
  memberId: string | null;
  memberName: string | null;
  radiusKm?: number;
  limit?: number;
}): Promise<FamilyDriveEvent[]> {
  const center = opts.center;
  if (!center) return [];

  const out: FamilyDriveEvent[] = [];

  // Ontario Traveller Information — free, no key; skip fetch outside coverage.
  if (inOntarioCoverage(center.lat, center.lng)) {
    try {
      const all = await fetchOntario511Events();
      const near = filterOntario511Near(all, {
        center,
        routePath: opts.routePath,
        radiusKm: opts.radiusKm ?? 18,
        limit: opts.limit ?? 8,
      });
      out.push(
        ...ontario511ToDriveEvents(near, {
          memberId: opts.memberId,
          memberName: opts.memberName,
        })
      );
    } catch {
      // keep other feeds
    }
  }

  // Future: US state DOT / 511 feeds, EU DATEX II NAPs, etc. — same shape.

  // Dedupe by id
  const seen = new Set<string>();
  return out.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}
