/** Calendar-day keys for health metrics — must match the user's local day, not UTC midnight on Vercel. */

export function localDayKey(d: Date = new Date(), timeZone?: string): string {
  if (timeZone) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    } catch {
      /* fall through */
    }
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Prefer YYYY-MM-DD embedded in externalId (set at sync from the user's local day). */
export function metricLocalDayKey(externalId: string | null | undefined, periodStart: Date): string {
  const m = externalId?.match(/(\d{4}-\d{2}-\d{2})$/);
  if (m?.[1]) return m[1];
  return periodStart.toISOString().slice(0, 10);
}

export function requestTimeZone(request?: Request | null): string | undefined {
  if (!request) return undefined;
  const tz =
    request.headers.get("x-timezone")?.trim() ||
    request.headers.get("x-vercel-ip-timezone")?.trim() ||
    undefined;
  return tz || undefined;
}

export function clientTimeZone(): string | undefined {
  if (typeof Intl === "undefined") return undefined;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}
