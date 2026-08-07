/**
 * Geofence alerts for saved household places (Life360-style enter / leave).
 * In-app notifications (map toasts + inbox). Lock-screen push can wrap createNotification later.
 */

import { prisma } from "@forward/database";
import { createNotification } from "@/lib/notifications";
import { wantsFamilyAlert } from "./alert-prefs";
import { isUnusuallyLateAtPlace } from "./normal-life";

const NOTIFY_COOLDOWN_MS = 3 * 60_000;
const STILL_THERE_COOLDOWN_MS = 6 * 60 * 60_000;
const lastNotifyAt = new Map<string, number>();

function cooledDown(key: string, ms: number) {
  const last = lastNotifyAt.get(key) ?? 0;
  if (Date.now() - last < ms) return false;
  lastNotifyAt.set(key, Date.now());
  return true;
}

/** Durable dedupe across serverless instances (in-memory Map alone is not enough). */
async function recentlyNotifiedSameAlert(opts: {
  type: string;
  title: string;
  withinMs: number;
}) {
  const since = new Date(Date.now() - opts.withinMs);
  const hit = await prisma.notification.findFirst({
    where: {
      type: opts.type,
      title: opts.title,
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  return Boolean(hit);
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
  if (opts.placeId) {
    const place = await prisma.familyPlace.findUnique({
      where: { id: opts.placeId },
      select: { notifyOnEnter: true, notifyOnLeave: true },
    });
    if (place) {
      if (opts.kind === "arrived" && place.notifyOnEnter === false) return;
      if (opts.kind === "departed" && place.notifyOnLeave === false) return;
    }
  }

  const key = `${opts.householdId}:${opts.kind}:${opts.actorMemberId}:${opts.placeName}`;
  if (!cooledDown(key, NOTIFY_COOLDOWN_MS)) return;

  const title =
    opts.kind === "arrived"
      ? `${opts.actorDisplayName} arrived at ${opts.placeName}`
      : `${opts.actorDisplayName} left ${opts.placeName}`;

  const type =
    opts.kind === "arrived" ? "family_geofence_enter" : "family_geofence_leave";

  // Concurrent GPS ingest (or trip-end + geofence enter) used to fire twice.
  if (await recentlyNotifiedSameAlert({ type, title, withinMs: NOTIFY_COOLDOWN_MS })) {
    return;
  }

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

  await Promise.all(
    members.map((m) => {
      if (!m.userId) return Promise.resolve(null);
      if (m.id === opts.actorMemberId) return Promise.resolve(null);
      if (!wantsFamilyAlert(m, prefKind)) return Promise.resolve(null);
      return createNotification({
        userId: m.userId,
        type,
        title,
        body,
        href: "/family-map",
      });
    })
  );
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

  if (
    await recentlyNotifiedSameAlert({
      type: "family_geofence_still_there",
      title,
      withinMs: STILL_THERE_COOLDOWN_MS,
    })
  ) {
    return;
  }

  const members = await prisma.familyMember.findMany({
    where: {
      householdId: opts.householdId,
      isSimulated: false,
      userId: { not: null },
    },
    select: { id: true, userId: true, alertStillThere: true },
  });

  await Promise.all(
    members.map((m) => {
      if (!m.userId || m.id === opts.actorMemberId) return Promise.resolve(null);
      if (!wantsFamilyAlert(m, "still_there")) return Promise.resolve(null);
      return createNotification({
        userId: m.userId,
        type: "family_geofence_still_there",
        title,
        body,
        href: "/family-map",
      });
    })
  );
}
