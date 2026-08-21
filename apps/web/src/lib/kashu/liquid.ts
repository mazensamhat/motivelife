/**
 * Prefer a statement/ledger-backed checking balance when Buffers is empty, zeroed,
 * or stuck on a stale overdraft. Timing was inventing −$6k troughs from liquid=$0/−$955
 * while Jul statements closed near +$4.5k.
 *
 * Important: a statement *closing* balance is only valid on that close date.
 * If the close is days/weeks before asOf and no newer txs exist, roll known
 * payroll + obligations forward so Timing does not treat Jul 31 cash as "today".
 */

export function chooseLiquidBalance(
  profileLiquid: number | null,
  derived: number | null
): { liquid: number | null; source: "profile" | "ledger" | "none" } {
  if (derived == null) {
    return {
      liquid: profileLiquid,
      source: profileLiquid != null ? "profile" : "none",
    };
  }
  const rounded = Math.round(derived * 100) / 100;
  if (profileLiquid == null) return { liquid: rounded, source: "ledger" };
  if (profileLiquid === 0 && rounded > 250) return { liquid: rounded, source: "ledger" };
  if (profileLiquid < 0 && rounded >= 0 && rounded - profileLiquid >= 500) {
    return { liquid: rounded, source: "ledger" };
  }
  return { liquid: profileLiquid, source: "profile" };
}

/** Inclusive calendar-day gap (UTC noon keys). */
export function daysBetweenYmd(a: string, b: string): number {
  const t0 = new Date(`${a}T12:00:00Z`).getTime();
  const t1 = new Date(`${b}T12:00:00Z`).getTime();
  return Math.round((t1 - t0) / 86400000);
}

/**
 * Roll an opening balance from the day AFTER `anchorYmd` through the day BEFORE `asOfYmd`.
 * `events` are signed (+income / −obligation). Events on asOf itself are excluded
 * (asOf morning balance is before today's posts).
 */
export function rollBalanceToAsOf(opts: {
  opening: number;
  anchorYmd: string;
  asOfYmd: string;
  events: Array<{ date: string; amount: number }>;
}): number {
  let bal = opts.opening;
  const sorted = [...opts.events].sort(
    (a, b) => a.date.localeCompare(b.date) || a.amount - b.amount
  );
  for (const ev of sorted) {
    if (ev.date <= opts.anchorYmd) continue;
    if (ev.date >= opts.asOfYmd) continue;
    bal += ev.amount;
  }
  return Math.round(bal * 100) / 100;
}
