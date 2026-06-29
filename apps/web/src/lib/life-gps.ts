import { prisma } from "@forward/database";
import { LIFE_FOCUS_OPTIONS, type LifeFocusId, type LifeGpsPayload } from "@forward/shared";
import { parseJsonArray } from "./life-os-parse";

const FOCUS_DESTINATION: Partial<Record<LifeFocusId, string>> = {
  save_house: "Buy a home",
  pay_debt: "Become debt-free",
  find_job: "Land your next role",
  get_promoted: "Get promoted",
  start_business: "Launch your business",
  build_muscle: "Build strength",
  lose_weight: "Reach your target weight",
  plan_retirement: "Retire on your terms",
  travel_more: "Travel more",
  finish_school: "Finish school",
};

function matchGoalByDestination(
  goals: { id: string; title: string; progress: number; targetDate: Date | null }[],
  destination: string
) {
  const needle = destination.toLowerCase();
  const exact = goals.find((g) => g.title.toLowerCase() === needle);
  if (exact) return exact;
  return goals.find(
    (g) =>
      g.title.toLowerCase().includes(needle) ||
      needle.includes(g.title.toLowerCase().slice(0, Math.min(needle.length, 8)))
  );
}

function inferDestinationFromFocuses(focuses: LifeFocusId[]): string | null {
  for (const id of focuses) {
    const label = FOCUS_DESTINATION[id];
    if (label) return label;
  }
  return null;
}

function formatEta(targetDate: Date | null): string | null {
  if (!targetDate) return null;
  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days < 0) return "Target date passed — adjust your plan";
  if (days === 0) return "Target is today";
  if (days < 30) return `~${days} days to target`;
  if (days < 365) return `~${Math.round(days / 30)} months to target`;
  return `~${Math.round(days / 365)} years to target`;
}

export async function getLifeGps(userId: string): Promise<LifeGpsPayload> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      lifeDestination: true,
      lifeDestinationGoalId: true,
      lifeFocuses: true,
    },
  });

  const focuses = parseJsonArray<LifeFocusId>(user?.lifeFocuses);
  const activeGoals = await prisma.goal.findMany({
    where: { userId, status: "ACTIVE" },
    select: { id: true, title: true, progress: true, targetDate: true },
    orderBy: [{ progress: "desc" }, { updatedAt: "desc" }],
  });

  let destination = user?.lifeDestination ?? null;
  let goalId: string | null = user?.lifeDestinationGoalId ?? null;
  let percentComplete = 0;
  let targetDate: Date | null = null;

  if (goalId) {
    const linked = activeGoals.find((g) => g.id === goalId);
    if (linked) {
      destination = destination ?? linked.title;
      percentComplete = linked.progress;
      targetDate = linked.targetDate;
    } else {
      goalId = null;
    }
  }

  if (!destination) {
    destination = inferDestinationFromFocuses(focuses);
  }

  if (destination && !goalId) {
    const matched = matchGoalByDestination(activeGoals, destination);
    if (matched) {
      goalId = matched.id;
      percentComplete = matched.progress;
      targetDate = matched.targetDate;
    }
  }

  if (!destination && activeGoals.length > 0) {
    const top = activeGoals[0];
    destination = top.title;
    goalId = top.id;
    percentComplete = top.progress;
    targetDate = top.targetDate;
  }

  if (!destination) {
    return {
      destination: null,
      percentComplete: 0,
      goalId: null,
      subtitle: "Set a destination and MotiveLife tracks your progress.",
      etaLabel: null,
    };
  }

  if (percentComplete === 0 && activeGoals.length > 0 && !goalId) {
    const avg = Math.round(
      activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length
    );
    percentComplete = avg;
  }

  const subtitle =
    percentComplete >= 100
      ? "Destination reached — time to set your next chapter."
      : percentComplete >= 75
        ? "You're in the home stretch."
        : percentComplete >= 40
          ? "Steady progress — keep the momentum."
          : "Every small step moves you closer.";

  return {
    destination,
    percentComplete: Math.min(100, Math.max(0, percentComplete)),
    goalId,
    subtitle,
    etaLabel: formatEta(targetDate),
  };
}
