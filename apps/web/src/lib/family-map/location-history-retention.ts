/**
 * Caps Family Map cloud history so GPS trails don't grow forever as households scale.
 *
 * - Breadcrumbs (FamilyLocationEvent): ~35 days (Month route maps)
 * - Trips + stays: 90 days on free live-map, 365 days with Family Intelligence
 * Active (in-progress) trips/stays are never pruned.
 */

import { prisma } from "@forward/database";
import { ownerHasActiveFamilyPlan } from "@/lib/family-map/entitlements";

/** GPS breadcrumbs — enough for Month history polylines. */
export const LOCATION_EVENT_RETENTION_DAYS = 35;
/** Drive summaries + place stays without MyMotiveFamily. */
export const LOCATION_TRIP_RETENTION_DAYS_FREE = 90;
/** Drive summaries + place stays with active Family Intelligence. */
export const LOCATION_TRIP_RETENTION_DAYS_FAMILY = 365;

export type LocationHistoryPruneResult = {
  trips: number;
  visits: number;
  events: number;
};

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60_000);
}

/** Prune one member’s finished history older than the keep windows. */
export async function pruneMemberLocationHistoryRetention(opts: {
  memberId: string;
  tripVisitKeepDays: number;
  eventKeepDays?: number;
}): Promise<LocationHistoryPruneResult> {
  const tripCutoff = daysAgo(Math.max(1, opts.tripVisitKeepDays));
  const eventCutoff = daysAgo(
    Math.max(1, opts.eventKeepDays ?? LOCATION_EVENT_RETENTION_DAYS)
  );

  const [trips, visits, events] = await prisma.$transaction([
    prisma.familyTrip.deleteMany({
      where: {
        memberId: opts.memberId,
        isActive: false,
        OR: [
          { endedAt: { not: null, lt: tripCutoff } },
          { endedAt: null, startedAt: { lt: tripCutoff } },
        ],
      },
    }),
    prisma.familyPlaceVisit.deleteMany({
      where: {
        memberId: opts.memberId,
        isActive: false,
        OR: [
          { departedAt: { not: null, lt: tripCutoff } },
          { departedAt: null, arrivedAt: { lt: tripCutoff } },
        ],
      },
    }),
    prisma.familyLocationEvent.deleteMany({
      where: {
        memberId: opts.memberId,
        recordedAt: { lt: eventCutoff },
      },
    }),
  ]);

  return {
    trips: trips.count,
    visits: visits.count,
    events: events.count,
  };
}

/**
 * Hot-path prune after a location ping — always use the Family (max) trip window
 * so we never delete Pro history on a billing blip. Free households get the
 * tighter 90-day cut from the daily cron.
 */
export async function pruneMemberLocationHistoryAfterIngest(
  memberId: string
): Promise<void> {
  try {
    await pruneMemberLocationHistoryRetention({
      memberId,
      tripVisitKeepDays: LOCATION_TRIP_RETENTION_DAYS_FAMILY,
      eventKeepDays: LOCATION_EVENT_RETENTION_DAYS,
    });
  } catch {
    // Soft-fail — live share must not break if prune races DDL.
  }
}

export type FamilyLocationRetentionCronResult = {
  households: number;
  members: number;
  trips: number;
  visits: number;
  events: number;
};

/**
 * Daily sweep: apply free vs Family keep windows for every real household member.
 */
export async function runFamilyLocationHistoryRetention(): Promise<FamilyLocationRetentionCronResult> {
  const result: FamilyLocationRetentionCronResult = {
    households: 0,
    members: 0,
    trips: 0,
    visits: 0,
    events: 0,
  };

  const households = await prisma.familyHousehold.findMany({
    select: {
      id: true,
      ownerUserId: true,
      members: {
        where: { isSimulated: false },
        select: { id: true },
      },
    },
  });

  for (const household of households) {
    result.households += 1;
    let keepDays = LOCATION_TRIP_RETENTION_DAYS_FREE;
    try {
      if (await ownerHasActiveFamilyPlan(household.ownerUserId)) {
        keepDays = LOCATION_TRIP_RETENTION_DAYS_FAMILY;
      }
    } catch {
      keepDays = LOCATION_TRIP_RETENTION_DAYS_FAMILY;
    }

    for (const member of household.members) {
      result.members += 1;
      try {
        const pruned = await pruneMemberLocationHistoryRetention({
          memberId: member.id,
          tripVisitKeepDays: keepDays,
          eventKeepDays: LOCATION_EVENT_RETENTION_DAYS,
        });
        result.trips += pruned.trips;
        result.visits += pruned.visits;
        result.events += pruned.events;
      } catch {
        // Continue other members
      }
    }
  }

  return result;
}
