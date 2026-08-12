/**
 * Confirm place enter/exit over time so GPS edge jitter can't flap
 * arrive/leave notifications and poison Family Intelligence learning.
 *
 * Pure in-memory — no extra GPS, no battery cost. Resets on cold server.
 * Callers must pass forceImmediate when displacement clearly proves leave
 * (serverless cold starts otherwise restart the exit clock forever).
 */

type PendingPlace = {
  desiredId: string | null;
  sinceMs: number;
};

const pendingByMember = new Map<string, PendingPlace>();

/** Must stay inside a new fence this long before we count an arrival. */
export const PLACE_ENTER_CONFIRM_MS = 55_000;
/** Must stay outside (exit buffer) this long before we count a departure. */
export const PLACE_EXIT_CONFIRM_MS = 45_000;
/** Work plants — GPS flaps mid-shift; wait longer before counting a leave. */
export const PLACE_EXIT_CONFIRM_WORK_MS = 150_000;
export const PLACE_EXIT_CONFIRM_HOME_MS = 90_000;

export function resetPlaceTransitionPending(memberId: string) {
  pendingByMember.delete(memberId);
}

/**
 * Hold the current place until the desired place has been stable long enough.
 * desiredId null = outside every saved fence (after exit hysteresis).
 *
 * forceImmediate: skip the dwell clock (far from fence / driving away).
 */
export function confirmPlaceTransition(opts: {
  memberId: string;
  currentPlaceId: string | null;
  desiredPlaceId: string | null;
  nowMs?: number;
  /** Skip confirm when GPS is clearly far from the sticky place. */
  forceImmediate?: boolean;
  /** Current sticky place category — work/home use longer exit confirms. */
  currentPlaceCategory?: string | null;
}): { placeId: string | null; changed: boolean } {
  const now = opts.nowMs ?? Date.now();
  const current = opts.currentPlaceId;
  const desired = opts.desiredPlaceId;

  if (desired === current) {
    pendingByMember.delete(opts.memberId);
    return { placeId: current, changed: false };
  }

  if (opts.forceImmediate) {
    pendingByMember.delete(opts.memberId);
    return { placeId: desired, changed: true };
  }

  const pending = pendingByMember.get(opts.memberId);
  if (!pending || pending.desiredId !== desired) {
    pendingByMember.set(opts.memberId, { desiredId: desired, sinceMs: now });
    // Hold sticky current until confirmed — stops mall enter/leave spam.
    return { placeId: current, changed: false };
  }

  const cat = (opts.currentPlaceCategory ?? "").toLowerCase();
  const needMs =
    desired == null
      ? cat === "work"
        ? PLACE_EXIT_CONFIRM_WORK_MS
        : cat === "home"
          ? PLACE_EXIT_CONFIRM_HOME_MS
          : PLACE_EXIT_CONFIRM_MS
      : PLACE_ENTER_CONFIRM_MS;
  if (now - pending.sinceMs < needMs) {
    return { placeId: current, changed: false };
  }

  pendingByMember.delete(opts.memberId);
  return { placeId: desired, changed: true };
}
