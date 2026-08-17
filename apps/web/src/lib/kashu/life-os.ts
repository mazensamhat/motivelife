import type { KashuAffordVerdict, KashuLifeOsInsight } from "@forward/shared";
import { prisma } from "@forward/database";
import { getCalendarEvents } from "@/lib/calendar-events";
import { estimateTripFuelCost, type FuelType } from "@/lib/family-map/vehicle-fuel";
import { runKashuWhatIf, type KashuMoneyRow, type KashuProfileRow } from "@/lib/kashu/forecast";
import { parseGoalMonthlyNeed } from "@/lib/kashu/goal-cost";
import { collectVitaluKashuInsights } from "@/lib/vitalu/life-os";

const TRAVEL_RE =
  /\b(flight|hotel|airbnb|airport|conference|out of town|out-of-town|travel to|trip to|wedding|vacation|offsite)\b/i;
const SPENDY_RE = /\b(dinner|concert|birthday|shopping|client dinner|show|festival)\b/i;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function money(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function daysBetween(a: Date, b: Date) {
  return Math.round((startDay(b).getTime() - startDay(a).getTime()) / 86400000);
}

function startDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function collectKinzoFuelInsight(userId: string): Promise<{
  insight: KashuLifeOsInsight | null;
  extraDailyBurn: number;
}> {
  try {
    const me = await prisma.familyMember.findFirst({
      where: { userId, isSimulated: false },
      select: {
        id: true,
        fuelType: true,
        litresPer100km: true,
        kwhPer100km: true,
        fuelPriceCadPerLitre: true,
        evPriceCadPerKwh: true,
        shareDigitalTwinIntegration: true,
      },
    });
    if (!me || me.shareDigitalTwinIntegration === false) {
      return { insight: null, extraDailyBurn: 0 };
    }

    const now = Date.now();
    const recentFrom = new Date(now - 30 * 86400000);
    const prevFrom = new Date(now - 60 * 86400000);

    const trips = await prisma.familyTrip.findMany({
      where: {
        memberId: me.id,
        isActive: false,
        startedAt: { gte: prevFrom },
      },
      select: {
        distanceKm: true,
        estimatedFuelCostCad: true,
        startedAt: true,
        endedAt: true,
      },
    });

    let recentKm = 0;
    let prevKm = 0;
    let recentCost = 0;
    let prevCost = 0;
    for (const t of trips) {
      const when = t.endedAt ?? t.startedAt;
      const km = Number(t.distanceKm) || 0;
      let cost = t.estimatedFuelCostCad;
      if (cost == null && km > 0) {
        const fuelType = (["gas", "diesel", "hybrid", "ev"].includes(me.fuelType ?? "")
          ? me.fuelType
          : "gas") as FuelType;
        cost =
          estimateTripFuelCost({
            distanceKm: km,
            fuelType,
            litresPer100km: me.litresPer100km,
            kwhPer100km: me.kwhPer100km,
            fuelPriceCadPerLitre: me.fuelPriceCadPerLitre ?? 1.55,
            evPriceCadPerKwh: me.evPriceCadPerKwh ?? 0.14,
          }).costCad ?? km * 0.12;
      }
      if (when >= recentFrom) {
        recentKm += km;
        recentCost += cost ?? 0;
      } else {
        prevKm += km;
        prevCost += cost ?? 0;
      }
    }

    const extraKm = recentKm - prevKm;
    const extraCost = recentCost - prevCost;
    if (extraKm < 12 && extraCost < 8) return { insight: null, extraDailyBurn: 0 };

    const add = Math.max(extraCost, extraKm * 0.12);
    const extraDailyBurn = Math.round((add / 30) * 100) / 100;
    if (extraDailyBurn < 0.5) return { insight: null, extraDailyBurn: 0 };

    return {
      extraDailyBurn,
      insight: {
        id: "kinzo-fuel",
        source: "kinzo",
        title: "Extra kilometres this month",
        detail: `KINZO saw ~${Math.round(extraKm)} extra km vs the prior 30 days — about ${money(add)} more fuel. Kashu adds ${money(extraDailyBurn)}/day to living spend.`,
        href: "/family-map",
        extraDailyBurn,
        extraSpend: Math.round(add),
      },
    };
  } catch (error) {
    console.warn("[kashu life-os] kinzo", error);
    return { insight: null, extraDailyBurn: 0 };
  }
}

export async function collectDayOCalendarInsights(
  userId: string,
  nextPayday: string | null
): Promise<{
  insights: KashuLifeOsInsight[];
  extraSpendByDate: Record<string, { title: string; amount: number }>;
}> {
  const extraSpendByDate: Record<string, { title: string; amount: number }> = {};
  const insights: KashuLifeOsInsight[] = [];
  try {
    const events = await getCalendarEvents(userId, 21);
    const payday = nextPayday ? new Date(`${nextPayday}T12:00:00`) : null;

    let travelTotal = 0;
    let paydayPressure = 0;

    for (const ev of events) {
      const key = ymd(ev.start);
      const title = ev.title || "Calendar";
      const overnightMs = ev.end.getTime() - ev.start.getTime();
      const isTravel = TRAVEL_RE.test(title) || overnightMs > 18 * 3600000;
      const isSpendy = SPENDY_RE.test(title);
      if (!isTravel && !isSpendy) continue;

      let amount = isTravel ? (overnightMs > 18 * 3600000 ? 180 : 120) : 40;
      const dollar = title.match(/\$\s*([\d,]+)/);
      if (dollar) {
        const n = Number(dollar[1]!.replace(/,/g, ""));
        if (Number.isFinite(n) && n > 0) amount = n;
      }

      const existing = extraSpendByDate[key];
      extraSpendByDate[key] = {
        title: existing ? `${existing.title}; ${title}` : title,
        amount: (existing?.amount ?? 0) + amount,
      };

      if (isTravel) travelTotal += amount;
      if (payday) {
        const delta = daysBetween(ev.start, payday);
        if (delta >= 0 && delta <= 2) paydayPressure += amount;
      }
    }

    if (travelTotal >= 40) {
      insights.push({
        id: "dayo-travel",
        source: "dayo",
        title: "Calendar travel spend",
        detail: `DayO has out-of-town / overnight time on the calendar. Kashu reserves about ${money(travelTotal)} so Safe to Spend isn’t pretending those days are free.`,
        href: "/dashboard",
        extraSpend: travelTotal,
      });
    }

    if (paydayPressure >= 40 && payday) {
      insights.push({
        id: "dayo-payday",
        source: "dayo",
        title: "Busy calendar before payday",
        detail: `Events sit in the thin-cash window before ${nextPayday}. About ${money(paydayPressure)} of calendar spend lands before pay hits.`,
        href: "/kashu",
        extraSpend: paydayPressure,
      });
    }
  } catch (error) {
    console.warn("[kashu life-os] dayo", error);
  }
  return { insights, extraSpendByDate };
}

export function collectUpliftGoalInsights(
  goals: Array<{
    id: string;
    title: string;
    description: string | null;
    targetDate: Date | null;
    progress: number;
    targetAmount?: number | null;
    monthlyContribution?: number | null;
    status: string;
  }>,
  savingsByGoal: Map<string, { targetAmount: number | null; currentAmount: number }>,
  profile: KashuProfileRow,
  items: KashuMoneyRow[]
): KashuLifeOsInsight[] {
  const insights: KashuLifeOsInsight[] = [];
  for (const goal of goals) {
    if (goal.status !== "ACTIVE") continue;
    const savings = savingsByGoal.get(goal.id);
    const monthly = parseGoalMonthlyNeed({
      title: goal.title,
      description: goal.description,
      targetDate: goal.targetDate,
      progress: goal.progress,
      targetAmount: goal.targetAmount,
      monthlyContribution: goal.monthlyContribution,
      savingsRemaining:
        savings?.targetAmount != null
          ? Math.max(0, savings.targetAmount - savings.currentAmount)
          : null,
    });
    if (!monthly) continue;

    const dueDay = Math.min(28, Math.max(1, profile.paydayAnchorDay ?? 1));
    const whatIf = runKashuWhatIf(profile, items, {
      newMonthlyBill: { title: `${goal.title} (UPLIFT)`, amount: monthly, dueDay },
    });
    const verdict: KashuAffordVerdict = whatIf.verdict;
    insights.push({
      id: `uplift-${goal.id}`,
      source: "uplift",
      title: `${goal.title} needs ${money(monthly)}/mo`,
      detail: `Kashu: ${whatIf.verdictLabel}. ${whatIf.explanation}`,
      href: "/goals",
      extraMonthly: monthly,
      verdict,
      verdictLabel: whatIf.verdictLabel,
    });
  }
  return insights.slice(0, 4);
}

export type KashuLifeOsBundle = {
  insights: KashuLifeOsInsight[];
  extraDailyBurn: number;
  extraSpendByDate: Record<string, { title: string; amount: number }>;
};

export async function loadKashuLifeOsInputs(
  userId: string,
  profile: KashuProfileRow,
  items: KashuMoneyRow[],
  nextPayday: string | null
): Promise<KashuLifeOsBundle> {
  const [kinzo, dayo, goals, moneyItems, vitalu] = await Promise.all([
    collectKinzoFuelInsight(userId),
    collectDayOCalendarInsights(userId, nextPayday),
    prisma.goal
      .findMany({
        where: { userId, status: "ACTIVE" },
        select: {
          id: true,
          title: true,
          description: true,
          targetDate: true,
          progress: true,
          status: true,
        },
      })
      .catch(() => []),
    prisma.moneyItem
      .findMany({
        where: { userId, type: "SAVINGS", goalId: { not: null } },
        select: { goalId: true, targetAmount: true, currentAmount: true },
      })
      .catch(() => []),
    collectVitaluKashuInsights(userId, profile, items).catch(() => [] as KashuLifeOsInsight[]),
  ]);

  const savingsByGoal = new Map<string, { targetAmount: number | null; currentAmount: number }>();
  for (const m of moneyItems) {
    if (m.goalId) savingsByGoal.set(m.goalId, m);
  }

  const goalsWithCost = goals as Array<{
    id: string;
    title: string;
    description: string | null;
    targetDate: Date | null;
    progress: number;
    targetAmount?: number | null;
    monthlyContribution?: number | null;
    status: string;
  }>;

  try {
    const costRows = await prisma.$queryRaw<
      Array<{ id: string; targetAmount: number | null; monthlyContribution: number | null }>
    >`SELECT id, "targetAmount", "monthlyContribution" FROM "Goal" WHERE "userId" = ${userId} AND status = 'ACTIVE'`.catch(
      () => [] as Array<{ id: string; targetAmount: number | null; monthlyContribution: number | null }>
    );
    const byId = new Map(costRows.map((r) => [r.id, r]));
    for (const g of goalsWithCost) {
      const extra = byId.get(g.id);
      if (extra) {
        g.targetAmount = extra.targetAmount;
        g.monthlyContribution = extra.monthlyContribution;
      }
    }
  } catch {
    /* columns may not exist yet */
  }

  const uplift = collectUpliftGoalInsights(
    goalsWithCost,
    savingsByGoal,
    {
      ...profile,
      lifestyleBurnDaily: (profile.lifestyleBurnDaily ?? 0) + kinzo.extraDailyBurn,
    },
    items
  );
  const insights = [
    ...(kinzo.insight ? [kinzo.insight] : []),
    ...dayo.insights,
    ...uplift,
    ...vitalu,
  ];

  return {
    insights,
    extraDailyBurn: kinzo.extraDailyBurn,
    extraSpendByDate: dayo.extraSpendByDate,
  };
}
