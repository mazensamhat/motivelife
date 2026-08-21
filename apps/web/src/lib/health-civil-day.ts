/**
 * Civil calendar day helpers for health metrics.
 * Never use UTC `toISOString().slice(0,10)` for "today" — local midnight can land on the previous UTC date.
 */

/** Local civil YYYY-MM-DD for a Date. */
export function civilDayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local midnight for the civil day containing `d`. */
export function startOfCivilDay(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Parse a YYYY-MM-DD (or ISO) into local midnight. */
export function civilDayFromKey(key: string): Date {
  const ymd = key.slice(0, 10);
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

/** Days between two civil keys (a - b), signed. */
export function civilDayDiff(aKey: string, bKey: string): number {
  const a = civilDayFromKey(aKey).getTime();
  const b = civilDayFromKey(bKey).getTime();
  return Math.round((a - b) / 86400000);
}
