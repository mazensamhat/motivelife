import type {
  KashuBillWave,
  KashuCashStatus,
  KashuCollision,
  KashuDayProjection,
  KashuEmergencyInsight,
  KashuForecast,
  KashuIncomeKind,
  KashuIncomeScenario,
  KashuItemFrequency,
  KashuPayFrequency,
  KashuPriority,
  KashuRadarEvent,
  KashuTimingScenario,
  KashuWhatIfRequest,
  KashuWhatIfResult,
} from "@forward/shared";
import { isCommitmentType, monthlyFlowAmount } from "@forward/shared";
import { resolvePaycheckAmount } from "./pay-rhythm";

export type KashuMoneyRow = {
  id: string;
  type: string;
  title: string;
  currentAmount: number;
  targetAmount?: number | null;
  dueDay: number | null;
  autoPay: boolean;
  frequency: string | null;
  intervalDays: number | null;
  nextDueDate: Date | null;
  priority: string | null;
  confidence: number | null;
};

export type KashuProfileRow = {
  liquidBalance: number | null;
  safetyFloor: number | null;
  emergencyReserve: number | null;
  payFrequency: string | null;
  nextPayday: Date | null;
  paydayAnchorDay: number | null;
  lifestyleBurnDaily: number | null;
  monthlyTakeHome: number | null;
  typicalPaycheck?: number | null;
  /** Per-deposit low/high when pay alternates (statement-derived). */
  paycheckLow?: number | null;
  paycheckHigh?: number | null;
  incomeKind?: string | null;
  incomeConservative?: number | null;
  incomeHigh?: number | null;
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function statusFor(balance: number, floor: number): KashuCashStatus {
  if (balance < floor || balance < 0) return "red";
  if (balance < floor + Math.max(100, floor * 0.5)) return "yellow";
  return "green";
}

function formatMoney(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function normalizeFrequency(raw: string | null | undefined): KashuItemFrequency {
  const v = (raw ?? "MONTHLY").toUpperCase();
  if (
    v === "WEEKLY" ||
    v === "BIWEEKLY" ||
    v === "SEMI_MONTHLY" ||
    v === "MONTHLY" ||
    v === "ANNUAL" ||
    v === "ONE_OFF"
  ) {
    return v;
  }
  return "MONTHLY";
}

function intervalFor(freq: KashuItemFrequency, intervalDays: number | null): number {
  if (intervalDays && intervalDays > 0) return intervalDays;
  switch (freq) {
    case "WEEKLY":
      return 7;
    case "BIWEEKLY":
      return 14;
    case "SEMI_MONTHLY":
      return 15;
    case "ANNUAL":
      return 365;
    case "ONE_OFF":
      return 9999;
    default:
      return 30;
  }
}

/** Infer calendar due-day (1–31) from dueDay or nextDueDate. */
export function resolveDueDay(item: Pick<KashuMoneyRow, "dueDay" | "nextDueDate">): number | null {
  if (item.dueDay != null && item.dueDay >= 1 && item.dueDay <= 31) return item.dueDay;
  if (item.nextDueDate) {
    const d = startOfDay(item.nextDueDate).getDate();
    if (d >= 1 && d <= 31) return d;
  }
  return null;
}

/** Types included in bill-timing simulations (debt + housing allowed with caveats). */
function isTimingCandidateType(type: string) {
  return isCommitmentType(type) || type === "DEBT" || type === "HOUSING";
}

/**
 * Family e-transfers / person-to-person payouts are not provider due dates.
 * Timing must never suggest "move My Wife to the 3rd".
 */
export function isTimingExcludedItem(item: Pick<KashuMoneyRow, "title" | "type" | "priority">): boolean {
  const title = (item.title ?? "").toLowerCase();
  if (
    /\b(wife|husband|spouse|girlfriend|boyfriend|mom|dad|mother|father)\b/.test(title) ||
    /e-?\s*transfer|interac|venmo|zelle|paypal|cash\s*app|sent\s+to|transfer\s+to|family\s+transfer/.test(
      title
    )
  ) {
    return true;
  }
  const priority = (item.priority ?? "").toUpperCase();
  // Pure lifestyle fluff can stay (Netflix); person-to-person living transfers out
  if (item.type === "LIVING_EXPENSE" && (priority === "DISCRETIONARY" || priority === "LIFESTYLE")) {
    if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)?$/.test(item.title.trim()) || /\bmy\b/i.test(item.title)) {
      return true;
    }
  }
  return false;
}

/** Obligation dollars that actually hit the cash sim (on/after asOf). */
function obligationDollarsInSim(forecast: {
  asOf: string;
  radar: Array<{ kind: string; date: string; amount: number }>;
}): number {
  return forecast.radar
    .filter((r) => r.kind === "obligation" && r.date >= forecast.asOf)
    .reduce((s, r) => s + r.amount, 0);
}

/**
 * Occurrences of an obligation inside [from, toInclusive].
 * `dueDayOverride` moves the day-of-month for timing sims; annual keeps its natural month.
 * `cashFrom` (usually asOf) prevents Timing overrides from scheduling a payment before
 * "today" in a way that deletes this month's remaining bill from the cash sim.
 */
export function obligationDatesInRange(
  item: KashuMoneyRow,
  from: Date,
  to: Date,
  dueDayOverride?: number,
  cashFrom?: Date
): Date[] {
  const freq = normalizeFrequency(item.frequency);
  const naturalDue = resolveDueDay(item);
  const dueDay = dueDayOverride ?? naturalDue;
  const out: Date[] = [];
  const payFrom = cashFrom ?? from;

  if (freq === "ONE_OFF") {
    const once = item.nextDueDate ? startOfDay(item.nextDueDate) : null;
    if (once && once >= from && once <= to) {
      if (dueDayOverride != null) {
        const dim = new Date(once.getFullYear(), once.getMonth() + 1, 0).getDate();
        out.push(new Date(once.getFullYear(), once.getMonth(), Math.min(dueDayOverride, dim)));
      } else {
        out.push(once);
      }
    }
    return out;
  }

  if (freq === "ANNUAL") {
    // Prefer nextDueDate as the true annual occurrence (property tax, insurance).
    let natural: Date | null = item.nextDueDate ? startOfDay(item.nextDueDate) : null;
    if (!natural && naturalDue != null) {
      let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
      while (cursor <= to) {
        const dim = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
        const candidate = new Date(
          cursor.getFullYear(),
          cursor.getMonth(),
          Math.min(naturalDue, dim)
        );
        if (candidate >= from && candidate <= to) {
          natural = candidate;
          break;
        }
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    }
    if (!natural) return out;

    // Keep occurrence in the same month; only the day moves for Timing.
    // Never year-jump an override past `from` — that deletes the bill from the
    // advice window and creates fake Timing "lifts" (property tax 28→2 trick).
    const month = natural.getMonth();
    const year = natural.getFullYear();
    const day = dueDayOverride ?? natural.getDate();
    const dim = new Date(year, month + 1, 0).getDate();
    const occ = new Date(year, month, Math.min(Math.max(1, day), dim));
    if (occ >= payFrom && occ <= to) {
      out.push(occ);
    } else if (
      dueDayOverride != null &&
      natural >= payFrom &&
      natural <= to
    ) {
      // Override landed before today / outside window — keep natural so dollars don't vanish.
      out.push(natural);
    } else if (dueDayOverride == null) {
      let shifted = new Date(occ);
      let guard = 0;
      while (shifted < from && guard++ < 4) {
        const nextDim = new Date(shifted.getFullYear() + 1, shifted.getMonth() + 1, 0).getDate();
        shifted = new Date(
          shifted.getFullYear() + 1,
          shifted.getMonth(),
          Math.min(day, nextDim)
        );
      }
      if (shifted >= from && shifted <= to) out.push(shifted);
    }
    return out;
  }

  if (freq === "MONTHLY") {
    if (!naturalDue && dueDayOverride == null) return out;
    const naturalDay = naturalDue ?? dueDayOverride!;
    let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= to) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const dim = new Date(y, m + 1, 0).getDate();
      const naturalOcc = new Date(y, m, Math.min(naturalDay, dim));
      let occ: Date;
      if (dueDayOverride != null) {
        occ = new Date(y, m, Math.min(dueDayOverride, dim));
        // Timing override must not delete an upcoming payment by landing before today.
        if (occ < payFrom) {
          if (naturalOcc >= payFrom && naturalOcc <= to) {
            occ = naturalOcc;
          } else {
            cursor = new Date(y, m + 1, 1);
            continue;
          }
        }
      } else {
        occ = naturalOcc;
      }
      if (occ >= from && occ <= to) out.push(occ);
      cursor = new Date(y, m + 1, 1);
    }
    return out;
  }

  // Weekly / biweekly / semi-monthly — walk from nextDue (or dueDay seed)
  let cursor =
    item.nextDueDate != null
      ? startOfDay(item.nextDueDate)
      : naturalDue
        ? startOfDay(new Date(from.getFullYear(), from.getMonth(), naturalDue))
        : null;
  if (!cursor) return out;

  // Timing override: shift the series so the first occurrence in-range lands on override DOM
  // in the same month as that occurrence (approx for biweekly).
  if (dueDayOverride != null && freq === "SEMI_MONTHLY") {
    // Semi-monthly: regenerate as two DOMs per month (override + override±15)
    const d1 = Math.min(14, dueDayOverride);
    const d2 = Math.min(28, Math.max(15, dueDayOverride <= 14 ? dueDayOverride + 14 : dueDayOverride));
    let m = new Date(from.getFullYear(), from.getMonth(), 1);
    while (m <= to) {
      for (const d of [d1, d2]) {
        const dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
        const occ = new Date(m.getFullYear(), m.getMonth(), Math.min(d, dim));
        if (occ >= from && occ <= to) out.push(occ);
      }
      m = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    }
    return out.sort((a, b) => a.getTime() - b.getTime());
  }

  const step = intervalFor(freq, item.intervalDays);
  if (dueDayOverride != null && (freq === "BIWEEKLY" || freq === "WEEKLY")) {
    // Snap the first in-range occurrence to override day-of-month, then step.
    let seed = new Date(from.getFullYear(), from.getMonth(), Math.min(dueDayOverride, 28));
    if (seed < from) seed = addDays(seed, step);
    while (seed < from) seed = addDays(seed, step);
    cursor = startOfDay(seed);
  }

  let guard = 0;
  while (cursor > from && guard++ < 80) {
    cursor = addDays(cursor, -step);
  }
  while (cursor < from && guard++ < 160) {
    cursor = addDays(cursor, step);
  }
  while (cursor <= to && guard++ < 240) {
    out.push(new Date(cursor));
    cursor = addDays(cursor, step);
  }
  return out;
}

function paydayDates(
  profile: KashuProfileRow,
  from: Date,
  to: Date,
  scenario: KashuIncomeScenario = "expected"
): { dates: Date[]; amount: number; amountsByDate?: Record<string, number> } {
  const freq = (profile.payFrequency ?? "BIWEEKLY").toUpperCase() as KashuPayFrequency;
  const dates: Date[] = [];
  const amountsByDate: Record<string, number> = {};

  const baseAmount = resolvePaycheckAmount({
    typicalPaycheck: profile.typicalPaycheck,
    monthlyTakeHome: resolveMonthlyIncome(profile, scenario),
    payFrequency: freq,
  });
  if (!baseAmount && !profile.typicalPaycheck) return { dates, amount: 0 };

  let step = 14;
  if (freq === "WEEKLY") step = 7;
  else if (freq === "BIWEEKLY") step = 14;
  else if (freq === "SEMI_MONTHLY") step = 15;
  else if (freq === "MONTHLY") step = 30;
  else if (freq === "IRREGULAR") {
    // Never return a single out-of-window date (that zeros income for the whole horizon).
    // Walk biweekly from next/anchor so Timing + chart still see paydays.
    step = 14;
  }

  let cursor = profile.nextPayday ? startOfDay(profile.nextPayday) : null;
  if (!cursor && profile.paydayAnchorDay) {
    cursor = new Date(from.getFullYear(), from.getMonth(), profile.paydayAnchorDay);
    if (cursor < from) cursor.setMonth(cursor.getMonth() + 1);
    cursor = startOfDay(cursor);
  }
  if (!cursor) {
    cursor = addDays(from, 7);
  }

  // Preserve the intended day-of-month (don't let Feb 28 permanently shrink a 31st payday).
  const paydayDom =
    profile.paydayAnchorDay ??
    (profile.nextPayday ? startOfDay(profile.nextPayday).getDate() : cursor.getDate());

  const low = profile.paycheckLow && profile.paycheckLow > 0 ? profile.paycheckLow : null;
  const high = profile.paycheckHigh && profile.paycheckHigh > 0 ? profile.paycheckHigh : null;
  const alternating = Boolean(low && high && high! >= low! * 1.35);

  // Seed band from typicalPaycheck (next deposit)
  let onHigh = alternating && high && low ? baseAmount >= (low + high) / 2 : false;

  // Rewind so past month paydays appear on the calendar (Jul → Aug lookback)
  let guard = 0;
  const stepBack = () => {
    if (freq === "MONTHLY") {
      const prevMonth = cursor!.getMonth() - 1;
      const year = cursor!.getFullYear() + (prevMonth < 0 ? -1 : 0);
      const monthIdx = (prevMonth + 12) % 12;
      const dim = new Date(year, monthIdx + 1, 0).getDate();
      cursor = startOfDay(new Date(year, monthIdx, Math.min(paydayDom, dim)));
    } else if (freq === "SEMI_MONTHLY") {
      if (cursor!.getDate() > 14) {
        cursor = startOfDay(new Date(cursor!.getFullYear(), cursor!.getMonth(), Math.min(paydayDom, 14)));
      } else {
        const prev = new Date(cursor!.getFullYear(), cursor!.getMonth() - 1, 1);
        const dim = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
        cursor = startOfDay(
          new Date(prev.getFullYear(), prev.getMonth(), Math.min(Math.max(paydayDom, 15), dim))
        );
      }
    } else {
      cursor = addDays(cursor!, -step);
    }
    if (alternating) onHigh = !onHigh;
  };
  const stepForward = () => {
    if (freq === "MONTHLY") {
      const nextMonth = cursor!.getMonth() + 1;
      const nextYear = cursor!.getFullYear() + Math.floor(nextMonth / 12);
      const monthIdx = nextMonth % 12;
      const dim = new Date(nextYear, monthIdx + 1, 0).getDate();
      cursor = startOfDay(new Date(nextYear, monthIdx, Math.min(paydayDom, dim)));
    } else if (freq === "SEMI_MONTHLY") {
      const mid = paydayDom <= 14 ? Math.min(paydayDom + 14, 28) : paydayDom;
      const next =
        cursor!.getDate() <= 14
          ? new Date(cursor!.getFullYear(), cursor!.getMonth(), mid)
          : new Date(cursor!.getFullYear(), cursor!.getMonth() + 1, Math.min(paydayDom, 28));
      cursor = startOfDay(next);
    } else {
      cursor = addDays(cursor!, step);
    }
    if (alternating) onHigh = !onHigh;
  };

  while (cursor > from && guard++ < 80) stepBack();
  while (cursor < from && guard++ < 160) stepForward();
  while (cursor <= to && guard++ < 240) {
    const amt = alternating && low && high ? (onHigh ? high : low) : baseAmount;
    dates.push(new Date(cursor));
    amountsByDate[ymd(cursor)] = Math.round(amt);
    stepForward();
  }

  return {
    dates,
    amount: Math.round(baseAmount),
    amountsByDate,
  };
}

/** Resolve monthly take-home for a forecast scenario. */
export function resolveMonthlyIncome(
  profile: KashuProfileRow,
  scenario: KashuIncomeScenario = "expected"
): number {
  const expected = Math.max(0, profile.monthlyTakeHome ?? 0);
  const kind = normalizeIncomeKind(profile.incomeKind);
  if (kind !== "VARIABLE") return expected;

  const conservative = Math.max(0, profile.incomeConservative ?? expected * 0.7);
  const high = Math.max(expected, profile.incomeHigh ?? expected * 1.2);
  if (scenario === "conservative") return conservative;
  if (scenario === "high") return high;
  return expected || (conservative + high) / 2;
}

export function normalizeIncomeKind(raw: string | null | undefined): KashuIncomeKind {
  return (raw ?? "FIXED").toUpperCase() === "VARIABLE" ? "VARIABLE" : "FIXED";
}

/** Advance next payday after confirming a deposit. */
export function advancePaydayDate(
  current: Date | null,
  payFrequency: string | null,
  paydayAnchorDay: number | null,
  from: Date = new Date()
): Date {
  const freq = (payFrequency ?? "BIWEEKLY").toUpperCase() as KashuPayFrequency;
  const base = current ? startOfDay(current) : startOfDay(from);
  // If confirming an overdue/today payday, step from that date; else from today.
  let cursor = base <= startOfDay(from) ? base : startOfDay(from);

  if (freq === "WEEKLY") return addDays(cursor, 7);
  if (freq === "BIWEEKLY") return addDays(cursor, 14);
  if (freq === "SEMI_MONTHLY") return addDays(cursor, 15);
  if (freq === "MONTHLY") {
    const day = paydayAnchorDay ?? cursor.getDate();
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, day);
    return startOfDay(next);
  }
  // IRREGULAR — user must set the next date; default +14 as a soft prompt
  return addDays(cursor, 14);
}

function buildEmergencyInsight(input: {
  emergency: number;
  shortfall: number;
  lifestyleDaily: number;
  reserved: number;
  liquid: number;
}): KashuEmergencyInsight | null {
  const { emergency, shortfall, lifestyleDaily, reserved } = input;
  if (emergency <= 0 && shortfall <= 0) return null;

  const monthlyBurn = Math.max(lifestyleDaily * 30 + reserved, 1);
  const monthsCovered =
    emergency > 0 ? Math.round((emergency / monthlyBurn) * 10) / 10 : null;
  const shortfallCoveredByReserve = shortfall > 0 && emergency >= shortfall;
  const reserveAfter =
    shortfall > 0 ? Math.max(0, Math.round(emergency - shortfall)) : null;

  let message: string;
  if (shortfall > 0 && emergency > 0) {
    if (shortfallCoveredByReserve) {
      message = `A ${formatMoney(shortfall)} shortfall is covered by your emergency reserve — reserve would fall from ${formatMoney(emergency)} to ${formatMoney(reserveAfter ?? 0)}. Kashu still plans without using it by default.`;
    } else {
      message = `Shortfall ${formatMoney(shortfall)} exceeds your ${formatMoney(emergency)} emergency reserve. Reserve alone cannot close the gap.`;
    }
  } else if (emergency > 0 && monthsCovered != null) {
    message = `Emergency reserve of ${formatMoney(emergency)} covers about ${monthsCovered} month${monthsCovered === 1 ? "" : "s"} of current burn + reserved obligations. It stays excluded from Safe to Spend.`;
  } else {
    message = `No emergency reserve set. Add one so Kashu can show what a shortfall would cost your safety net.`;
  }

  return {
    monthsCovered,
    shortfallCoveredByReserve,
    reserveAfterCoveringShortfall: reserveAfter,
    message,
  };
}

function computeForecastConfidence(input: {
  hasBalance: boolean;
  hasIncome: boolean;
  hasPayday: boolean;
  hasFloor: boolean;
  billCount: number;
  incomeKind: KashuIncomeKind;
  hasBands: boolean;
  /** Stress signals — completeness ≠ cash safety */
  liquid?: number;
  projectedLow?: number;
  floor?: number;
  collisionCount?: number;
  lifestyleDaily?: number;
}): number {
  let score = 0.15;
  if (input.hasBalance) score += 0.2;
  if (input.hasIncome) score += 0.2;
  if (input.hasPayday) score += 0.15;
  if (input.hasFloor) score += 0.05;
  if (input.billCount >= 1) score += 0.1;
  if (input.billCount >= 3) score += 0.1;
  if (input.incomeKind === "VARIABLE" && input.hasBands) score += 0.05;
  else if (input.incomeKind === "FIXED" && input.hasIncome) score += 0.05;

  // Honesty: a complete model that predicts failure is not "high confidence safety".
  if (input.liquid != null && input.liquid <= 0) score -= 0.12;
  if (input.projectedLow != null && input.floor != null) {
    if (input.projectedLow < 0) score -= 0.2;
    else if (input.projectedLow < input.floor) score -= 0.12;
    else if (input.projectedLow < input.floor + 50) score -= 0.05;
  }
  if ((input.collisionCount ?? 0) > 0) {
    score -= Math.min(0.15, (input.collisionCount ?? 0) * 0.05);
  }
  if ((input.lifestyleDaily ?? 0) > 80 && (input.projectedLow ?? 0) < (input.floor ?? 0) + 100) {
    score -= 0.05;
  }
  return Math.max(0.05, Math.min(1, Math.round(score * 100) / 100));
}

function reservedThroughHorizon(
  items: KashuMoneyRow[],
  from: Date,
  nextPayday: Date | null
): number {
  const end = nextPayday ?? addDays(from, 14);
  let reserved = 0;
  for (const item of items) {
    // DEBT payments leave the checking account — reserve them too.
    if (!isCommitmentType(item.type) && item.type !== "DEBT") continue;
    const priority = (item.priority ?? "MANDATORY").toUpperCase();
    if (priority === "DISCRETIONARY" || priority === "LIFESTYLE") continue;
    const dates = obligationDatesInRange(item, from, end);
    reserved += dates.length * item.currentAmount;
  }
  return Math.round(reserved);
}

function buildMessage(input: {
  safeToSpend: number;
  shortfall: number;
  projectedLow: number;
  projectedLowDate: string | null;
  floor: number;
  nextPayday: string | null;
  collisions: KashuCollision[];
  lifestyleDaily?: number;
  bestTimingLift?: number;
  hasBalance?: boolean;
}): string {
  if (input.hasBalance === false) {
    return `Set today's checking balance in Buffers first. Without it, Timing invents a fake shortfall and due-date tips cannot be trusted.`;
  }
  if (input.collisions.length > 0) {
    const c = input.collisions[0]!;
    return `A ${formatMoney(c.shortfall)} shortfall is projected on ${c.date} when ${c.title} is expected to post. Open Timing to see moves that raise your low — or raise today's balance in Buffers.`;
  }
  if (input.projectedLow < 0) {
    return `You're projected to run ${formatMoney(Math.abs(input.projectedLow))} negative${input.projectedLowDate ? ` by ${input.projectedLowDate}` : ""}. Bill re-timing alone may not fix this — raise today's balance or cut daily spend${input.lifestyleDaily && input.lifestyleDaily > 0 ? ` (now ~${formatMoney(input.lifestyleDaily)}/day)` : ""}.`;
  }
  if (input.shortfall > 0) {
    return `Safe to Spend is $0 — you're short ${formatMoney(input.shortfall)} after reserved obligations and your safety floor.`;
  }
  if (input.projectedLow <= input.floor + 25) {
    const timingHint =
      input.bestTimingLift != null && input.bestTimingLift > 0.5
        ? ` Timing found a move that lifts your low by about ${formatMoney(input.bestTimingLift)}.`
        : ` If Timing can't lift the trough, add cash in Buffers or trim lifestyle burn.`;
    return `Your projected low is ${formatMoney(input.projectedLow)}${input.projectedLowDate ? ` on ${input.projectedLowDate}` : ""} — near your ${formatMoney(input.floor)} floor.${timingHint}`;
  }
  if (input.projectedLow < input.floor + 50) {
    return `Your projected low is ${formatMoney(input.projectedLow)}${input.projectedLowDate ? ` on ${input.projectedLowDate}` : ""}. You are still above your ${formatMoney(input.floor)} safety floor.`;
  }
  const until = input.nextPayday ? ` until ${input.nextPayday}` : "";
  return `You're safe to spend ${formatMoney(input.safeToSpend)}${until}. Scheduled obligations are covered.`;
}

export function buildKashuForecast(
  profile: KashuProfileRow,
  items: KashuMoneyRow[],
  opts?: {
    horizonDays?: number;
    /** Days before asOf to still place pay/bill radar events (calendar history). */
    lookbackDays?: number;
    asOf?: Date;
    /** Simulate spending today (reduces starting balance) */
    spendToday?: number;
    /** Adjust next paycheque amount */
    payDelta?: number;
    /** Move one bill's due day for timing optimizer / what-if */
    moveBillId?: string;
    moveBillToDay?: number;
    /** Move several bills at once (multi-bill spread plan). */
    moveBills?: Record<string, number>;
    /** Which income band to model when income is variable */
    incomeScenario?: KashuIncomeScenario;
    /** Skip timing optimizer (prevents recursion when nested). */
    skipTiming?: boolean;
    /** KINZO extra fuel / similar — added to modeled daily living spend. */
    extraDailyBurn?: number;
    /** DayO calendar spend keyed YYYY-MM-DD. */
    extraSpendByDate?: Record<string, { title: string; amount: number }>;
    /**
     * Exact / reconstructed payroll deposits (from statements).
     * Merged into the cash sim so Timing + day balances use real amounts/dates.
     */
    payrollDeposits?: Array<{ date: string; amount: number }>;
  }
): KashuForecast {
  const asOf = startOfDay(opts?.asOf ?? new Date());
  const horizonDays = opts?.horizonDays ?? 30;
  const lookbackDays = opts?.lookbackDays ?? (horizonDays >= 60 ? 62 : 31);
  const eventFrom = addDays(asOf, -lookbackDays);
  const to = addDays(asOf, horizonDays);
  const floor = Math.max(0, profile.safetyFloor ?? 0);
  const emergency = Math.max(0, profile.emergencyReserve ?? 0);
  const lifestyleDaily = Math.max(0, profile.lifestyleBurnDaily ?? 0) + Math.max(0, opts?.extraDailyBurn ?? 0);
  // Allow negative liquid (overdraft) — do not clamp to zero.
  const liquid = (profile.liquidBalance ?? 0) - (opts?.spendToday ?? 0);
  const incomeKind = normalizeIncomeKind(profile.incomeKind);
  const incomeScenario: KashuIncomeScenario =
    opts?.incomeScenario ?? "expected";

  // Schedule pay + bills across lookback→horizon so past month days aren't empty.
  // Day balance simulation still starts at asOf (liquid is "now").
  const pay = paydayDates(profile, eventFrom, to, incomeScenario);
  // Overlay statement payroll amounts/dates onto the projected cadence.
  if (opts?.payrollDeposits?.length) {
    const amounts = { ...(pay.amountsByDate ?? {}) };
    const byKey = new Map(pay.dates.map((d) => [ymd(d), d]));
    for (const dep of opts.payrollDeposits) {
      if (!dep.date || !(dep.amount > 0)) continue;
      amounts[dep.date] = Math.round(dep.amount);
      if (!byKey.has(dep.date)) {
        const parsed = startOfDay(new Date(`${dep.date}T12:00:00`));
        if (parsed >= eventFrom && parsed <= to) {
          pay.dates.push(parsed);
          byKey.set(dep.date, parsed);
        }
      }
    }
    pay.dates.sort((a, b) => a.getTime() - b.getTime());
    pay.amountsByDate = amounts;
    // If cadence was empty, deposits alone must still set a positive pay.amount
    if (!pay.amount) {
      pay.amount = Math.max(...opts.payrollDeposits.map((d) => Math.round(d.amount)), 0);
    }
  }

  // HARD GUARANTEE: never run a bills-only horizon when we have a paycheck signal.
  // Empty pay.dates → green staircase chart + fake −$20k Timing lows.
  if (pay.dates.length === 0) {
    const forcedAmt = Math.max(
      pay.amount,
      resolvePaycheckAmount({
        typicalPaycheck: profile.typicalPaycheck,
        monthlyTakeHome: resolveMonthlyIncome(profile, incomeScenario),
        payFrequency: profile.payFrequency ?? "BIWEEKLY",
      }),
      ...(opts?.payrollDeposits ?? []).map((d) => Math.round(d.amount)),
      0
    );
    if (forcedAmt > 0) {
      const step = 14;
      let cursor =
        profile.nextPayday != null
          ? startOfDay(profile.nextPayday)
          : profile.paydayAnchorDay != null
            ? startOfDay(
                new Date(asOf.getFullYear(), asOf.getMonth(), profile.paydayAnchorDay)
              )
            : addDays(asOf, 0);
      let guard = 0;
      while (cursor > eventFrom && guard++ < 80) cursor = addDays(cursor, -step);
      while (cursor < eventFrom && guard++ < 160) cursor = addDays(cursor, step);
      const amounts: Record<string, number> = {};
      const dates: Date[] = [];
      while (cursor <= to && guard++ < 240) {
        dates.push(new Date(cursor));
        amounts[ymd(cursor)] = forcedAmt;
        cursor = addDays(cursor, step);
      }
      pay.dates = dates;
      pay.amountsByDate = amounts;
      pay.amount = forcedAmt;
    }
  }

  const futurePays = pay.dates.filter((d) => d >= asOf);
  let nextPaydayDate = futurePays[0] ?? null;
  // Never trust a stale profile nextPayday years in the future (UI showed "1336d").
  if (!nextPaydayDate && profile.nextPayday) {
    const cand = startOfDay(profile.nextPayday);
    const ahead = Math.ceil((cand.getTime() - asOf.getTime()) / 86400000);
    if (ahead >= 0 && ahead <= 45) nextPaydayDate = cand;
  }
  const nextPayday = nextPaydayDate ? ymd(startOfDay(nextPaydayDate)) : null;
  const daysUntilPayday = nextPaydayDate
    ? Math.max(0, Math.ceil((startOfDay(nextPaydayDate).getTime() - asOf.getTime()) / 86400000))
    : null;

  const reserved = reservedThroughHorizon(items, asOf, nextPaydayDate);
  const rawSafe = liquid - reserved - floor;
  const safeToSpend = Math.max(0, Math.round(rawSafe));
  const safeToSpendShortfall = rawSafe < 0 ? Math.round(-rawSafe) : 0;

  // Include DEBT payments in the cash calendar (car loans, etc.) — they move money.
  const commitmentItems = items.filter(
    (i) => isCommitmentType(i.type) || i.type === "DEBT"
  );

  type Scheduled = {
    date: Date;
    kind: KashuRadarEvent["kind"];
    title: string;
    amount: number;
    id: string;
    autoPay?: boolean;
    priority?: KashuPriority;
    confidence?: number;
  };

  const scheduled: Scheduled[] = [];

  for (const d of pay.dates) {
    const dayKey = ymd(d);
    const dayAmt = pay.amountsByDate?.[dayKey] ?? pay.amount;
    const amt = Math.max(0, dayAmt + (opts?.payDelta ?? 0));
    const mid =
      profile.paycheckLow && profile.paycheckHigh
        ? (profile.paycheckLow + profile.paycheckHigh) / 2
        : null;
    const isBonus = mid != null && amt >= mid * 1.15;
    const title =
      isBonus
        ? "Payday (Bonus)"
        : incomeKind === "VARIABLE"
          ? `Payday (${incomeScenario})`
          : "Payday";
    scheduled.push({
      date: d,
      kind: "payday",
      title,
      amount: amt,
      id: `pay-${dayKey}-${incomeScenario}`,
    });
  }

  for (const item of commitmentItems) {
    const dueOverride =
      opts?.moveBills?.[item.id] ??
      (opts?.moveBillId === item.id && opts.moveBillToDay ? opts.moveBillToDay : undefined);
    const dates = obligationDatesInRange(item, eventFrom, to, dueOverride, asOf);
    for (const d of dates) {
      scheduled.push({
        date: d,
        kind: "obligation",
        title: item.title,
        amount: item.currentAmount,
        id: `${item.id}-${ymd(d)}`,
        autoPay: item.autoPay,
        priority: (item.priority as KashuPriority) || "MANDATORY",
        confidence: item.confidence ?? undefined,
      });
    }
  }

  scheduled.sort((a, b) => a.date.getTime() - b.date.getTime() || a.amount - b.amount);

  const days: KashuDayProjection[] = [];
  const radar: KashuRadarEvent[] = [];
  const collisions: KashuCollision[] = [];

  /**
   * Lookback cash path (calendar history).
   * Liquid at asOf already includes every past payday and bill.
   * Back out an opening balance so a forward sim of lookback events lands on
   * `liquid`, then project each past day with real ending balances — never paint
   * a +$7k payday badge on a road that still pretends the deposit never hit.
   */
  const asOfKey = ymd(asOf);
  let lookbackIncome = 0;
  let lookbackOut = 0;
  for (const ev of scheduled) {
    if (ymd(ev.date) >= asOfKey) continue;
    if (ev.kind === "payday" || ev.kind === "income") lookbackIncome += ev.amount;
    else lookbackOut += ev.amount;
  }
  const lookbackDayCount = Math.max(
    0,
    Math.round((asOf.getTime() - eventFrom.getTime()) / 86400000)
  );
  // Burn applies on lookback days after the first (mirrors asOf day i>0).
  const lookbackBurnTotal =
    lifestyleDaily > 0 && lookbackDayCount > 1
      ? lifestyleDaily * (lookbackDayCount - 1)
      : 0;
  for (const [key, extra] of Object.entries(opts?.extraSpendByDate ?? {})) {
    if (key < asOfKey && extra.amount > 0) lookbackOut += extra.amount;
  }

  let balance = liquid - lookbackIncome + lookbackOut + lookbackBurnTotal;
  // Timing trough is forward-only — past OD after mortgage must not set projectedLow.
  let projectedLow = liquid;
  let projectedLowDate: string | null = asOfKey;

  const pushDayEvents = (
    day: Date,
    key: string,
    optsDay: {
      applyLifestyleBurn: boolean;
      recordCollisions: boolean;
      countTowardProjectedLow: boolean;
    }
  ) => {
    const startingBalance = balance;
    let income = 0;
    let obligations = 0;
    const dayEvents: KashuRadarEvent[] = [];

    for (const ev of scheduled.filter((s) => ymd(s.date) === key)) {
      if (ev.kind === "payday" || ev.kind === "income") {
        income += ev.amount;
        balance += ev.amount;
      } else {
        obligations += ev.amount;
        balance -= ev.amount;
      }
      const funding = fundingPaydayFor(ev.date, pay.dates);
      const event: KashuRadarEvent = {
        id: ev.id,
        date: key,
        kind: ev.kind,
        title: ev.title,
        amount: ev.amount,
        balanceAfter: Math.round(balance),
        status: statusFor(balance, floor),
        autoPay: ev.autoPay,
        priority: ev.priority,
        confidence: ev.confidence,
        fundingPayday: funding,
      };
      dayEvents.push(event);
      radar.push(event);

      if (optsDay.recordCollisions && ev.kind === "obligation" && balance < floor) {
        collisions.push({
          date: key,
          title: ev.title,
          shortfall: Math.round(floor - balance),
          projectedBalance: Math.round(balance),
          causeEventId: ev.id,
        });
      }
    }

    const extra = opts?.extraSpendByDate?.[key];
    if (extra && extra.amount > 0) {
      balance -= extra.amount;
      obligations += extra.amount;
      const extraEvent: KashuRadarEvent = {
        id: `lifeos-${key}`,
        date: key,
        kind: "lifestyle",
        title: extra.title,
        amount: extra.amount,
        balanceAfter: Math.round(balance),
        status: statusFor(balance, floor),
      };
      dayEvents.push(extraEvent);
      radar.push(extraEvent);
      if (optsDay.recordCollisions && balance < floor) {
        collisions.push({
          date: key,
          title: extra.title,
          shortfall: Math.round(floor - balance),
          projectedBalance: Math.round(balance),
          causeEventId: extraEvent.id,
        });
      }
    }

    const lifestyleBurn = optsDay.applyLifestyleBurn ? lifestyleDaily : 0;
    if (lifestyleBurn > 0) {
      balance -= lifestyleBurn;
      obligations += lifestyleBurn;
      if (optsDay.recordCollisions) {
        const alreadyLifestyleHit = collisions.some((c) =>
          (c.causeEventId ?? "").startsWith("lifestyle-")
        );
        if (balance < floor && !alreadyLifestyleHit) {
          collisions.push({
            date: key,
            title: "Daily lifestyle burn",
            shortfall: Math.round(floor - balance),
            projectedBalance: Math.round(balance),
            causeEventId: `lifestyle-${key}`,
          });
        }
      }
    }

    const ending = Math.round(balance);
    if (optsDay.countTowardProjectedLow && ending < projectedLow) {
      projectedLow = ending;
      projectedLowDate = key;
    }

    days.push({
      date: key,
      startingBalance: Math.round(startingBalance),
      income: Math.round(income),
      obligations: Math.round(obligations),
      lifestyleBurn: Math.round(lifestyleBurn),
      endingBalance: ending,
      availableAboveFloor: Math.round(ending - floor),
      status: statusFor(ending, floor),
      events: dayEvents,
    });
  };

  // Historical days (display only — do not drive Timing trough / collisions).
  for (let i = 0; i < lookbackDayCount; i++) {
    const day = addDays(eventFrom, i);
    const key = ymd(day);
    if (key >= asOfKey) break;
    pushDayEvents(day, key, {
      applyLifestyleBurn: i > 0 && lifestyleDaily > 0,
      recordCollisions: false,
      countTowardProjectedLow: false,
    });
  }
  // Snap to the known-now balance before projecting forward (float / missing txs).
  balance = liquid;

  for (let i = 0; i <= horizonDays; i++) {
    const day = addDays(asOf, i);
    const key = ymd(day);
    pushDayEvents(day, key, {
      applyLifestyleBurn: i > 0 && lifestyleDaily > 0,
      recordCollisions: true,
      countTowardProjectedLow: true,
    });
  }

  const timingScenarios =
    opts?.skipTiming || profile.liquidBalance == null
      ? []
      : buildTimingScenarios(
        profile,
        items,
        asOf,
        horizonDays,
        projectedLow,
        collisions.length,
        incomeScenario,
        {
          extraDailyBurn: opts?.extraDailyBurn,
          extraSpendByDate: opts?.extraSpendByDate,
          payrollDeposits: opts?.payrollDeposits,
        }
      );
  const billWaves = buildBillWaves(radar);
  const bestTimingLift = timingScenarios.reduce(
    (max, s) => Math.max(max, s.projectedLow - projectedLow),
    0
  );

  const status = statusFor(projectedLow, floor);
  const message = buildMessage({
    safeToSpend,
    shortfall: safeToSpendShortfall,
    projectedLow,
    projectedLowDate,
    floor,
    nextPayday,
    collisions,
    lifestyleDaily,
    bestTimingLift,
    hasBalance: profile.liquidBalance != null,
  });

  const emergencyInsight = buildEmergencyInsight({
    emergency,
    shortfall: safeToSpendShortfall,
    lifestyleDaily,
    reserved,
    liquid,
  });

  const forecastConfidence = computeForecastConfidence({
    hasBalance: profile.liquidBalance != null,
    hasIncome: resolveMonthlyIncome(profile, "expected") > 0,
    hasPayday: Boolean(profile.nextPayday),
    hasFloor: floor > 0,
    billCount: commitmentItems.length,
    incomeKind,
    hasBands:
      (profile.incomeConservative ?? 0) > 0 || (profile.incomeHigh ?? 0) > 0,
    liquid,
    projectedLow,
    floor,
    collisionCount: collisions.length,
    lifestyleDaily,
  });

  return {
    asOf: ymd(asOf),
    horizonDays,
    liquidBalance: Math.round(liquid * 100) / 100,
    safetyFloor: floor,
    emergencyReserve: emergency,
    reservedObligations: reserved,
    safeToSpend,
    safeToSpendShortfall,
    projectedLow,
    projectedLowDate,
    nextPayday,
    daysUntilPayday,
    status,
    days,
    radar,
    collisions,
    billWaves,
    timingScenarios,
    message,
    payFrequency: (profile.payFrequency as KashuPayFrequency) || null,
    incomeKind,
    incomeScenario,
    forecastConfidence,
    emergencyInsight,
  };
}

/** Which payday should fund an obligation on this date (latest payday on or before it). */
function fundingPaydayFor(obligationDate: Date, payDates: Date[]): string | null {
  const sorted = [...payDates].sort((a, b) => a.getTime() - b.getTime());
  let fund: Date | null = null;
  for (const p of sorted) {
    if (startOfDay(p).getTime() <= startOfDay(obligationDate).getTime()) {
      fund = p;
    }
  }
  return fund ? ymd(startOfDay(fund)) : null;
}

/** Group obligations by funding payday — Big-pay vs Regular-pay waves. */
function buildBillWaves(radar: KashuRadarEvent[]): KashuBillWave[] {
  const groups = new Map<
    string,
    { fundingPayday: string | null; eventIds: string[]; total: number; worst: KashuCashStatus }
  >();

  for (const ev of radar) {
    if (ev.kind !== "obligation") continue;
    const key = ev.fundingPayday ?? "pre-payday";
    const g = groups.get(key) ?? {
      fundingPayday: ev.fundingPayday ?? null,
      eventIds: [],
      total: 0,
      worst: "green" as KashuCashStatus,
    };
    g.eventIds.push(ev.id);
    g.total += ev.amount;
    if (ev.status === "red" || (ev.status === "yellow" && g.worst === "green")) {
      g.worst = ev.status;
    }
    groups.set(key, g);
  }

  const rows = [...groups.entries()]
    .map(([key, g]) => ({ key, ...g }))
    .sort((a, b) => b.total - a.total);

  return rows.map((g, idx) => {
    let label: string;
    if (g.key === "pre-payday") {
      label = "Until next payday";
    } else if (idx === 0 && rows.length >= 2) {
      label = "Big-pay wave";
    } else if (idx === 1 && rows.length >= 2) {
      label = "Regular-pay wave";
    } else {
      label = `Pay cycle · ${g.fundingPayday}`;
    }
    return {
      id: `wave-${g.key}`,
      label,
      fundingPayday: g.fundingPayday,
      totalObligations: Math.round(g.total),
      eventIds: g.eventIds,
      status: g.worst,
    };
  });
}

/**
 * Spread target days across pay cycles — prefer days right after each deposit.
 * Returns distinct day-of-month slots sorted soonest-after-income first.
 */
function spreadSlots(profile: KashuProfileRow, asOf: Date, horizonDays: number): number[] {
  const to = addDays(asOf, horizonDays);
  const pay = paydayDates(profile, asOf, to, "expected");
  const slots = new Set<number>();
  const add = (d: number) => {
    if (d >= 1 && d <= 28) slots.add(d);
  };

  for (const p of pay.dates) {
    const dom = p.getDate();
    add(Math.min(28, dom)); // payday itself (auto-pay after deposit)
    add(Math.min(28, dom + 1));
    add(Math.min(28, dom + 2));
    add(Math.min(28, dom + 3));
    add(Math.min(28, dom + 5));
  }

  // Mid-cycle fillers between consecutive paydays (still after income, before next deposit)
  for (let i = 0; i < pay.dates.length - 1; i++) {
    const a = pay.dates[i]!;
    const b = pay.dates[i + 1]!;
    const gapDays = Math.round((b.getTime() - a.getTime()) / 86400000);
    if (gapDays >= 6) {
      const mid = addDays(a, Math.floor(gapDays / 2));
      add(mid.getDate());
    }
    if (gapDays >= 10) {
      add(addDays(a, 3).getDate());
      add(addDays(b, -2).getDate());
    }
  }

  if (slots.size === 0) {
    for (const d of [2, 5, 10, 15, 18, 22, 25, 28]) add(d);
  }

  // Sort: days on/after next payday first, then ascending
  const next = profile.nextPayday ? startOfDay(profile.nextPayday) : pay.dates.find((d) => d >= asOf) ?? null;
  const payDom = next ? next.getDate() : 1;
  return [...slots].sort((a, b) => {
    const aAfter = a >= payDom ? 0 : 1;
    const bAfter = b >= payDom ? 0 : 1;
    if (aAfter !== bAfter) return aAfter - bAfter;
    return a - b;
  });
}

/**
 * Candidate due days to try for a single bill move.
 * Anchors around paydays (day-of / day-after) plus common mid-cycle dates.
 */
function timingCandidateDays(
  currentDue: number,
  profile: KashuProfileRow,
  asOf: Date,
  horizonDays: number
): number[] {
  const days = new Set<number>(spreadSlots(profile, asOf, horizonDays));
  const add = (d: number) => {
    if (d >= 1 && d <= 28 && d !== currentDue) days.add(d);
  };

  for (const d of [1, 5, 10, 12, 15, 18, 20, 22, 23, 25, 28]) add(d);
  add(Math.min(28, currentDue + 7));
  add(Math.min(28, currentDue + 10));
  add(Math.min(28, currentDue + 14));
  days.delete(currentDue);

  const next = profile.nextPayday ? startOfDay(profile.nextPayday) : null;
  const sorted = [...days];
  if (next) {
    const payDom = next.getDate();
    sorted.sort((a, b) => {
      const aAfter = a >= payDom ? 0 : 1;
      const bAfter = b >= payDom ? 0 : 1;
      if (aAfter !== bAfter) return aAfter - bAfter;
      // Prefer closer to payday (less idle cash pressure mid-cycle for big bills)
      const aDist = Math.abs(a - payDom);
      const bDist = Math.abs(b - payDom);
      if (aAfter === 0 && bAfter === 0 && aDist !== bDist) return aDist - bDist;
      return a - b;
    });
  } else {
    sorted.sort((a, b) => a - b);
  }

  return sorted.slice(0, 14);
}

function simForecast(
  profile: KashuProfileRow,
  items: KashuMoneyRow[],
  asOf: Date,
  horizonDays: number,
  incomeScenario: KashuIncomeScenario,
  extras:
    | {
        extraDailyBurn?: number;
        extraSpendByDate?: Record<string, { title: string; amount: number }>;
        payrollDeposits?: Array<{ date: string; amount: number }>;
      }
    | undefined,
  moveBills: Record<string, number>
) {
  return buildKashuForecast(profile, items, {
    asOf,
    horizonDays,
    incomeScenario,
    skipTiming: true,
    moveBills,
    extraDailyBurn: extras?.extraDailyBurn,
    extraSpendByDate: extras?.extraSpendByDate,
    payrollDeposits: extras?.payrollDeposits,
  });
}

/** Prefer flexible bills for Timing tips (insurance/utilities before mortgage/tax). */
function timingFlexibilityRank(item: KashuMoneyRow): number {
  if (isHardTimingBill(item)) return 5;
  const freq = normalizeFrequency(item.frequency);
  if (item.type === "SUBSCRIPTION") return 0;
  if (item.type === "BILL" && freq !== "ANNUAL") return 1;
  if (item.type === "BILL" && freq === "ANNUAL") return 3;
  if (item.type === "LIVING_EXPENSE" || item.type === "COMMITMENT") return 2;
  if (item.type === "DEBT") return 4;
  if (item.type === "HOUSING") return 5;
  return 3;
}

/** Mortgage / rent / property tax / auto loans — hard for providers; never pad a spread with these. */
function isHardTimingBill(item: KashuMoneyRow): boolean {
  if (item.type === "HOUSING" || item.type === "DEBT") return true;
  return /mortgage|rent\b|landlord|property\s*tax|municipal|auto\s*loan|car\s*loan|lincoln/i.test(
    item.title
  );
}

const MIN_MATERIAL_LIFT = 75;

function moveMeaningfullyHelps(
  projectedLow: number,
  collisions: number,
  baseLow: number,
  baseCollisions: number
): boolean {
  const lift = projectedLow - baseLow;
  // Collision-only with ~$0 trough change is noise when you're already deep red.
  if (lift >= MIN_MATERIAL_LIFT) return true;
  if (lift > 0.5 && collisions < baseCollisions) return true;
  return false;
}

function isNoiseDueShift(fromDay: number, toDay: number, lift: number): boolean {
  const delta = Math.abs(toDay - fromDay);
  // 26→28 / 10→11 style shifts that barely move cash are not advice.
  return delta <= 2 && lift < MIN_MATERIAL_LIFT;
}

/**
 * Reject Timing trials that "win" by deleting bills from the horizon
 * (late→early due day that falls before today, annual override year-jump, etc.).
 */
function preservesObligationDollars(
  baselineDollars: number,
  trial: { asOf: string; radar: Array<{ kind: string; date: string; amount: number }> }
): boolean {
  const trialDollars = obligationDollarsInSim(trial);
  return trialDollars >= baselineDollars - 1;
}

function stillShortNote(projectedLow: number, floor: number, lift: number): string {
  if (projectedLow >= floor && projectedLow >= 0) {
    return lift >= MIN_MATERIAL_LIFT
      ? floor > 0
        ? ` That gets you back to/above your ${formatMoney(floor)} safety floor.`
        : ` That keeps the projected low at or above $0.`
      : "";
  }
  if (projectedLow < 0) {
    return ` This only softens the crash — the account would still hit about ${formatMoney(projectedLow)}. Raise today's balance in Buffers or cut daily burn; due-date changes cannot invent that cash.`;
  }
  // Above $0 but under a positive floor
  const need = Math.round(floor - projectedLow);
  return ` This only softens the crash — you are still about ${formatMoney(need)} under your ${formatMoney(floor)} safety floor. Raise today's balance in Buffers or cut daily burn.`;
}

function buildTimingScenarios(
  profile: KashuProfileRow,
  items: KashuMoneyRow[],
  asOf: Date,
  horizonDays: number,
  currentLow: number,
  baselineCollisions: number,
  incomeScenario: KashuIncomeScenario = "expected",
  extras?: {
    extraDailyBurn?: number;
    extraSpendByDate?: Record<string, { title: string; amount: number }>;
    payrollDeposits?: Array<{ date: string; amount: number }>;
  }
): KashuTimingScenario[] {
  const floor = Math.max(0, profile.safetyFloor ?? 0);
  const underfunded = currentLow <= floor + 25;
  const baselineSim = simForecast(profile, items, asOf, horizonDays, incomeScenario, extras, {});
  const baselineDollars = obligationDollarsInSim(baselineSim);
  const lifestyle = Math.max(0, profile.lifestyleBurnDaily ?? 0);
  const payDom = profile.nextPayday ? startOfDay(profile.nextPayday).getDate() : null;

  const pool = items
    .map((i) => ({ item: i, due: resolveDueDay(i) }))
    .filter(({ item, due }) => {
      if (!isTimingCandidateType(item.type) || due == null || item.currentAmount < 25) {
        return false;
      }
      if (isTimingExcludedItem(item)) return false;
      const freq = normalizeFrequency(item.frequency);
      if (
        !(
          freq === "MONTHLY" ||
          freq === "ANNUAL" ||
          freq === "SEMI_MONTHLY" ||
          freq === "BIWEEKLY"
        )
      ) {
        return false;
      }
      // Only advise on bills that still hit the cash sim from today forward.
      // Past dues (mortgage on the 3rd when today is the 21st) must not reappear as Timing tips.
      const remaining = obligationDatesInRange(
        item,
        asOf,
        addDays(asOf, horizonDays),
        undefined,
        asOf
      );
      return remaining.length > 0;
    })
    .sort((a, b) => {
      const flex = timingFlexibilityRank(a.item) - timingFlexibilityRank(b.item);
      if (flex !== 0) return flex;
      return b.item.currentAmount - a.item.currentAmount;
    })
    .slice(0, 12);

  if (pool.length === 0) return [];

  // No usable starting balance → due-date tips are fiction (the −$6k "softens to −$4.9k" path).
  if (profile.liquidBalance == null) return [];

  const scenarios: KashuTimingScenario[] = [];
  const spreadPool = pool.filter((p) => !isHardTimingBill(p.item)).slice(0, 5);

  const slots = spreadSlots(profile, asOf, horizonDays);
  const moveBills: Record<string, number> = {};
  const planMoves: NonNullable<KashuTimingScenario["moves"]> = [];
  let planLow = currentLow;
  let planCollisions = baselineCollisions;
  const usedSlots = new Set<number>();

  for (const { item: bill, due: currentDue } of spreadPool) {
    if (currentDue == null) continue;
    if (planMoves.length >= 3) break;
    let bestDay: number | null = null;
    let bestLow = planLow;
    let bestColl = planCollisions;

    const ordered = [
      ...slots.filter((d) => d !== currentDue && !usedSlots.has(d)),
      ...timingCandidateDays(currentDue, profile, asOf, horizonDays).filter(
        (d) => !slots.includes(d) && !usedSlots.has(d)
      ),
    ];

    for (const day of ordered.slice(0, 14)) {
      // Don't pull a bill earlier into the pre-payday danger zone
      if (payDom != null && day < currentDue && day < payDom) continue;
      const trial = { ...moveBills, [bill.id]: day };
      const f = simForecast(profile, items, asOf, horizonDays, incomeScenario, extras, trial);
      if (!preservesObligationDollars(baselineDollars, f)) continue;
      const lift = f.projectedLow - planLow;
      if (isNoiseDueShift(currentDue, day, lift)) continue;
      if (lift < MIN_MATERIAL_LIFT) continue;
      if (
        f.projectedLow > bestLow + 0.5 ||
        (Math.abs(f.projectedLow - bestLow) < 0.5 && f.collisions.length < bestColl)
      ) {
        bestLow = Math.max(bestLow, f.projectedLow);
        bestDay = day;
        bestColl = f.collisions.length;
      }
    }

    if (bestDay != null && bestLow >= planLow + MIN_MATERIAL_LIFT) {
      moveBills[bill.id] = bestDay;
      usedSlots.add(bestDay);
      planMoves.push({
        billId: bill.id,
        billTitle: bill.title,
        currentDueDay: currentDue,
        moveToDay: bestDay,
      });
      planLow = bestLow;
      planCollisions = bestColl;
    }
  }

  if (planMoves.length >= 2 && planLow >= currentLow + MIN_MATERIAL_LIFT) {
    const finalPlan = simForecast(
      profile,
      items,
      asOf,
      horizonDays,
      incomeScenario,
      extras,
      moveBills
    );
    if (
      preservesObligationDollars(baselineDollars, finalPlan) &&
      finalPlan.projectedLow >= currentLow + MIN_MATERIAL_LIFT
    ) {
      planLow = finalPlan.projectedLow;
      planCollisions = finalPlan.collisions.length;
      const lift = planLow - currentLow;
      const moveList = planMoves
        .map(
          (m) =>
            `${m.billTitle} ${m.currentDueDay}${ordinal(m.currentDueDay)}→${m.moveToDay}${ordinal(m.moveToDay)}`
        )
        .join("; ");
      scenarios.push({
        billId: planMoves.map((m) => m.billId).join("+"),
        billTitle: `Spread ${planMoves.length} bills`,
        currentDueDay: planMoves[0]!.currentDueDay,
        moveToDay: planMoves[0]!.moveToDay,
        projectedLow: planLow,
        recommended: true,
        moves: planMoves,
        note: `One combined plan (not additive with the tips below): ${moveList}. Projected low ${formatMoney(currentLow)} → ${formatMoney(planLow)} (+${formatMoney(lift)}). Same bill dollars still leave this window — only dates change.${stillShortNote(planLow, floor, lift)} Ask each provider to change the due date; Kashu does not move money.`,
      });
    }
  }

  // Single-bill alternatives — each vs doing nothing (NOT stackable)
  const flexibleSingles: KashuTimingScenario[] = [];
  const hardSingles: KashuTimingScenario[] = [];

  for (const { item: bill, due: currentDue } of pool) {
    if (currentDue == null) continue;
    const tryDays = timingCandidateDays(currentDue, profile, asOf, horizonDays);
    let best: KashuTimingScenario | null = null;
    let bestCollisions = baselineCollisions;

    for (const day of tryDays) {
      if (payDom != null && day < currentDue && day < payDom) continue;
      const f = simForecast(profile, items, asOf, horizonDays, incomeScenario, extras, {
        [bill.id]: day,
      });
      if (!preservesObligationDollars(baselineDollars, f)) continue;
      const lift = f.projectedLow - currentLow;
      if (isNoiseDueShift(currentDue, day, lift)) continue;
      if (lift < MIN_MATERIAL_LIFT) continue;

      const scenario: KashuTimingScenario = {
        billId: bill.id,
        billTitle: bill.title,
        currentDueDay: currentDue,
        moveToDay: day,
        projectedLow: f.projectedLow,
        recommended: false,
        note: `Move ${bill.title} to the ${day}${ordinal(day)}`,
      };
      if (!best || f.projectedLow > best.projectedLow + 0.5) {
        best = scenario;
        bestCollisions = f.collisions.length;
      }
    }

    if (best && best.projectedLow >= currentLow + MIN_MATERIAL_LIFT) {
      const hardToMove = isHardTimingBill(bill);
      const lift = best.projectedLow - currentLow;
      best.recommended = false; // set after we pick the winner
      const collisionBit =
        bestCollisions < baselineCollisions
          ? ` Also clears ${baselineCollisions - bestCollisions} collision${baselineCollisions - bestCollisions === 1 ? "" : "s"}.`
          : "";
      best.note = `Alternative (alone — do not add this lift to other tips): move ${bill.title} ${currentDue}${ordinal(currentDue)}→${best.moveToDay}${ordinal(best.moveToDay)}. Projected low ${formatMoney(currentLow)} → ${formatMoney(best.projectedLow)} (+${formatMoney(lift)}).${collisionBit}${stillShortNote(best.projectedLow, floor, lift)}${hardToMove ? " Providers may not allow this — call before assuming." : ""}`;
      if (hardToMove) hardSingles.push(best);
      else flexibleSingles.push(best);
    }
  }

  flexibleSingles.sort((a, b) => b.projectedLow - a.projectedLow);
  hardSingles.sort((a, b) => b.projectedLow - a.projectedLow);

  // At most one flexible single (recommended if no spread) + one hard optional tip
  if (flexibleSingles[0]) {
    const top = flexibleSingles[0];
    top.recommended = !scenarios.some((s) => s.recommended);
    scenarios.push(top);
  }
  if (hardSingles[0]) {
    const hard = hardSingles[0];
    // Only show hard tip if it beats the flexible single by a clear margin
    const flexLow = flexibleSingles[0]?.projectedLow ?? currentLow;
    if (hard.projectedLow > flexLow + 200) {
      hard.recommended = false;
      scenarios.push(hard);
    }
  }

  if (scenarios.length === 0 && underfunded) {
    scenarios.push({
      billId: "underfunded",
      billTitle: "Cash shortfall",
      currentDueDay: 0,
      moveToDay: 0,
      projectedLow: currentLow,
      recommended: false,
      note: `Projected low is ${formatMoney(currentLow)} — Timing cannot invent cash with due-date tweaks alone. Enter today's real balance in Buffers${lifestyle > 0 ? ` and/or cut daily burn (~${formatMoney(lifestyle)}/day)` : ""}, then reopen Timing.`,
    });
  }

  return scenarios
    .sort((a, b) => {
      if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
      const aLift = a.projectedLow - currentLow;
      const bLift = b.projectedLow - currentLow;
      if (Math.abs(aLift - bLift) > 0.5) return bLift - aLift;
      const aPlan = a.moves && a.moves.length > 1 ? 1 : 0;
      const bPlan = b.moves && b.moves.length > 1 ? 1 : 0;
      if (aPlan !== bPlan) return bPlan - aPlan;
      return b.projectedLow - a.projectedLow;
    })
    .slice(0, 3);
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export function runKashuWhatIf(
  profile: KashuProfileRow,
  items: KashuMoneyRow[],
  req: KashuWhatIfRequest
): KashuWhatIfResult {
  const scenarioItems = [...items];
  if (req.newMonthlyBill && req.newMonthlyBill.amount > 0) {
    scenarioItems.push({
      id: "whatif-new-bill",
      type: "SUBSCRIPTION",
      title: req.newMonthlyBill.title || "New bill",
      currentAmount: req.newMonthlyBill.amount,
      dueDay: req.newMonthlyBill.dueDay,
      autoPay: false,
      frequency: "MONTHLY",
      intervalDays: null,
      nextDueDate: null,
      priority: "NECESSARY",
      confidence: 1,
    });
  }

  const scenarioProfile: KashuProfileRow = { ...profile };
  if (req.cutLifestyleDaily != null && req.cutLifestyleDaily > 0) {
    scenarioProfile.lifestyleBurnDaily = Math.max(
      0,
      (profile.lifestyleBurnDaily ?? 0) - req.cutLifestyleDaily
    );
  }

  const common = {
    horizonDays: req.horizonDays,
    incomeScenario: req.incomeScenario,
  };

  const baseline = buildKashuForecast(profile, items, common);
  const scenario = buildKashuForecast(scenarioProfile, scenarioItems, {
    ...common,
    spendToday: req.spendToday,
    payDelta: (req.bonusDelta ?? 0) - (req.lowerIncomeBy ?? 0),
    moveBillId: req.moveBillId,
    moveBillToDay: req.moveBillToDay,
  });

  const deltaSafeToSpend = scenario.safeToSpend - baseline.safeToSpend;
  const deltaProjectedLow = scenario.projectedLow - baseline.projectedLow;
  const obligationsCovered = scenario.collisions.length === 0;
  const floor = Math.max(0, profile.safetyFloor ?? 0);
  const spend = req.spendToday ?? 0;

  let verdict: "yes" | "caution" | "no" = "yes";
  let canAfford = true;
  let verdictLabel = "Looks workable";

  if (spend > 0) {
    const withinSts = spend <= baseline.safeToSpend + 0.5;
    const staysAboveFloor = scenario.projectedLow >= floor;
    if (!withinSts || !obligationsCovered || !staysAboveFloor) {
      verdict = "no";
      canAfford = false;
      if (!withinSts) {
        verdictLabel = `No — ${formatMoney(spend)} is above Safe to Spend (${formatMoney(baseline.safeToSpend)})`;
      } else if (!obligationsCovered) {
        verdictLabel = "No — this spend creates a cash-flow collision";
      } else {
        verdictLabel = "No — projected low drops below your safety floor";
      }
    } else if (
      scenario.status === "yellow" ||
      deltaProjectedLow < -Math.max(100, baseline.safeToSpend * 0.15)
    ) {
      verdict = "caution";
      canAfford = true;
      verdictLabel = "Caution — affordable, but your buffer gets thinner";
    } else {
      verdict = "yes";
      canAfford = true;
      verdictLabel = `Yes — you can spend ${formatMoney(spend)} without breaking the plan`;
    }
  } else if (!obligationsCovered || scenario.projectedLow < floor) {
    verdict = "no";
    canAfford = false;
    verdictLabel = "This change creates a cash-flow problem";
  } else if (scenario.status === "yellow" || deltaProjectedLow < -100) {
    verdict = "caution";
    canAfford = true;
    verdictLabel = "Workable, but watch the projected low";
  } else {
    verdict = "yes";
    canAfford = true;
    verdictLabel =
      deltaProjectedLow >= 0
        ? "Improvement — projected low rises or holds"
        : "Looks workable";
  }

  let explanation = scenario.message;
  if (spend > 0) {
    explanation = `${verdictLabel}. Safe to Spend ${formatMoney(baseline.safeToSpend)} → ${formatMoney(scenario.safeToSpend)} (${deltaSafeToSpend >= 0 ? "+" : ""}${formatMoney(deltaSafeToSpend)}). Projected low ${formatMoney(baseline.projectedLow)} → ${formatMoney(scenario.projectedLow)}${scenario.projectedLowDate ? ` on ${scenario.projectedLowDate}` : ""}.`;
  } else if (req.newMonthlyBill) {
    explanation = `Adding ${req.newMonthlyBill.title || "a bill"} at ${formatMoney(req.newMonthlyBill.amount)}/mo: Safe to Spend ${formatMoney(baseline.safeToSpend)} → ${formatMoney(scenario.safeToSpend)}. Projected low ${formatMoney(baseline.projectedLow)} → ${formatMoney(scenario.projectedLow)}. ${verdictLabel}.`;
  } else if (req.moveBillId && req.moveBillToDay) {
    explanation = `${scenario.timingScenarios[0]?.note ?? scenario.message} ${verdictLabel}.`;
  } else if (req.lowerIncomeBy || req.bonusDelta) {
    explanation = `With the adjusted payday, Safe to Spend is ${formatMoney(scenario.safeToSpend)} and projected low is ${formatMoney(scenario.projectedLow)}. ${verdictLabel}.`;
  } else if (req.cutLifestyleDaily) {
    explanation = `Cutting daily lifestyle burn by ${formatMoney(req.cutLifestyleDaily)}: Safe to Spend ${formatMoney(scenario.safeToSpend)}, projected low ${formatMoney(scenario.projectedLow)}. ${verdictLabel}.`;
  }

  return {
    baseline: {
      safeToSpend: baseline.safeToSpend,
      projectedLow: baseline.projectedLow,
      projectedLowDate: baseline.projectedLowDate,
      message: baseline.message,
      status: baseline.status,
    },
    scenario: {
      safeToSpend: scenario.safeToSpend,
      projectedLow: scenario.projectedLow,
      projectedLowDate: scenario.projectedLowDate,
      message: scenario.message,
      collisions: scenario.collisions,
      status: scenario.status,
    },
    explanation,
    canAfford,
    verdict,
    verdictLabel,
    deltaSafeToSpend,
    deltaProjectedLow,
    obligationsCovered,
  };
}

/** Monthly residual fallback when liquid balance is unknown — keeps Life Finance panel honest. */
export function monthlySafeToSpendFallback(
  monthlyTakeHome: number,
  items: KashuMoneyRow[],
  monthlyInvestments: number,
  safetyFloor: number
) {
  const fixed = items
    .filter((i) => isCommitmentType(i.type))
    .reduce((s, i) => s + monthlyFlowAmount({ ...i, targetAmount: i.targetAmount ?? null }), 0);
  const plannedSavings = items
    .filter((i) => i.type === "SAVINGS")
    .reduce((s, i) => s + monthlyFlowAmount({ ...i, targetAmount: i.targetAmount ?? null }), 0);
  const available = Math.max(0, monthlyTakeHome - fixed - monthlyInvestments);
  return Math.max(0, available - plannedSavings - safetyFloor);
}
