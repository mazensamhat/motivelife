/**
 * Pluggable regional road-event feeds → unified FamilyDriveEvent[].
 *
 * Global strategy:
 * - Household GPS pace (always) → traffic feel
 * - Open regional open-data feeds when the driver is inside their coverage
 *   (Ontario 511 today; add US state 511 / EU National Access Points later)
 * - Ticketmaster nearby shows when TICKETMASTER_API_KEY is set
 * - No household-crowdsourced police / event reporting
 */

import type { FamilyDriveEvent } from "@forward/shared";
import {
  fetchOntario511Events,
  filterOntario511Near,
  ontario511ToDriveEvents,
} from "./ontario-511";
import { fetchTicketmasterEventsNear } from "./ticketmaster-events";

/** Southern Ontario / Windsor–Toronto corridor where 511on.ca is useful. */
function inOntarioCoverage(lat: number, lng: number): boolean {
  return lat >= 41.5 && lat <= 47.2 && lng >= -85.0 && lng <= -74.0;
}

export async function fetchNearbyRoadEvents(opts: {
  center: { lat: number; lng: number } | null;
  routePath?: Array<{ lat: number; lng: number }> | null;
  memberId: string | null;
  memberName: string | null;
  /** Kept for API compatibility; household reports are disabled. */
  householdId?: string | null;
  radiusKm?: number;
  limit?: number;
}): Promise<FamilyDriveEvent[]> {
  const center = opts.center;
  if (!center) return [];

  const out: FamilyDriveEvent[] = [];
  const radiusKm = opts.radiusKm ?? 18;
  const limit = opts.limit ?? 8;

  const tasks: Array<Promise<FamilyDriveEvent[]>> = [];

  // Ontario Traveller Information — free, no key; skip fetch outside coverage.
  if (inOntarioCoverage(center.lat, center.lng)) {
    tasks.push(
      (async () => {
        try {
          const all = await fetchOntario511Events();
          const near = filterOntario511Near(all, {
            center,
            routePath: opts.routePath,
            radiusKm,
            limit,
          });
          return ontario511ToDriveEvents(near, {
            memberId: opts.memberId,
            memberName: opts.memberName,
          });
        } catch {
          return [];
        }
      })()
    );
  }

  // Ticketmaster concerts / sports / shows (optional API key).
  tasks.push(
    fetchTicketmasterEventsNear({
      center,
      memberId: opts.memberId,
      memberName: opts.memberName,
      radiusKm: Math.max(radiusKm, 25),
      limit: 4,
    }).catch(() => [])
  );

  const batches = await Promise.all(tasks);
  for (const batch of batches) out.push(...batch);

  // Prefer official roads, then Ticketmaster.
  const rank = (e: FamilyDriveEvent) => {
    if (e.id.startsWith("on511-")) return 0;
    if (e.id.startsWith("tm-")) return 1;
    return 2;
  };
  out.sort((a, b) => rank(a) - rank(b) || (a.distanceAheadKm ?? 99) - (b.distanceAheadKm ?? 99));

  const seen = new Set<string>();
  return out.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}
