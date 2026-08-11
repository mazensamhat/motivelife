/**
 * Confirm place enter/exit over time so GPS edge jitter can't flap
 * arrive/leave notifications and poison Family Intelligence learning.
 *
 * Pure in-memory — no extra GPS, no battery cost. Resets on cold server.
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

export function resetPlaceTransitionPending(memberId: string) {
  pendingByMember.delete(memberId);
}

/**
 * Hold the current place until the desired place has been stable long enough.
 * desiredId null = outside every saved fence (after exit hysteresis).
 */
export function confirmPlaceTransition(opts: {
  memberId: string;
  currentPlaceId: string | null;
  desiredPlaceId: string | null;
  nowMs?: number;
}): { placeId: string | null; changed: boolean } {
  const now = opts.nowMs ?? Date.now();
  const current = opts.currentPlaceId;
  const desired = opts.desiredPlaceId;

  if (desired === current) {
    pendingByMember.delete(opts.memberId);
    return { placeId: current, changed: false };
  }

  const pending = pendingByMember.get(opts.memberId);
  if (!pending || pending.desiredId !== desired) {
    pendingByMember.set(opts.memberId, { desiredId: desired, sinceMs: now });
    // Hold sticky current until confirmed — stops mall enter/leave spam.
    return { placeId: current, changed: false };
  }

  const needMs =
    desired == null ? PLACE_EXIT_CONFIRM_MS : PLACE_ENTER_CONFIRM_MS;
  if (now - pending.sinceMs < needMs) {
    return { placeId: current, changed: false };
  }

  pendingByMember.delete(opts.memberId);
  return { placeId: desired, changed: true };
}
