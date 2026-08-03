/**
 * Arrival / departure alerts for saved household places.
 * In-app notifications first (lock-screen push comes later via Expo).
 */

import { prisma } from "@forward/database";
import { createNotification } from "@/lib/notifications";

const NOTIFY_COOLDOWN_MS = 3 * 60_000;
const lastNotifyAt = new Map<string, number>();

export async function notifyHouseholdPlaceTransition(opts: {
  householdId: string;
  actorMemberId: string;
  actorDisplayName: string;
  placeName: string;
  kind: "arrived" | "departed";
  dwellMinutes?: number | null;
}) {
  const key = `${opts.householdId}:${opts.kind}:${opts.actorMemberId}:${opts.placeName}`;
  const last = lastNotifyAt.get(key) ?? 0;
  if (Date.now() - last < NOTIFY_COOLDOWN_MS) return;
  lastNotifyAt.set(key, Date.now());

  const title =
    opts.kind === "arrived"
      ? `${opts.actorDisplayName} arrived at ${opts.placeName}`
      : `${opts.actorDisplayName} left ${opts.placeName}`;
  const body =
    opts.kind === "arrived"
      ? `${opts.actorDisplayName} is at ${opts.placeName}.`
      : opts.dwellMinutes != null && opts.dwellMinutes > 0
        ? `${opts.actorDisplayName} left ${opts.placeName} after about ${opts.dwellMinutes} min.`
        : `${opts.actorDisplayName} left ${opts.placeName}.`;

  const members = await prisma.familyMember.findMany({
    where: {
      householdId: opts.householdId,
      isSimulated: false,
      userId: { not: null },
    },
    select: { id: true, userId: true },
  });

  await Promise.all(
    members.map((m) => {
      if (!m.userId) return Promise.resolve(null);
      // Don't notify the person who just moved — they already know.
      if (m.id === opts.actorMemberId) return Promise.resolve(null);
      return createNotification({
        userId: m.userId,
        type: opts.kind === "arrived" ? "family_place_arrive" : "family_place_depart",
        title,
        body,
        href: "/family-map",
      });
    })
  );
}
