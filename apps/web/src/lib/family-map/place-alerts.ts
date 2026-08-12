/**
 * Geofence alerts for saved household places (Life360-style enter / leave).
 * Durable atomic claim so dual ingest can't fire the same leave 5×.
 */

import { prisma } from "@forward/database";
import { createNotification } from "@/lib/notifications";
import { wantsFamilyAlert } from "./alert-prefs";
import { isUnusuallyLateAtPlace } from "./normal-life";

/** One arrive/leave per place+member within this window (dual native+web ingest). */
const NOTIFY_COOLDOWN_MS = 75 * 60_000;
/** Mid-shift GPS flaps at Work — suppress re-arrive after a recent leave. */
const REENTER_SUPPRESS_WORK_MS = 5 * 60 * 60_000;
const REENTER_SUPPRESS_HOME_MS = 2 * 60 * 60_000;
const REENTER_SUPPRESS_DEFAULT_MS = 90 * 60_000;
const STILL_THERE_COOLDOWN_MS = 6 * 60 * 60_000;
const lastNotifyAt = new Map<string, number>();

function cooledDown(key: string, ms: number) {
  const last = lastNotifyAt.get(key) ?? 0;
  if (Date.now() - last < ms) return false;
  lastNotifyAt.set(key, Date.now());
  return true;
}

/**
 * Atomically claim a household geofence alert before fan-out.
 * Uses a hidden claim row so concurrent GPS posts can't each notify.
 * Returns false if another instance already claimed this window.
 */
async function claimGeofenceAlert(opts: {
  claimUserId: string;
  type: string;
  dedupeKey: string;
  withinMs: number;
}): Promise<boolean> {
  const since = new Date(Date.now() - opts.withinMs);
  const claimTitle = `geofence-claim:${opts.dedupeKey}`.slice(0, 180);

  try {
    const existing = await prisma.notification.findFirst({
      where: {
        type: opts.type,
        title: claimTitle,
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (existing) return false;

    // Second check via create — if two races insert, both may succeed without a
    // unique constraint, so re-count immediately and only the earliest wins.
    const created = await prisma.notification.create({
      data: {
        userId: opts.claimUserId,
        type: opts.type,
        title: claimTitle,
        body: "__geofence_dedupe_claim__",
        href: null,
        readAt: new Date(),
      },
      select: { id: true, createdAt: true },
    });

    const peers = await prisma.notification.findMany({
      where: {
        type: opts.type,
        title: claimTitle,
        createdAt: { gte: since },
      },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 8,
    });
    const winner = peers[0];
    if (winner && winner.id !== created.id) {
      // We lost the race — delete our claim row and bail.
      await prisma.notification.delete({ where: { id: created.id } }).catch(() => null);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function notifyHouseholdPlaceTransition(opts: {
  householdId: string;
  actorMemberId: string;
  actorDisplayName: string;
  placeName: string;
  placeId?: string | null;
  kind: "arrived" | "departed";
  dwellMinutes?: number | null;
}) {
  let placeCategory: string | null = null;
  if (opts.placeId) {
    const place = await prisma.familyPlace.findUnique({
      where: { id: opts.placeId },
      select: { notifyOnEnter: true, notifyOnLeave: true, category: true },
    });
    if (place) {
      placeCategory = place.category ?? null;
      if (opts.kind === "arrived" && place.notifyOnEnter === false) return;
      if (opts.kind === "departed" && place.notifyOnLeave === false) return;
    }
  }

  // Re-enter after a brief GPS leave mid-shift → don't spam "arrived at Work".
  if (opts.kind === "arrived" && opts.placeId) {
    const cat = (placeCategory ?? "").toLowerCase();
    const suppressMs =
      cat === "work"
        ? REENTER_SUPPRESS_WORK_MS
        : cat === "home"
          ? REENTER_SUPPRESS_HOME_MS
          : REENTER_SUPPRESS_DEFAULT_MS;
    const recentLeave = await prisma.familyPlaceVisit.findFirst({
      where: {
        memberId: opts.actorMemberId,
        placeId: opts.placeId,
        isActive: false,
        departedAt: { gte: new Date(Date.now() - suppressMs) },
      },
      orderBy: { departedAt: "desc" },
      select: { id: true },
    });
    if (recentLeave) return;
  }

  const placeKey = opts.placeId?.trim() || opts.placeName.trim().toLowerCase();
  const key = `${opts.householdId}:${opts.kind}:${opts.actorMemberId}:${placeKey}`;
  const cooldown =
    opts.kind === "arrived" && (placeCategory ?? "").toLowerCase() === "work"
      ? Math.max(NOTIFY_COOLDOWN_MS, 3 * 60 * 60_000)
      : NOTIFY_COOLDOWN_MS;
  if (!cooledDown(key, cooldown)) return;

  const title =
    opts.kind === "arrived"
      ? `${opts.actorDisplayName} arrived at ${opts.placeName}`
      : `${opts.actorDisplayName} left ${opts.placeName}`;

  const type =
    opts.kind === "arrived" ? "family_geofence_enter" : "family_geofence_leave";

  const household = await prisma.familyHousehold.findUnique({
    where: { id: opts.householdId },
    select: { ownerUserId: true },
  });
  const claimUserId = household?.ownerUserId;
  if (!claimUserId) return;

  const claimed = await claimGeofenceAlert({
    claimUserId,
    type,
    dedupeKey: key,
    withinMs: cooldown,
  });
  if (!claimed) return;

  /** Omit absurd dwell (stale active-visit bugs) from leave copy. */
  function formatDwellPhrase(mins: number | null | undefined): string | null {
    if (mins == null || mins < 1) return null;
    // >16h almost always means a leftover open stay, not a real visit length.
    if (mins > 16 * 60) return null;
    if (mins >= 120) {
      const hours = Math.round(mins / 60);
      return `after about ${hours} hr`;
    }
    return `after about ${mins} min`;
  }

  const dwellPhrase =
    opts.kind === "departed" ? formatDwellPhrase(opts.dwellMinutes) : null;
  const body =
    opts.kind === "arrived"
      ? `Geofence · ${opts.actorDisplayName} entered ${opts.placeName}.`
      : dwellPhrase
        ? `Geofence · ${opts.actorDisplayName} left ${opts.placeName} ${dwellPhrase}.`
        : `Geofence · ${opts.actorDisplayName} left ${opts.placeName}.`;

  const members = await prisma.familyMember.findMany({
    where: {
      householdId: opts.householdId,
      isSimulated: false,
      userId: { not: null },
    },
    select: {
      id: true,
      userId: true,
      alertArrive: true,
      alertLeave: true,
    },
  });

  const prefKind = opts.kind === "arrived" ? "arrive" : "leave";

  // Sequential fan-out — avoids stampeding push when many members.
  for (const m of members) {
    if (!m.userId) continue;
    if (m.id === opts.actorMemberId) continue;
    if (!wantsFamilyAlert(m, prefKind)) continue;
    await createNotification({
      userId: m.userId,
      type,
      title,
      body,
      href: "/family-map",
    });
  }
}

/**
 * “Hasn’t left yet” — still inside a geofence past the learned leave window.
 */
export async function notifyIfStillInsideGeofence(opts: {
  householdId: string;
  actorMemberId: string;
  actorDisplayName: string;
  placeId: string;
  placeName: string;
}) {
  const place = await prisma.familyPlace.findUnique({
    where: { id: opts.placeId },
    select: { notifyOnLeave: true },
  });
  // Reuse leave alert preference — if you care about leave, you care about “still there”
  if (place && place.notifyOnLeave === false) return;

  const late = await isUnusuallyLateAtPlace({
    memberId: opts.actorMemberId,
    placeName: opts.placeName,
    bufferMinutes: 30,
  });
  if (!late.unusual) return;

  const key = `${opts.householdId}:still:${opts.actorMemberId}:${opts.placeId}:${new Date().toDateString()}`;
  if (!cooledDown(key, STILL_THERE_COOLDOWN_MS)) return;

  const usual = late.usualLeaveLabel ? ` (usually leaves around ${late.usualLeaveLabel})` : "";
  const title = `${opts.actorDisplayName} hasn’t left ${opts.placeName}`;
  const body = `Geofence · Still at ${opts.placeName}${usual}.`;

  const household = await prisma.familyHousehold.findUnique({
    where: { id: opts.householdId },
    select: { ownerUserId: true },
  });
  if (!household?.ownerUserId) return;

  const claimed = await claimGeofenceAlert({
    claimUserId: household.ownerUserId,
    type: "family_geofence_still_there",
    dedupeKey: key,
    withinMs: STILL_THERE_COOLDOWN_MS,
  });
  if (!claimed) return;

  const members = await prisma.familyMember.findMany({
    where: {
      householdId: opts.householdId,
      isSimulated: false,
      userId: { not: null },
    },
    select: { id: true, userId: true, alertStillThere: true },
  });

  for (const m of members) {
    if (!m.userId || m.id === opts.actorMemberId) continue;
    if (!wantsFamilyAlert(m, "still_there")) continue;
    await createNotification({
      userId: m.userId,
      type: "family_geofence_still_there",
      title,
      body,
      href: "/family-map",
    });
  }
}
