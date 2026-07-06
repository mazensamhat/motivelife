import { prisma } from "@forward/database";
import type {
  CostOfLifeSlice,
  ExpenseBreakdown,
  FinancialPressureLevel,
  FinancialProfilePayload,
  LifeFinanceSnapshot,
  MoneyHealthComponent,
  RetirementScenario,
  UpcomingCommitment,
} from "@forward/shared";
import {
  MONEY_GRAPH_CATEGORIES,
  graphCategoryForType,
  isCommitmentType,
  monthlyFlowAmount,
} from "@forward/shared";
import { parseUserPersona } from "./user-persona";

type MoneyRow = {
  id: string;
  type: string;
  title: string;
  targetAmount: number | null;
  currentAmount: number;
  dueDay: number | null;
  autoPay: boolean;
};

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function clamp(n: number, min = 0, max = 100) {
  return Math.round(Math.min(max, Math.max(min, n)));
}

function isCommitmentTypeLocal(type: string) {
  return isCommitmentType(type);
}

function monthlyAmount(item: MoneyRow) {
  return monthlyFlowAmount(item);
}

function buildExpenseBreakdown(
  takeHome: number,
  items: MoneyRow[],
  profileInvestments: number
): ExpenseBreakdown {
  const totals = new Map<string, number>();

  for (const item of items) {
    const cat = graphCategoryForType(item.type);
    if (!cat || cat === "available") continue;
    const flow = monthlyFlowAmount(item);
    if (flow <= 0) continue;
    totals.set(cat, (totals.get(cat) ?? 0) + flow);
  }

  if (profileInvestments > 0) {
    totals.set(
      "investments",
      (totals.get("investments") ?? 0) + profileInvestments
    );
  }

  const outflowKeys = MONEY_GRAPH_CATEGORIES.filter((c) => c.key !== "available").map(
    (c) => c.key
  );
  const totalOutflows = outflowKeys.reduce((s, k) => s + (totals.get(k) ?? 0), 0);
  const available = Math.max(0, takeHome - totalOutflows);

  const categories = MONEY_GRAPH_CATEGORIES.map((meta) => {
    const amount =
      meta.key === "available" ? available : (totals.get(meta.key) ?? 0);
    return {
      key: meta.key,
      label: meta.label,
      amount,
      percentOfIncome: takeHome > 0 ? Math.round((amount / takeHome) * 100) : 0,
      color: meta.color,
    };
  }).filter((c) => c.key === "available" || c.amount > 0);

  return {
    monthlyIncome: takeHome,
    categories,
    available,
  };
}

function pressureLevel(ratio: number): FinancialPressureLevel {
  if (ratio >= 0.8) return "high";
  if (ratio >= 0.6) return "moderate";
  return "low";
}

function daysUntilDue(dueDay: number) {
  const now = new Date();
  const due = new Date(now.getFullYear(), now.getMonth(), dueDay);
  if (due < now) due.setMonth(due.getMonth() + 1);
  return Math.ceil((due.getTime() - now.getTime()) / 86400000);
}

function buildRetirementScenarios(input: {
  projectedAge: number;
  targetAge: number;
  monthlyNeeded: number;
  takeHome: number;
}): RetirementScenario[] {
  const { projectedAge, targetAge, monthlyNeeded, takeHome } = input;
  if (projectedAge <= targetAge) return [];

  const investBump = Math.max(150, Math.round(monthlyNeeded * 0.25 / 50) * 50);
  const spendCut = Math.max(100, Math.round(takeHome * 0.02 / 25) * 25);
  const salaryBump = Math.max(5000, Math.round(takeHome * 12 * 0.1 / 1000) * 1000);

  return [
    {
      id: "invest-more",
      label: "Increase investments",
      action: `+${formatMoney(investBump)}/month`,
      projectedRetirementAge: Math.max(targetAge, projectedAge - 2),
      impactLabel: `Retire at ${Math.max(targetAge, projectedAge - 2)}`,
    },
    {
      id: "reduce-spending",
      label: "Reduce discretionary spending",
      action: `${formatMoney(spendCut)}/month`,
      projectedRetirementAge: Math.max(targetAge, projectedAge - 1),
      impactLabel: `Retire at ${Math.max(targetAge, projectedAge - 1)}`,
    },
    {
      id: "salary-increase",
      label: "Salary increase",
      action: `+${formatMoney(salaryBump)}/year`,
      projectedRetirementAge: Math.max(targetAge, projectedAge - 3),
      impactLabel: `Retire at ${Math.max(targetAge, projectedAge - 3)}`,
    },
    {
      id: "combination",
      label: "Combination",
      action: "Invest more + trim spending",
      projectedRetirementAge: targetAge + 1,
      impactLabel: `Retire at ${targetAge + 1}`,
    },
  ];
}

export function profileToPayload(row: {
  grossAnnualIncome: number | null;
  monthlyTakeHome: number | null;
  monthlyInvestments: number | null;
  retirementTargetAge: number | null;
  emergencyFundMonths: number | null;
  householdSize: number | null;
  setupComplete: boolean;
}): FinancialProfilePayload {
  return {
    grossAnnualIncome: row.grossAnnualIncome,
    monthlyTakeHome: row.monthlyTakeHome,
    monthlyInvestments: row.monthlyInvestments,
    retirementTargetAge: row.retirementTargetAge,
    emergencyFundMonths: row.emergencyFundMonths,
    householdSize: row.householdSize,
    setupComplete: row.setupComplete,
  };
}

export async function getOrCreateFinancialProfile(userId: string) {
  const existing = await prisma.financialProfile.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.financialProfile.create({
    data: { userId },
  });
}

export async function buildLifeFinanceSnapshot(userId: string): Promise<LifeFinanceSnapshot> {
  const [profileRow, moneyItems, user] = await Promise.all([
    getOrCreateFinancialProfile(userId),
    prisma.moneyItem.findMany({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { birthYear: true, beliefs: true },
    }),
  ]);

  const profile = profileToPayload(profileRow);
  const items = moneyItems as MoneyRow[];

  const takeHome = profile.monthlyTakeHome ?? 0;
  const fixedMonthlyExpenses = items
    .filter((i) => isCommitmentTypeLocal(i.type))
    .reduce((sum, i) => sum + monthlyAmount(i), 0);

  const totalSavings = items.filter((i) => i.type === "SAVINGS").reduce((s, i) => s + i.currentAmount, 0);
  const totalInvestments = items
    .filter((i) => i.type === "INVESTMENT")
    .reduce((s, i) => s + i.currentAmount, 0);
  const totalRetirement = items
    .filter((i) => i.type === "RETIREMENT")
    .reduce((s, i) => s + i.currentAmount, 0);
  const totalDebt = items.filter((i) => i.type === "DEBT").reduce((s, i) => s + i.currentAmount, 0);

  const monthlyInvestments = profile.monthlyInvestments ?? 0;
  const availableMonthly = Math.max(0, takeHome - fixedMonthlyExpenses - monthlyInvestments);
  const recommendedInvestments =
    takeHome > 0 ? Math.round(Math.min(takeHome * 0.2, Math.max(availableMonthly * 0.5, 0))) : 0;
  const recommendedDiscretionary = Math.max(0, availableMonthly - recommendedInvestments);

  const fixedRatio = takeHome > 0 ? fixedMonthlyExpenses / takeHome : 0;
  const lifeCapacity = {
    moneyCapacity: clamp(100 - fixedRatio * 100),
    financialPressure: pressureLevel(fixedRatio),
    fixedExpenseRatio: Math.round(fixedRatio * 100),
  };

  const housing = items.filter((i) => i.type === "HOUSING").reduce((s, i) => s + i.currentAmount, 0);
  const subscriptions = items
    .filter((i) => i.type === "SUBSCRIPTION")
    .reduce((s, i) => s + i.currentAmount, 0);
  const bills = items.filter((i) => i.type === "BILL").reduce((s, i) => s + i.currentAmount, 0);
  const living = items
    .filter((i) => i.type === "LIVING_EXPENSE" || i.type === "COMMITMENT")
    .reduce((s, i) => s + i.currentAmount, 0);
  const debtPay = items.filter((i) => i.type === "DEBT").reduce((s, i) => s + monthlyAmount(i), 0);

  const expenseBreakdown = buildExpenseBreakdown(takeHome, items, monthlyInvestments);

  const slices: CostOfLifeSlice[] = [];
  const pushSlice = (key: string, label: string, amount: number) => {
    if (amount <= 0) return;
    slices.push({
      key,
      label,
      amount,
      percent: takeHome > 0 ? Math.round((amount / takeHome) * 100) : 0,
    });
  };
  pushSlice("housing", "Home", housing);
  pushSlice("subscriptions", "Subscriptions", subscriptions);
  pushSlice("bills", "Bills & utilities", bills);
  pushSlice("living", "Living expenses", living);
  pushSlice("debt", "Debt payments", debtPay);
  pushSlice("investing", "Investments", monthlyInvestments);
  pushSlice("available", "Available", availableMonthly);

  const emergencyTarget = (profile.emergencyFundMonths ?? 6) * fixedMonthlyExpenses;
  const emergencyScore =
    emergencyTarget > 0 ? clamp((totalSavings / emergencyTarget) * 100) : totalSavings > 0 ? 70 : 40;

  const cashFlowScore = takeHome > 0 ? clamp((availableMonthly / takeHome) * 100 + 20) : 50;
  const debtScore =
    takeHome > 0 && totalDebt > 0
      ? clamp(100 - (totalDebt / (takeHome * 12)) * 40)
      : totalDebt > 0
        ? 45
        : 85;
  const investScore =
    takeHome > 0
      ? clamp((monthlyInvestments / Math.max(takeHome * 0.15, 1)) * 100)
      : monthlyInvestments > 0
        ? 75
        : 50;

  const persona = user ? parseUserPersona(user) : { beliefs: [] };
  const wantsRetire55 = persona.beliefs.some((b) => b.id === "retire_55");
  const targetAge = profile.retirementTargetAge ?? (wantsRetire55 ? 55 : 65);
  const age = user?.birthYear ? new Date().getFullYear() - user.birthYear : 40;
  const yearsLeft = Math.max(1, targetAge - age);
  const nestEggTarget = wantsRetire55 ? 800_000 : 1_000_000;
  const retirementBalance = totalRetirement + totalInvestments + totalSavings * 0.5;
  const retirementProgress = nestEggTarget > 0 ? retirementBalance / nestEggTarget : 0;
  const retirementScore = clamp(retirementProgress * 100);
  const gap = Math.max(0, nestEggTarget - retirementBalance);
  const monthlyNeeded = Math.ceil(gap / (yearsLeft * 12));
  const onTrack = retirementProgress >= (age >= targetAge - 10 ? 0.7 : 0.4);
  const projectedAge = onTrack
    ? targetAge
    : Math.min(75, targetAge + Math.max(1, Math.round((1 - retirementProgress) * yearsLeft * 0.6)));

  const components: MoneyHealthComponent[] = [
    {
      key: "cashFlow",
      label: "Cash flow",
      score: cashFlowScore,
      hint: `${formatMoney(availableMonthly)} free after fixed costs`,
    },
    {
      key: "savings",
      label: "Savings",
      score: emergencyScore,
      hint:
        emergencyTarget > 0
          ? `${Math.round((totalSavings / emergencyTarget) * 100)}% of emergency fund`
          : "Build your safety net",
    },
    {
      key: "debt",
      label: "Debt",
      score: debtScore,
      hint: totalDebt > 0 ? `${formatMoney(totalDebt)} remaining` : "No tracked debt",
    },
    {
      key: "investments",
      label: "Investments",
      score: investScore,
      hint: `${formatMoney(monthlyInvestments)}/mo contributions`,
    },
    {
      key: "retirement",
      label: "Retirement",
      score: retirementScore,
      hint: onTrack ? `On pace for age ${targetAge}` : `Projected age ${projectedAge}`,
    },
  ];

  const overall = clamp(components.reduce((s, c) => s + c.score, 0) / components.length);

  const upcomingCommitments: UpcomingCommitment[] = items
    .filter((i) => isCommitmentType(i.type) && i.dueDay)
    .map((i) => {
      const days = daysUntilDue(i.dueDay!);
      const status: UpcomingCommitment["status"] =
        days <= 0 ? "paid" : days <= 5 ? "due_soon" : "upcoming";
      return {
        id: i.id,
        title: i.title,
        amount: i.currentAmount,
        dueDay: i.dueDay!,
        daysUntil: days,
        status,
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 8);

  let aiInsight =
    "Help your AI understand your financial life — complete your profile to unlock personalized guidance across career, retirement, and goals.";
  if (profile.setupComplete && takeHome > 0) {
    if (lifeCapacity.financialPressure === "high") {
      aiInsight = `Fixed costs use ${lifeCapacity.fixedExpenseRatio}% of take-home. This isn't a good month to add another commitment — protect ${formatMoney(availableMonthly)} for flexibility.`;
    } else if (!onTrack) {
      aiInsight = `At today's pace you retire around ${projectedAge}. Investing ${formatMoney(recommendedInvestments)}/month more moves you toward ${targetAge}.`;
    } else {
      aiInsight = `You have ~${formatMoney(availableMonthly)}/month after obligations. Directing ${formatMoney(recommendedInvestments)} toward investments keeps retirement on track at age ${targetAge}.`;
    }
  }

  return {
    profile,
    monthlyTakeHome: takeHome,
    fixedMonthlyExpenses,
    availableMonthly,
    recommendedInvestments,
    recommendedDiscretionary,
    totalSavings,
    totalInvestments,
    totalRetirement,
    totalDebt,
    costOfLife: slices,
    expenseBreakdown,
    lifeCapacity,
    moneyHealth: { overall, components },
    retirement:
      profile.setupComplete && takeHome > 0
        ? {
            targetAge,
            projectedAge,
            onTrack,
            headline: onTrack
              ? `On track to retire at ${targetAge}.`
              : `Projected retirement age ${projectedAge} — goal is ${targetAge}.`,
            scenarios: buildRetirementScenarios({
              projectedAge,
              targetAge,
              monthlyNeeded,
              takeHome,
            }),
          }
        : null,
    upcomingCommitments,
    aiInsight,
  };
}
