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

function weekdayUtc(ymdStr: string): number {
  return new Date(`${ymdStr}T12:00:00Z`).getUTCDay();
}

/** Friday wins Fri/Sat ties — banks often post Friday pay on Saturday. */
function inferPayWeekday(deposits: PayDeposit[]): number | null {
  if (deposits.length < 2) return null;
  const counts = new Map<number, number>();
  for (const d of deposits) {
    const w = weekdayUtc(d.postedAt);
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  let best = -1;
  let bestCount = 0;
  for (const [w, c] of counts) {
    if (
      c > bestCount ||
      (c === bestCount && w === 5 && best === 6) // prefer Friday over Saturday
    ) {
      best = w;
      bestCount = c;
    }
  }
  return best >= 0 ? best : null;
}

/** Nudge Sat/Sun bank posts back to the prior cadence weekday when gap is ~1 day late. */
function normalizeDepositWeekdays(
  deposits: PayDeposit[],
  anchorWeekday: number | null
): PayDeposit[] {
  if (anchorWeekday == null || deposits.length < 2) return deposits;
  const out: PayDeposit[] = [];
  for (let i = 0; i < deposits.length; i++) {
    const cur = deposits[i]!;
    let postedAt = cur.postedAt;
    const w = weekdayUtc(postedAt);
    if (w !== anchorWeekday && (w === 6 || w === 0) && anchorWeekday === 5) {
      const prev = out[out.length - 1] ?? deposits[i - 1];
      if (prev) {
        const gap = Math.round(
          (new Date(`${postedAt}T12:00:00Z`).getTime() -
            new Date(`${prev.postedAt}T12:00:00Z`).getTime()) /
            86400000
        );
        if (gap >= 6 && gap <= 16) {
          const d = new Date(`${postedAt}T12:00:00Z`);
          d.setUTCDate(d.getUTCDate() - (w === 6 ? 1 : 2));
          postedAt = ymd(d);
        }
      }
    }
    out.push({ ...cur, postedAt });
  }
  return out;
}

function snapDateToWeekday(d: Date, weekday: number): Date {
  const cur = d.getUTCDay();
  let delta = weekday - cur;
  if (delta > 3) delta -= 7;
  if (delta < -3) delta += 7;
  return addDays(d, delta);
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
  const anchorWeekday = inferPayWeekday(deposits);
  const normalized = normalizeDepositWeekdays(deposits, anchorWeekday);
  const sorted = [...normalized]
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

  // Keep payday on the historical weekday (Friday pay shouldn't drift to Saturday
  // because one deposit posted a day late).
  if (
    anchorWeekday != null &&
    (payFrequency === "WEEKLY" || payFrequency === "BIWEEKLY")
  ) {
    next = snapDateToWeekday(next, anchorWeekday);
    while (next.getTime() <= todayUtc.getTime()) {
      next = addDays(next, step);
      next = snapDateToWeekday(next, anchorWeekday);
    }
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
