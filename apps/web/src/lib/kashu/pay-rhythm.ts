import type { KashuPayFrequency } from "@forward/shared";

export type PayDeposit = {
  postedAt: string; // YYYY-MM-DD
  amount: number;
};

export type PayRhythm = {
  typicalPaycheck: number;
  nextPayAmount: number;
  lastPayDate: string | null;
  nextPayday: string;
  payFrequency: KashuPayFrequency;
  /** Monthly take-home for burn / Safe-to-Spend math (not a single deposit). */
  monthlyTakeHome: number;
  sampleCount: number;
  /** Low / high bands when pay alternates (base vs commission week). */
  lowBand: number | null;
  highBand: number | null;
};

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function mean(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/**
 * Infer biweekly (etc.) paycheck rhythm from statement income deposits.
 * Handles Cox-style alternating base/commission weeks.
 */
export function derivePayRhythm(
  deposits: PayDeposit[],
  today: Date = new Date()
): PayRhythm | null {
  const sorted = [...deposits]
    .filter((d) => d.amount >= 200 && d.postedAt)
    .sort((a, b) => a.postedAt.localeCompare(b.postedAt));
  if (!sorted.length) return null;

  const amounts = sorted.map((d) => d.amount);
  const last = sorted[sorted.length - 1]!;

  let step = 14;
  let payFrequency: KashuPayFrequency = "BIWEEKLY";
  if (sorted.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const a = new Date(sorted[i - 1]!.postedAt + "T12:00:00Z").getTime();
      const b = new Date(sorted[i]!.postedAt + "T12:00:00Z").getTime();
      gaps.push(Math.round((b - a) / 86400000));
    }
    const avgGap = mean(gaps);
    if (avgGap >= 5 && avgGap <= 9) {
      step = 7;
      payFrequency = "WEEKLY";
    } else if (avgGap >= 11 && avgGap <= 18) {
      step = 14;
      payFrequency = "BIWEEKLY";
    } else if (avgGap >= 25 && avgGap <= 36) {
      step = 30;
      payFrequency = "MONTHLY";
    }
  }

  const med = median(amounts);
  const lows = amounts.filter((a) => a <= med * 1.15);
  const highs = amounts.filter((a) => a > med * 1.2);
  const lowBand = lows.length >= 2 ? median(lows) : null;
  const highBand =
    highs.length >= 2
      ? median(highs)
      : amounts.some((a) => a > med * 1.35)
        ? median(amounts.filter((a) => a > med))
        : null;

  const alternating = Boolean(lowBand && highBand && highBand! >= lowBand! * 1.35);
  // Prefer the most recent deposit in each band (matches statements exactly)
  let lastLow: number | null = null;
  let lastHigh: number | null = null;
  if (alternating && lowBand && highBand) {
    const mid = (lowBand + highBand) / 2;
    for (const d of sorted) {
      if (d.amount < mid) lastLow = d.amount;
      else lastHigh = d.amount;
    }
  }
  const stableAmount = lastLow && lastHigh
    ? (last.amount >= (lastLow + lastHigh) / 2 ? lastHigh : lastLow)
    : median(amounts.slice(-4));

  const factor =
    payFrequency === "WEEKLY"
      ? 4.33
      : payFrequency === "MONTHLY"
        ? 1
        : 2.17;
  const avgDeposit =
    lastLow && lastHigh ? (lastLow + lastHigh) / 2 : lowBand && highBand ? (lowBand + highBand) / 2 : med;
  const monthlyTakeHome = Math.round(avgDeposit * factor);

  const todayUtc = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 12)
  );

  // Walk forward from last deposit; flip band each step when alternating
  let next = new Date(last.postedAt + "T12:00:00Z");
  let onHigh =
    alternating && lastLow && lastHigh
      ? last.amount >= (lastLow + lastHigh) / 2
      : false;
  let expected = stableAmount;

  while (true) {
    next = addDays(next, step);
    if (alternating && lastLow && lastHigh) {
      onHigh = !onHigh;
      expected = onHigh ? lastHigh : lastLow;
    } else {
      expected = stableAmount;
    }
    if (next.getTime() > todayUtc.getTime()) break;
    // Guard: never walk into multi-year nonsense from a bad last.postedAt
    if (next.getUTCFullYear() > todayUtc.getUTCFullYear() + 1) {
      next = addDays(todayUtc, step);
      break;
    }
  }

  // Cap: next payday must be within ~2 pay cycles of today (biweekly ≈ 28d, monthly ≈ 60d)
  const maxAhead = payFrequency === "MONTHLY" ? 62 : payFrequency === "WEEKLY" ? 21 : 35;
  const aheadDays = Math.round((next.getTime() - todayUtc.getTime()) / 86400000);
  if (aheadDays > maxAhead || aheadDays < -7) {
    next = addDays(todayUtc, Math.min(Math.max(step, 1), maxAhead));
  }

  const typicalPaycheck = Math.round(expected * 100) / 100;

  return {
    typicalPaycheck,
    nextPayAmount: typicalPaycheck,
    lastPayDate: last.postedAt,
    nextPayday: ymd(next),
    payFrequency,
    monthlyTakeHome,
    sampleCount: sorted.length,
    lowBand: lastLow ? Math.round(lastLow * 100) / 100 : lowBand ? Math.round(lowBand * 100) / 100 : null,
    highBand: lastHigh ? Math.round(lastHigh * 100) / 100 : highBand ? Math.round(highBand * 100) / 100 : null,
  };
}

/** Prefer statement-derived deposit over monthly÷frequency. */
export function resolvePaycheckAmount(opts: {
  typicalPaycheck?: number | null;
  monthlyTakeHome?: number | null;
  payFrequency?: string | null;
}): number {
  if (opts.typicalPaycheck && opts.typicalPaycheck > 0) {
    return Math.round(opts.typicalPaycheck);
  }
  const monthly = Math.max(0, opts.monthlyTakeHome ?? 0);
  if (!monthly) return 0;
  const freq = (opts.payFrequency ?? "BIWEEKLY").toUpperCase();
  if (freq === "WEEKLY") return Math.round(monthly / 4.33);
  if (freq === "BIWEEKLY") return Math.round(monthly / 2.17);
  if (freq === "SEMI_MONTHLY") return Math.round(monthly / 2);
  // MONTHLY / IRREGULAR / unknown — if figure looks like monthly take-home
  // mistaken for a deposit (≥ $8k), treat as biweekly math.
  if (freq === "MONTHLY" || freq === "IRREGULAR") {
    if (monthly >= 8000) return Math.round(monthly / 2.17);
    return Math.round(monthly);
  }
  return Math.round(monthly / 2.17);
}
