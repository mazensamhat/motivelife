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

/** Occurrences of an obligation inside [from, toInclusive]. */
export function obligationDatesInRange(
  item: KashuMoneyRow,
  from: Date,
  to: Date,
  dueDayOverride?: number
): Date[] {
  const freq = normalizeFrequency(item.frequency);
  const dueDay = dueDayOverride ?? item.dueDay;
  const out: Date[] = [];

  if (freq === "ONE_OFF") {
    const once = item.nextDueDate ? startOfDay(item.nextDueDate) : null;
    if (once && once >= from && once <= to) out.push(once);
    return out;
  }

  if (freq === "MONTHLY" || freq === "ANNUAL") {
    if (!dueDay) return out;
    let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = to;
    while (cursor <= end) {
      const dim = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      const day = Math.min(dueDay, dim);
      const occ = new Date(cursor.getFullYear(), cursor.getMonth(), day);
      if (occ >= from && occ <= to) {
        if (freq === "MONTHLY" || cursor.getMonth() === from.getMonth() || occ.getMonth() === dueDay) {
          out.push(occ);
        }
        if (freq === "ANNUAL") {
          // only once per year on that month — use first month that has the day in range
          break;
        }
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      if (freq === "ANNUAL" && cursor.getFullYear() > from.getFullYear() + 1) break;
    }
    // Annual: also check same month next year if needed
    if (freq === "ANNUAL" && dueDay) {
      const annual = new Date(from.getFullYear(), from.getMonth(), Math.min(dueDay, 28));
      // Prefer nextDueDate if set
      if (item.nextDueDate) {
        const n = startOfDay(item.nextDueDate);
        if (n >= from && n <= to && !out.some((d) => ymd(d) === ymd(n))) out.push(n);
      } else if (annual < from) {
        annual.setFullYear(annual.getFullYear() + 1);
        if (annual <= to && !out.some((d) => ymd(d) === ymd(annual))) out.push(annual);
      }
    }
    return out.sort((a, b) => a.getTime() - b.getTime());
  }

  // Weekly / biweekly / semi-monthly from nextDueDate or dueDay
  let cursor =
    item.nextDueDate != null
      ? startOfDay(item.nextDueDate)
      : dueDay
        ? (() => {
            const d = new Date(from.getFullYear(), from.getMonth(), dueDay);
            if (d < from) d.setMonth(d.getMonth() + 1);
            return startOfDay(d);
          })()
        : null;
  if (!cursor) return out;
  while (cursor < from) {
    cursor = addDays(cursor, intervalFor(freq, item.intervalDays));
  }
  while (cursor <= to) {
    out.push(new Date(cursor));
    cursor = addDays(cursor, intervalFor(freq, item.intervalDays));
  }
  return out;
}

function paydayDates(
  profile: KashuProfileRow,
  from: Date,
  to: Date,
  scenario: KashuIncomeScenario = "expected"
): { dates: Date[]; amount: number } {
  const monthly = resolveMonthlyIncome(profile, scenario);
  const freq = (profile.payFrequency ?? "BIWEEKLY").toUpperCase() as KashuPayFrequency;
  const dates: Date[] = [];

  if (!monthly) return { dates, amount: 0 };

  let perPay = monthly;
  let step = 14;
  if (freq === "WEEKLY") {
    perPay = monthly / 4.33;
    step = 7;
  } else if (freq === "BIWEEKLY") {
    perPay = monthly / 2.17;
    step = 14;
  } else if (freq === "SEMI_MONTHLY") {
    perPay = monthly / 2;
    step = 15;
  } else if (freq === "MONTHLY") {
    perPay = monthly;
    step = 30;
  } else if (freq === "IRREGULAR") {
    // One known deposit at next payday — do not invent a cadence.
    perPay = monthly;
    const cursor = profile.nextPayday ? startOfDay(profile.nextPayday) : addDays(from, 7);
    if (cursor >= from && cursor <= to) dates.push(new Date(cursor));
    return { dates, amount: Math.round(perPay) };
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

  while (cursor < from) cursor = addDays(cursor, step);
  while (cursor <= to) {
    dates.push(new Date(cursor));
    if (freq === "MONTHLY" && profile.paydayAnchorDay) {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, profile.paydayAnchorDay);
      cursor = startOfDay(cursor);
    } else if (freq === "SEMI_MONTHLY" && profile.paydayAnchorDay) {
      cursor = addDays(cursor, 15);
    } else {
      cursor = addDays(cursor, step);
    }
  }

  return { dates, amount: Math.round(perPay) };
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
  return Math.min(1, Math.round(score * 100) / 100);
}

function reservedThroughHorizon(
  items: KashuMoneyRow[],
  from: Date,
  nextPayday: Date | null
): number {
  const end = nextPayday ?? addDays(from, 14);
  let reserved = 0;
  for (const item of items) {
    if (!isCommitmentType(item.type)) continue;
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
}): string {
  if (input.collisions.length > 0) {
    const c = input.collisions[0]!;
    return `A ${formatMoney(c.shortfall)} shortfall is projected on ${c.date} when ${c.title} is expected to post.`;
  }
  if (input.shortfall > 0) {
    return `Safe to Spend is $0 — you're short ${formatMoney(input.shortfall)} after reserved obligations and your safety floor.`;
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
    asOf?: Date;
    /** Simulate spending today (reduces starting balance) */
    spendToday?: number;
    /** Adjust next paycheque amount */
    payDelta?: number;
    /** Move one bill's due day for timing optimizer / what-if */
    moveBillId?: string;
    moveBillToDay?: number;
    /** Which income band to model when income is variable */
    incomeScenario?: KashuIncomeScenario;
  }
): KashuForecast {
  const asOf = startOfDay(opts?.asOf ?? new Date());
  const horizonDays = opts?.horizonDays ?? 30;
  const to = addDays(asOf, horizonDays);
  const floor = Math.max(0, profile.safetyFloor ?? 0);
  const emergency = Math.max(0, profile.emergencyReserve ?? 0);
  const lifestyleDaily = Math.max(0, profile.lifestyleBurnDaily ?? 0);
  const liquid = Math.max(0, (profile.liquidBalance ?? 0) - (opts?.spendToday ?? 0));
  const incomeKind = normalizeIncomeKind(profile.incomeKind);
  const incomeScenario: KashuIncomeScenario =
    opts?.incomeScenario ?? "expected";

  const pay = paydayDates(profile, asOf, to, incomeScenario);
  const nextPaydayDate = pay.dates[0] ?? profile.nextPayday ?? null;
  const nextPayday = nextPaydayDate ? ymd(startOfDay(nextPaydayDate)) : null;
  const daysUntilPayday = nextPaydayDate
    ? Math.max(0, Math.ceil((startOfDay(nextPaydayDate).getTime() - asOf.getTime()) / 86400000))
    : null;

  const reserved = reservedThroughHorizon(items, asOf, nextPaydayDate);
  const rawSafe = liquid - reserved - floor;
  const safeToSpend = Math.max(0, Math.round(rawSafe));
  const safeToSpendShortfall = rawSafe < 0 ? Math.round(-rawSafe) : 0;

  const commitmentItems = items.filter((i) => isCommitmentType(i.type));

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
    const amt = Math.max(0, pay.amount + (opts?.payDelta ?? 0));
    const title =
      incomeKind === "VARIABLE"
        ? `Payday (${incomeScenario})`
        : "Payday";
    scheduled.push({
      date: d,
      kind: "payday",
      title,
      amount: amt,
      id: `pay-${ymd(d)}-${incomeScenario}`,
    });
  }

  for (const item of commitmentItems) {
    const dueOverride =
      opts?.moveBillId === item.id && opts.moveBillToDay ? opts.moveBillToDay : undefined;
    const dates = obligationDatesInRange(item, asOf, to, dueOverride);
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
  let balance = liquid;
  let projectedLow = balance;
  let projectedLowDate: string | null = ymd(asOf);

  for (let i = 0; i <= horizonDays; i++) {
    const day = addDays(asOf, i);
    const key = ymd(day);
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

      if (ev.kind === "obligation" && balance < floor) {
        collisions.push({
          date: key,
          title: ev.title,
          shortfall: Math.round(floor - balance),
          projectedBalance: Math.round(balance),
          causeEventId: ev.id,
        });
      }
    }

    const lifestyleBurn = i === 0 ? 0 : lifestyleDaily;
    if (lifestyleBurn > 0) {
      balance -= lifestyleBurn;
      obligations += lifestyleBurn;
    }

    const ending = Math.round(balance);
    if (ending < projectedLow) {
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
  }

  const timingScenarios = buildTimingScenarios(
    profile,
    items,
    asOf,
    horizonDays,
    projectedLow,
    incomeScenario
  );
  const billWaves = buildBillWaves(radar);

  const status = statusFor(projectedLow, floor);
  const message = buildMessage({
    safeToSpend,
    shortfall: safeToSpendShortfall,
    projectedLow,
    projectedLowDate,
    floor,
    nextPayday,
    collisions,
  });

  const emergencyInsight = buildEmergencyInsight({
    emergency,
    shortfall: safeToSpendShortfall,
    lifestyleDaily,
    reserved,
    liquid,
  });

  const forecastConfidence = computeForecastConfidence({
    hasBalance: profile.liquidBalance != null && profile.liquidBalance > 0,
    hasIncome: resolveMonthlyIncome(profile, "expected") > 0,
    hasPayday: Boolean(profile.nextPayday),
    hasFloor: floor > 0,
    billCount: commitmentItems.length,
    incomeKind,
    hasBands:
      (profile.incomeConservative ?? 0) > 0 || (profile.incomeHigh ?? 0) > 0,
  });

  return {
    asOf: ymd(asOf),
    horizonDays,
    liquidBalance: Math.round(liquid),
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

function buildTimingScenarios(
  profile: KashuProfileRow,
  items: KashuMoneyRow[],
  asOf: Date,
  horizonDays: number,
  currentLow: number,
  incomeScenario: KashuIncomeScenario = "expected"
): KashuTimingScenario[] {
  // Prefer controllable bills (subscriptions / non-housing)
  const pool = items
    .filter(
      (i) =>
        isCommitmentType(i.type) &&
        i.dueDay &&
        i.type !== "HOUSING" &&
        i.currentAmount >= 50
    )
    .slice(0, 4);

  const scenarios: KashuTimingScenario[] = [];
  for (const bill of pool) {
    const currentDue = bill.dueDay!;
    const tryDays = [15, 20, 23, 28].filter((d) => d !== currentDue);
    let best: KashuTimingScenario | null = null;
    for (const day of tryDays) {
      const f = buildKashuForecast(profile, items, {
        asOf,
        horizonDays,
        moveBillId: bill.id,
        moveBillToDay: day,
        incomeScenario,
      });
      const scenario: KashuTimingScenario = {
        billId: bill.id,
        billTitle: bill.title,
        currentDueDay: currentDue,
        moveToDay: day,
        projectedLow: f.projectedLow,
        recommended: false,
        note: `Move ${bill.title} to the ${day}${ordinal(day)}`,
      };
      if (!best || scenario.projectedLow > best.projectedLow) best = scenario;
    }
    if (best && best.projectedLow > currentLow) {
      best.recommended = true;
      best.note = `Moving ${bill.title} from the ${currentDue}${ordinal(currentDue)} to the ${best.moveToDay}${ordinal(best.moveToDay)} would raise your projected minimum from ${formatMoney(currentLow)} to ${formatMoney(best.projectedLow)}.`;
      scenarios.push(best);
    }
  }

  return scenarios.sort((a, b) => b.projectedLow - a.projectedLow).slice(0, 3);
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
  const baseline = buildKashuForecast(profile, items);
  const scenario = buildKashuForecast(profile, items, {
    spendToday: req.spendToday,
    payDelta: (req.bonusDelta ?? 0) - (req.lowerIncomeBy ?? 0),
    moveBillId: req.moveBillId,
    moveBillToDay: req.moveBillToDay,
  });

  let explanation = scenario.message;
  if (req.spendToday && req.spendToday > 0) {
    explanation = `Spending ${formatMoney(req.spendToday)} today leaves about ${formatMoney(scenario.safeToSpend)} Safe to Spend. Projected low moves from ${formatMoney(baseline.projectedLow)} to ${formatMoney(scenario.projectedLow)}${scenario.projectedLowDate ? ` (${scenario.projectedLowDate})` : ""}.`;
  } else if (req.moveBillId && req.moveBillToDay) {
    explanation = scenario.timingScenarios[0]?.note ?? scenario.message;
  } else if (req.lowerIncomeBy || req.bonusDelta) {
    explanation = `With the adjusted payday, Safe to Spend is ${formatMoney(scenario.safeToSpend)} and projected low is ${formatMoney(scenario.projectedLow)}.`;
  }

  return {
    baseline: {
      safeToSpend: baseline.safeToSpend,
      projectedLow: baseline.projectedLow,
      projectedLowDate: baseline.projectedLowDate,
      message: baseline.message,
    },
    scenario: {
      safeToSpend: scenario.safeToSpend,
      projectedLow: scenario.projectedLow,
      projectedLowDate: scenario.projectedLowDate,
      message: scenario.message,
      collisions: scenario.collisions,
    },
    explanation,
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
