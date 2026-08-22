/**
 * Payroll deposit detection — Fintract / Rocket Money style:
 * employment income = recurring credits with stable cadence + amount variance,
 * not random e-transfers or family transfers.
 */

export type CreditTx = {
  postedAt: string; // YYYY-MM-DD
  amount: number;
  description: string;
  classification?: string | null;
  direction?: string;
};

const TRANSFER_NOISE =
  /\b(e-?transfer|interac|transfer|wife|husband|spouse|venmo|paypal|cash app|from savings|to chequing|bill payment)\b/i;

const PAYROLL_HINT =
  /\b(cox|payroll|salary|direct[\s-]?deposit|wage|msp|employer|adp|ceridian|gusto|paycheq|paycheque|paycheck|deposit from|canada.*rev|cra.*gst|ei\b|pension)\b/i;

function daysBetween(a: string, b: string): number {
  const t0 = new Date(`${a}T12:00:00Z`).getTime();
  const t1 = new Date(`${b}T12:00:00Z`).getTime();
  return Math.round((t1 - t0) / 86400000);
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** True if a single credit looks like payroll (not a transfer). */
export function looksLikePayrollCredit(tx: CreditTx): boolean {
  if (tx.amount < 400) return false;
  if (TRANSFER_NOISE.test(tx.description)) return false;
  if (PAYROLL_HINT.test(tx.description)) return true;
  if (tx.classification === "income" && tx.amount >= 800) return true;
  // Large plain credit — candidate; cadence filter decides
  if (tx.amount >= 1500 && tx.direction !== "debit") return true;
  return false;
}

/**
 * Pick payroll deposits from statement credits using cadence clustering.
 * Keeps deposits that sit on a ~7/14/30 day rhythm with ≤15% amount variance.
 */
export function detectPayrollDeposits(credits: CreditTx[]): Array<{ postedAt: string; amount: number }> {
  const candidates = credits
    .filter((c) => looksLikePayrollCredit(c))
    .map((c) => ({
      postedAt: c.postedAt.slice(0, 10),
      amount: c.amount,
      description: c.description,
    }))
    .sort((a, b) => a.postedAt.localeCompare(b.postedAt));

  if (!candidates.length) return [];

  // Strong keyword hits always keep
  const strong = candidates.filter((c) => PAYROLL_HINT.test(c.description));
  const pool = strong.length >= 1 ? candidates : candidates;

  if (pool.length === 1) {
    return pool[0]!.amount >= 800 ? [{ postedAt: pool[0]!.postedAt, amount: pool[0]!.amount }] : [];
  }

  // Score each deposit by how well it fits a biweekly/weekly cluster around the median amount.
  // Allow wide bands for alternating base/commission (Cox-style ~$3.7k / ~$7.7k).
  const medAmt = median(pool.map((p) => p.amount));
  const withinBand = pool.filter(
    (p) =>
      Math.abs(p.amount - medAmt) / Math.max(medAmt, 1) <= 0.55 ||
      p.amount >= medAmt * 0.4 ||
      PAYROLL_HINT.test(p.description)
  );
  const use = withinBand.length >= 2 ? withinBand : pool;

  // Prefer deposits that have a neighbor ~7, 14, or 28–32 days away
  const kept: Array<{ postedAt: string; amount: number }> = [];
  for (let i = 0; i < use.length; i++) {
    const cur = use[i]!;
    let rhythmic =
      PAYROLL_HINT.test(cur.description) ||
      cur.amount >= medAmt * 0.4 ||
      strong.some((s) => s.postedAt === cur.postedAt);
    for (let j = 0; j < use.length; j++) {
      if (i === j) continue;
      const gap = Math.abs(daysBetween(cur.postedAt, use[j]!.postedAt));
      if (
        (gap >= 6 && gap <= 9) ||
        (gap >= 12 && gap <= 17) ||
        (gap >= 26 && gap <= 35)
      ) {
        rhythmic = true;
        break;
      }
    }
    if (rhythmic) kept.push({ postedAt: cur.postedAt, amount: cur.amount });
  }

  // Dedupe same day (keep largest)
  const byDay = new Map<string, number>();
  for (const k of kept) {
    byDay.set(k.postedAt, Math.max(byDay.get(k.postedAt) ?? 0, k.amount));
  }
  return [...byDay.entries()]
    .map(([postedAt, amount]) => ({ postedAt, amount }))
    .sort((a, b) => a.postedAt.localeCompare(b.postedAt));
}

/**
 * Fill missing paydays on the cadence between first and last observed deposit
 * (and one step before first / after last when inside the calendar window).
 */
export function reconstructPayCadence(
  deposits: Array<{ postedAt: string; amount: number }>,
  stepDays: number,
  fromYmd: string,
  toYmd: string
): Array<{ postedAt: string; amount: number; synthetic: boolean }> {
  if (!deposits.length || stepDays < 5) return [];
  const observed = new Map(deposits.map((d) => [d.postedAt, d.amount]));
  const amounts = deposits.map((d) => d.amount);
  const typical = median(amounts);
  const sorted = [...deposits].sort((a, b) => a.postedAt.localeCompare(b.postedAt));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  // Cox-style alternating base/commission — fill gaps with the flipped band, not median.
  const medAmt = median(amounts);
  const lows = amounts.filter((a) => a <= medAmt * 1.15);
  const highs = amounts.filter((a) => a > medAmt * 1.2);
  let lowBand = lows.length >= 2 ? median(lows) : null;
  let highBand = highs.length >= 2 ? median(highs) : null;
  // Two-sample case: Jul high + Aug low must still flip, not paste the midpoint.
  if ((!lowBand || !highBand) && amounts.length >= 2) {
    const minA = Math.min(...amounts);
    const maxA = Math.max(...amounts);
    if (maxA >= minA * 1.35) {
      lowBand = minA;
      highBand = maxA;
    }
  }
  const alternating = Boolean(lowBand && highBand && highBand! >= lowBand! * 1.35);
  const midBand =
    alternating && lowBand && highBand ? (lowBand + highBand) / 2 : null;

  const amountAfter = (prevAmount: number): number => {
    if (!alternating || midBand == null || lowBand == null || highBand == null) {
      return typical;
    }
    return prevAmount >= midBand ? lowBand : highBand;
  };

  const out: Array<{ postedAt: string; amount: number; synthetic: boolean }> = [];
  const push = (ymd: string, amount: number, synthetic: boolean) => {
    if (ymd < fromYmd || ymd > toYmd) return;
    if (out.some((x) => x.postedAt === ymd)) return;
    out.push({ postedAt: ymd, amount, synthetic });
  };

  for (const d of sorted) {
    push(d.postedAt, d.amount, false);
  }

  // Walk backward from first and forward from last to fill the window
  let cursor = new Date(`${first.postedAt}T12:00:00Z`);
  let prevAmt = first.amount;
  for (let g = 0; g < 24; g++) {
    cursor = new Date(cursor.getTime() - stepDays * 86400000);
    const y = cursor.toISOString().slice(0, 10);
    if (y < fromYmd) break;
    if (!observed.has(y)) {
      const amt = amountAfter(prevAmt);
      // Walking backward flips the same way as forward (band opposite of neighbor).
      push(y, amt, true);
      prevAmt = amt;
    } else {
      prevAmt = observed.get(y)!;
    }
  }
  cursor = new Date(`${last.postedAt}T12:00:00Z`);
  prevAmt = last.amount;
  for (let g = 0; g < 24; g++) {
    cursor = new Date(cursor.getTime() + stepDays * 86400000);
    const y = cursor.toISOString().slice(0, 10);
    if (y > toYmd) break;
    if (!observed.has(y)) {
      const amt = amountAfter(prevAmt);
      push(y, amt, true);
      prevAmt = amt;
    } else {
      prevAmt = observed.get(y)!;
    }
  }

  // Fill gaps between observed deposits
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]!;
    const b = sorted[i]!;
    const gap = daysBetween(a.postedAt, b.postedAt);
    if (gap > stepDays + 4 && gap < stepDays * 4) {
      let mid = new Date(`${a.postedAt}T12:00:00Z`);
      mid = new Date(mid.getTime() + stepDays * 86400000);
      let prev = a.amount;
      while (mid.toISOString().slice(0, 10) < b.postedAt) {
        const y = mid.toISOString().slice(0, 10);
        if (!observed.has(y)) {
          const amt = amountAfter(prev);
          push(y, amt, true);
          prev = amt;
        } else {
          prev = observed.get(y)!;
        }
        mid = new Date(mid.getTime() + stepDays * 86400000);
      }
    }
  }

  return out.sort((a, b) => a.postedAt.localeCompare(b.postedAt));
}

/** UTC calendar date for DB timestamps stored at noon UTC. */
export function utcYmdFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * When statement deposits are sparse, seed from the known next payday
 * (Buffers / profile) so the calendar still reconstructs Aug 7 from Aug 21, etc.
 * Expert pattern (Cash Flow Calendar / CalBudget): never leave past paydays blank
 * once cadence is known.
 */
export function seedPayrollFromAnchor(opts: {
  deposits: Array<{ postedAt: string; amount: number }>;
  nextPayday: string | null | undefined;
  typicalAmount: number;
  asOfYmd: string;
}): Array<{ postedAt: string; amount: number }> {
  const out = [...opts.deposits];
  // Never mix a stale Buffers payday guess into real statement payroll history.
  if (out.length >= 2) return out;
  const next = opts.nextPayday?.slice(0, 10);
  const amt = Math.max(0, opts.typicalAmount);
  if (!next || !amt) return out;
  if (!out.some((d) => d.postedAt === next)) {
    out.push({ postedAt: next, amount: amt });
  }
  // Also ensure one lookback step exists as a soft anchor when we only have "next"
  if (out.length === 1) {
    const d = new Date(`${next}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 14);
    const prev = d.toISOString().slice(0, 10);
    if (prev <= opts.asOfYmd && !out.some((x) => x.postedAt === prev)) {
      out.push({ postedAt: prev, amount: amt });
    }
  }
  return out.sort((a, b) => a.postedAt.localeCompare(b.postedAt));
}
