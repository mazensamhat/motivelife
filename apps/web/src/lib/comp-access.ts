export type CompProDuration = "month" | "year" | "forever";

export function computeProExpiresAt(duration: CompProDuration, from = new Date()): Date | null {
  if (duration === "forever") return null;
  const d = new Date(from);
  if (duration === "month") {
    d.setMonth(d.getMonth() + 1);
  } else {
    d.setFullYear(d.getFullYear() + 1);
  }
  return d;
}

export function formatCompProExpiry(proExpiresAt: Date | string | null | undefined): string {
  if (!proExpiresAt) return "Forever";
  const d = typeof proExpiresAt === "string" ? new Date(proExpiresAt) : proExpiresAt;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function compProDaysLeft(proExpiresAt: Date | string | null | undefined): number | null {
  if (!proExpiresAt) return null;
  const d = typeof proExpiresAt === "string" ? new Date(proExpiresAt) : proExpiresAt;
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export function isCompProExpired(
  proExpiresAt: Date | string | null | undefined,
  hasStripeSubscription: boolean
): boolean {
  if (hasStripeSubscription || !proExpiresAt) return false;
  const d = typeof proExpiresAt === "string" ? new Date(proExpiresAt) : proExpiresAt;
  return d.getTime() <= Date.now();
}
