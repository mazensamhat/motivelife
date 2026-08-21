/**
 * Prefer a statement/ledger-backed checking balance when Buffers is empty, zeroed,
 * or stuck on a stale overdraft. Timing was inventing −$6k troughs from liquid=$0/−$955
 * while Jul statements closed near +$4.5k.
 *
 * Important: a statement *closing* balance is only valid on that close date.
 * If the close is days/weeks before asOf and no newer txs exist, roll known
 * payroll + obligations forward so Timing does not treat Jul 31 cash as "today".
 *
 * Explicit positive Buffers entries are trusted — the user typed what the bank
 * shows now. Only reject clearly absurd auto-persisted figures (e.g. ~$14k+
 * double-count) so we never wipe a real $6–7k balance the user just saved.
 */

import { isCommitmentType } from "@forward/shared";
import {
  isTimingExcludedItem,
  obligationDatesInRange,
  type KashuMoneyRow,
} from "./forecast";

// Prefer statement ledger when Buffers is empty, zeroed, overdrawn, or a clearly
// absurd stale inflate vs the ledger (auto-persisted double-count class).
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
  // Absurd stale Buffers only (e.g. ~$14k double-count while ledger is ~$1–5k).
  // Do NOT steal a normal user-entered balance like $6,984.61.
  if (rounded > 0 && profileLiquid >= 10000 && profileLiquid - rounded >= 5000) {
    return { liquid: rounded, source: "ledger" };
  }
  if (rounded > 500 && profileLiquid >= 12000 && profileLiquid > rounded * 2) {
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

/** Build signed cash events (payroll +, bills −, plus real window txs) to roll a statement close to asOf. */
export function buildRollForwardEvents(opts: {
  items: KashuMoneyRow[];
  payroll: Array<{ date: string; amount: number }>;
  fromYmd: string;
  toYmd: string;
  /** Real posted txs in (from, to) — includes e-transfers Timing excludes. */
  windowTxs?: Array<{ date: string; amount: number; direction: string }>;
}): Array<{ date: string; amount: number }> {
  const from = new Date(`${opts.fromYmd}T12:00:00`);
  const to = new Date(`${opts.toYmd}T12:00:00`);
  const events: Array<{ date: string; amount: number }> = [];
  const coveredKeys = new Set<string>();

  // Same-day payroll-sized credits: keep one so window txs + cadence never double-count
  // when OCR amounts differ by a few cents from reconstructed pay.
  const creditDayCovered = new Set<string>();

  for (const tx of opts.windowTxs ?? []) {
    if (tx.date <= opts.fromYmd || tx.date >= opts.toYmd) continue;
    const signed = tx.direction === "credit" ? Math.abs(tx.amount) : -Math.abs(tx.amount);
    if (tx.direction === "credit" && Math.abs(tx.amount) >= 400) {
      if (creditDayCovered.has(tx.date)) continue;
      creditDayCovered.add(tx.date);
    }
    events.push({ date: tx.date, amount: signed });
    coveredKeys.add(`${tx.date}:${Math.round(Math.abs(tx.amount))}`);
  }

  for (const p of opts.payroll) {
    if (p.date > opts.fromYmd && p.date < opts.toYmd && p.amount > 0) {
      if (creditDayCovered.has(p.date)) continue;
      const key = `${p.date}:${Math.round(p.amount)}`;
      if (coveredKeys.has(key)) continue;
      events.push({ date: p.date, amount: p.amount });
      coveredKeys.add(key);
      creditDayCovered.add(p.date);
    }
  }

  for (const item of opts.items) {
    if (isTimingExcludedItem(item)) continue;
    if (!isCommitmentType(item.type) && item.type !== "DEBT" && item.type !== "HOUSING") {
      if (item.type !== "SUBSCRIPTION" && item.type !== "BILL") continue;
    }
    const dates = obligationDatesInRange(item, from, to);
    for (const d of dates) {
      const y = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (y > opts.fromYmd && y < opts.toYmd) {
        const key = `${y}:${Math.round(Math.abs(item.currentAmount))}`;
        if (coveredKeys.has(key)) continue;
        events.push({ date: y, amount: -Math.abs(item.currentAmount) });
        coveredKeys.add(key);
      }
    }
  }
  return events;
}
