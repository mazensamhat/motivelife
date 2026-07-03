import { prisma } from "@forward/database";
import { parseUserPersona } from "./user-persona";

/** Simple retirement gap — rule-based, no external APIs */
export interface RetirementGapPayload {
  show: boolean;
  retireAge: number;
  yearsLeft: number;
  currentSaved: number;
  targetNestEgg: number;
  gap: number;
  monthlyNeeded: number;
  onTrack: boolean;
  headline: string;
  detail: string;
  scienceNote: string;
  projectedRetirementAge: number;
  extraMonthlySavings: number;
  yearsEarlierWithExtra: number;
}

const DEFAULT_NEST_EGG = 1_000_000;
const RETIRE_55_NEST_EGG = 800_000;

export async function computeRetirementGap(userId: string): Promise<RetirementGapPayload | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { birthYear: true, lifeFocuses: true, beliefs: true, preferences: true },
  });

  if (!user?.birthYear) return null;

  const age = new Date().getFullYear() - user.birthYear;
  const persona = parseUserPersona(user);
  const focuses = user.lifeFocuses ? (JSON.parse(user.lifeFocuses) as string[]) : [];
  const wantsRetire55 = persona.beliefs.some((b) => b.id === "retire_55");
  const planRetirement = focuses.includes("plan_retirement");

  if (age < 35 && !planRetirement && !wantsRetire55) return null;

  const retireAge = wantsRetire55 ? 55 : 65;
  const yearsLeft = Math.max(1, retireAge - age);

  const savingsItems = await prisma.moneyItem.findMany({
    where: { userId, type: "SAVINGS" },
  });

  const currentSaved = savingsItems.reduce((sum, i) => sum + i.currentAmount, 0);
  const savingsTarget = savingsItems.reduce(
    (max, i) => Math.max(max, i.targetAmount ?? 0),
    0
  );

  const targetNestEgg =
    savingsTarget >= 100_000 ? savingsTarget : wantsRetire55 ? RETIRE_55_NEST_EGG : DEFAULT_NEST_EGG;
  const gap = Math.max(0, targetNestEgg - currentSaved);
  const monthlyNeeded = Math.ceil(gap / (yearsLeft * 12));
  const progressPct = targetNestEgg > 0 ? (currentSaved / targetNestEgg) * 100 : 0;
  const onTrack = progressPct >= (age >= retireAge - 10 ? 70 : 40) || gap === 0;

  const gapLabel = gap >= 1000 ? `$${Math.round(gap / 1000)}K` : `$${gap}`;

  let headline = onTrack
    ? `You're ${Math.round(progressPct)}% toward your retirement target.`
    : `$${gapLabel} gap to close before ${retireAge}.`;

  let detail = onTrack
    ? `At ${retireAge}, steady saving keeps you on pace toward ${formatMoney(targetNestEgg)}.`
    : `Saving ${formatMoney(monthlyNeeded)}/month gets you to ${formatMoney(targetNestEgg)} by ${retireAge}.`;

  if (persona.preferences.reminderStyle === "statistics") {
    detail = `${Math.round(progressPct)}% funded · ${yearsLeft} years left · ${formatMoney(monthlyNeeded)}/mo closes the gap.`;
  } else if (persona.preferences.reminderStyle === "direct") {
    headline = onTrack ? "Retirement: on pace." : `Retirement gap: ${formatMoney(gap)}.`;
    detail = onTrack
      ? `Keep ${formatMoney(monthlyNeeded)}/mo or more.`
      : `${formatMoney(monthlyNeeded)}/mo until ${retireAge}. Start this month.`;
  }

  return {
    show: true,
    retireAge,
    yearsLeft,
    currentSaved,
    targetNestEgg,
    gap,
    monthlyNeeded,
    onTrack,
    headline,
    detail,
    projectedRetirementAge: onTrack
      ? retireAge
      : Math.min(75, retireAge + Math.max(1, Math.round((gap / Math.max(targetNestEgg, 1)) * yearsLeft))),
    extraMonthlySavings: Math.max(150, Math.round((monthlyNeeded * 0.35) / 10) * 10),
    yearsEarlierWithExtra:
      gap > 0
        ? Math.min(
            8,
            Math.round(((gap * 0.18) / Math.max(monthlyNeeded * 0.35 * 12, 1)) * 10) / 10
          )
        : 0,
    scienceNote:
      "Based on the 4% rule: ~25× annual spending in invested assets supports a sustainable retirement withdrawal rate.",
  };
}

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
