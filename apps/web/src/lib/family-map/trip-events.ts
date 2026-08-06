/**
 * Household fan-out for completed drives.
 * In-process handlers first — Redis / queues can wrap this later.
 */
import { prisma } from "@forward/database";
import { createNotification } from "@/lib/notifications";
import { wantsFamilyAlert } from "./alert-prefs";

const NOTIFY_COOLDOWN_MS = 90_000;
const lastNotifyAt = new Map<string, number>();

function cooledDown(key: string, ms: number) {
  const last = lastNotifyAt.get(key) ?? 0;
  if (Date.now() - last < ms) return false;
  lastNotifyAt.set(key, Date.now());
  return true;
}

export type TripEndedPayload = {
  householdId: string;
  actorMemberId: string;
  actorDisplayName: string;
  userId: string | null;
  tripId: string;
  fromLabel: string | null;
  toLabel: string;
  distanceKm: number;
  durationMinutes: number;
  driveScore: number | null;
  estimatedFuelCostCad: number | null;
  endedAt: Date;
  shareDrivingData: boolean;
};

/**
 * Notify other household members that a drive finished.
 * Respects shareDrivingData — if the driver opted out of driving share, skip.
 */
export async function notifyHouseholdTripEnded(opts: TripEndedPayload): Promise<void> {
  if (!opts.shareDrivingData) return;

  const key = `${opts.householdId}:trip_ended:${opts.actorMemberId}:${opts.tripId}`;
  if (!cooledDown(key, NOTIFY_COOLDOWN_MS)) return;

  const mins = Math.max(1, Math.round(opts.durationMinutes));
  const km = opts.distanceKm >= 10 ? opts.distanceKm.toFixed(0) : opts.distanceKm.toFixed(1);
  const scoreBit =
    opts.driveScore != null ? ` · Drive Score ${Math.round(opts.driveScore)}` : "";
  const title = `${opts.actorDisplayName} arrived at ${opts.toLabel}`;
  const body = `Drive · ${km} km · ${mins} min${scoreBit}`;

  const members = await prisma.familyMember.findMany({
    where: {
      householdId: opts.householdId,
      isSimulated: false,
      userId: { not: null },
    },
    select: { id: true, userId: true, alertDriving: true },
  });

  await Promise.all(
    members.map((m) => {
      if (!m.userId) return Promise.resolve(null);
      if (m.id === opts.actorMemberId) return Promise.resolve(null);
      if (!wantsFamilyAlert(m, "driving")) return Promise.resolve(null);
      return createNotification({
        userId: m.userId,
        type: "family_trip_ended",
        title,
        body,
        href: "/family-map",
      });
    })
  );
}
