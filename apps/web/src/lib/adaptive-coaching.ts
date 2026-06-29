import { prisma } from "@forward/database";
import type { PrepChecklistItem } from "@forward/shared";
import type {
  ChallengeDay,
  CoachingBlocker,
  CoachingLoopPayload,
  CoachingModule,
  ModuleImprovementStack,
  ModuleLayerImprove,
  TodayImprovePayload,
} from "@forward/shared";
import { parseUserPersona, beliefCoachingHook } from "./user-persona";

function diningChallengeDays(): ChallengeDay[] {
  return [
    { day: 1, title: "Audit weekend spending", action: "List last 2 weekends' dining — no judgment, just data." },
    { day: 2, title: "One home meal swap", action: "Replace one restaurant meal with a 20-min home version." },
    { day: 3, title: "Set a dining cap", action: "Pick a weekly dining budget that feels generous, not restrictive." },
    { day: 4, title: "Plan Friday", action: "Decide Friday dinner before Thursday ends — removes impulse." },
    { day: 5, title: "Social without splurge", action: "One social outing under your cap (coffee, picnic, potluck)." },
    { day: 6, title: "Review the delta", action: "Compare this week vs last — note what felt easy." },
    { day: 7, title: "Lock the habit", action: "Pick one rule to keep (e.g. 'Fridays capped at $40')." },
  ];
}

function defaultMoneyChallenge(): ChallengeDay[] {
  return [
    { day: 1, title: "Snapshot", action: "Write down every bill and savings target in one view." },
    { day: 2, title: "One automatic move", action: "Schedule or simulate one auto-transfer to savings." },
    { day: 3, title: "Cut one leak", action: "Cancel or pause one subscription you forgot about." },
    { day: 4, title: "Debt or save $25", action: "Move $25 toward your highest-priority money goal." },
    { day: 5, title: "Bill buffer", action: "Ensure next bill has a reminder 3 days before due." },
    { day: 6, title: "Week review", action: "Note which money action felt easiest — repeat that." },
    { day: 7, title: "Next week plan", action: "Pick one money move for next Monday before Sunday ends." },
  ];
}

export async function buildMoneyImprovementStack(userId: string): Promise<ModuleImprovementStack> {
  const [items, userRow, activeLoop] = await Promise.all([
    prisma.moneyItem.findMany({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { preferences: true, beliefs: true } }),
    prisma.coachingLoop.findFirst({
      where: { userId, module: "money", status: "active" },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const persona = parseUserPersona(userRow ?? {});
  const bills = items.filter((i) => i.type === "BILL");
  const savings = items.filter((i) => i.type === "SAVINGS");
  const debt = items.filter((i) => i.type === "DEBT");

  const monthlyBills = bills.reduce((s, b) => s + b.currentAmount, 0);
  const totalTracked = items.reduce((s, i) => s + Math.abs(i.currentAmount), 0);

  const track = {
    headline:
      monthlyBills > 0
        ? `$${Math.round(monthlyBills).toLocaleString()} in tracked bills this month`
        : `$${Math.round(totalTracked).toLocaleString()} in tracked money items`,
    detail:
      bills.length > 0
        ? `${bills.length} bill${bills.length === 1 ? "" : "s"} · ${savings.length} savings · ${debt.length} debt`
        : "Add bills and savings targets to unlock deeper insights.",
    metric: monthlyBills > 0 ? `$${Math.round(monthlyBills)}` : undefined,
  };

  const discretionary = items.filter((i) =>
    /dining|restaurant|food|takeout|uber eats|doordash|weekend|entertainment|coffee|bar/i.test(
      `${i.title} ${i.notes ?? ""}`
    )
  );

  const understand =
    discretionary.length > 0
      ? {
          headline: "Most discretionary spend clusters around dining & weekends",
          detail: `Patterns in ${discretionary.map((i) => i.title).slice(0, 3).join(", ")} — small shifts here compound fast.`,
          insightId: "dining_weekends",
        }
      : savings.length > 0
        ? {
            headline: "Your focus is building savings, not cutting leaks",
            detail: `${savings[0]?.title ?? "Savings"} is your north star — consistency beats big moves.`,
            insightId: "savings_focus",
          }
        : {
            headline: "Fixed bills dominate — room to optimize cash flow",
            detail: "Once bills are mapped, the next win is one automated savings move.",
            insightId: "cash_flow",
          };

  let improve: ModuleLayerImprove | null = null;
  if (activeLoop?.currentChallenge) {
    try {
      const parsed = JSON.parse(activeLoop.currentChallenge) as {
        title: string;
        days: ChallengeDay[];
      };
      const done = parsed.days.filter((d) => d.done).length;
      improve = {
        headline: "Your personalized 7-day money challenge",
        detail: `${done}/${parsed.days.length} days complete · adapts as you progress`,
        challengeTitle: parsed.title,
        days: parsed.days,
        loopId: activeLoop.id,
      };
    } catch {
      /* regenerate below */
    }
  }

  if (!improve && items.length > 0) {
    const days =
      understand.insightId === "dining_weekends" ? diningChallengeDays() : defaultMoneyChallenge();
    const style =
      persona.preferences.reminderStyle === "direct"
        ? "No excuses — "
        : persona.preferences.reminderStyle === "statistics"
          ? "Data shows "
          : "";
    const hook = beliefCoachingHook(persona, "money");
    improve = {
      headline: "Ready for a 7-day personalized challenge",
      detail: `${style}reduce restaurant spending without feeling restricted.${hook ? ` ${hook}` : ""}`,
      challengeTitle:
        understand.insightId === "dining_weekends"
          ? "7-day dining reset"
          : "7-day money momentum",
      days,
    };
  }

  return { module: "money", track, understand, improve };
}

export async function startMoneyCoachingLoop(
  userId: string,
  stack: ModuleImprovementStack
): Promise<string> {
  return startModuleCoachingLoop(userId, "money", stack);
}

async function startModuleCoachingLoop(
  userId: string,
  module: CoachingModule,
  stack: ModuleImprovementStack,
  goalId?: string | null
): Promise<string> {
  if (!stack.improve) throw new Error("No improve layer");

  const existing = await prisma.coachingLoop.findFirst({
    where: { userId, module, status: "active", ...(goalId ? { goalId } : {}) },
  });
  if (existing) return existing.id;

  const loop = await prisma.coachingLoop.create({
    data: {
      userId,
      goalId: goalId ?? null,
      module,
      title: stack.improve.challengeTitle,
      phase: "coach",
      assessment: JSON.stringify({ track: stack.track, understand: stack.understand }),
      blockers: JSON.stringify([]),
      adaptations: JSON.stringify([]),
      currentChallenge: JSON.stringify({
        title: stack.improve.challengeTitle,
        days: stack.improve.days,
      }),
    },
  });

  return loop.id;
}

function mergeLoopIntoStack(
  stack: ModuleImprovementStack,
  activeLoop: { id: string; currentChallenge: string | null } | null
): ModuleImprovementStack {
  if (!activeLoop?.currentChallenge || !stack.improve) return stack;
  try {
    const parsed = JSON.parse(activeLoop.currentChallenge) as { title: string; days: ChallengeDay[] };
    const done = parsed.days.filter((d) => d.done).length;
    return {
      ...stack,
      improve: {
        ...stack.improve,
        headline: `Your personalized 7-day ${stack.module} challenge`,
        detail: `${done}/${parsed.days.length} days complete · adapts from real outcomes`,
        challengeTitle: parsed.title,
        days: parsed.days,
        loopId: activeLoop.id,
      },
    };
  } catch {
    return stack;
  }
}

export function assessInterviewBlockers(checklist: PrepChecklistItem[]): CoachingBlocker[] {
  const blockers: CoachingBlocker[] = [];
  const byId = new Map(checklist.map((i) => [i.id, i]));

  const researchDone = byId.get("1")?.done && byId.get("2")?.done;
  const introNotDone = byId.get("5") && !byId.get("5")?.done;
  const starNotDone = byId.get("3") && !byId.get("3")?.done;
  const questionsNotDone = byId.get("4") && !byId.get("4")?.done;

  if (researchDone && introNotDone) {
    blockers.push({ id: "confidence", label: "Confidence & self-presentation", severity: "high" });
  }
  if (starNotDone) {
    blockers.push({ id: "behavioral", label: "Behavioral (STAR) answers", severity: "high" });
  }
  if (questionsNotDone) {
    blockers.push({ id: "communication", label: "Two-way communication", severity: "medium" });
  }
  if (blockers.length === 0 && checklist.some((i) => !i.done)) {
    blockers.push({ id: "execution", label: "Follow-through on prep steps", severity: "medium" });
  }

  return blockers;
}

export function adaptInterviewChallenge(
  blockers: CoachingBlocker[],
  company: string
): ChallengeDay[] {
  const primary = blockers[0]?.id;

  if (primary === "confidence") {
    return [
      { day: 1, title: "60-second intro", action: `Record yourself answering "Tell me about yourself" for ${company}.` },
      { day: 2, title: "Mirror practice", action: "Practice intro again — focus on pace, not perfection." },
      { day: 3, title: "Mock with a friend", action: "15-min mock — intro + one behavioral question." },
      { day: 4, title: "Power poses + prep", action: "5-min confidence routine before one practice round." },
      { day: 5, title: "Tough question", action: 'Practice "What\'s your biggest weakness?" out loud.' },
      { day: 6, title: "Full mock", action: "30-min mock interview — intro, 2 STAR, 2 questions for them." },
      { day: 7, title: "Rest & review", action: "Watch recording once — note one improvement, not ten." },
    ];
  }

  if (primary === "behavioral") {
    return [
      { day: 1, title: "STAR story 1", action: "Write one leadership/conflict STAR story." },
      { day: 2, title: "STAR story 2", action: "Write one failure/learning STAR story." },
      { day: 3, title: "STAR story 3", action: "Write one collaboration STAR story." },
      { day: 4, title: "Out loud", action: "Practice all three — 2 min each, timed." },
      { day: 5, title: "Map to JD", action: `Match each story to a requirement in ${company}'s role.` },
      { day: 6, title: "Random prompt", action: "Pull 3 random behavioral Qs — answer without notes." },
      { day: 7, title: "Polish", action: "Trim each story to 90 seconds — cut the fluff." },
    ];
  }

  return [
    { day: 1, title: "Research deep dive", action: `Read ${company}'s last 2 product updates or news items.` },
    { day: 2, title: "JD mapping", action: "Highlight 5 skills from the JD you can prove with examples." },
    { day: 3, title: "Questions ready", action: "Draft 5 thoughtful questions for the interviewer." },
    { day: 4, title: "Logistics", action: "Confirm time zone, link, outfit, and backup plan." },
    { day: 5, title: "Practice intro", action: "60-second intro — record and replay once." },
    { day: 6, title: "One STAR story", action: "Practice one STAR story out loud." },
    { day: 7, title: "Rest", action: "Light review only — trust your prep." },
  ];
}

export async function getActiveCoachingLoops(userId: string): Promise<CoachingLoopPayload[]> {
  const loops = await prisma.coachingLoop.findMany({
    where: { userId, status: "active" },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  return loops.map((loop) => {
    let blockers: CoachingBlocker[] = [];
    let challenge: { days: ChallengeDay[]; title: string } | null = null;
    let adaptations: string[] = [];
    let assessmentSummary = loop.title;

    try {
      if (loop.blockers) blockers = JSON.parse(loop.blockers);
    } catch {
      /* ignore */
    }
    try {
      if (loop.currentChallenge) challenge = JSON.parse(loop.currentChallenge);
    } catch {
      /* ignore */
    }
    try {
      if (loop.adaptations) adaptations = JSON.parse(loop.adaptations);
    } catch {
      /* ignore */
    }
    try {
      if (loop.assessment) {
        const a = JSON.parse(loop.assessment) as { understand?: { headline?: string } };
        if (a.understand?.headline) assessmentSummary = a.understand.headline;
      }
    } catch {
      /* ignore */
    }

    const days = challenge?.days ?? [];
    const done = days.filter((d) => d.done).length;
    const today = days.find((d) => !d.done);

    return {
      id: loop.id,
      module: loop.module as CoachingModule,
      title: loop.title,
      phase: loop.phase as CoachingLoopPayload["phase"],
      goalId: loop.goalId,
      blockers,
      assessmentSummary,
      todayAction: today?.action ?? null,
      challengeProgress: days.length ? Math.round((done / days.length) * 100) : 0,
      adaptations,
      linkedEntityId: loop.linkedEntityId,
      nextDay: today?.day ?? 7,
    };
  });
}

const MODULE_HREF: Record<CoachingModule, string> = {
  money: "/money",
  health: "/health",
  learning: "/learning",
  career: "/career",
  relationships: "/relationships",
};

export function pickTodayImprove(
  loops: CoachingLoopPayload[],
  goalTitles?: Map<string, string>
): TodayImprovePayload | null {
  const candidates = loops.filter((l) => l.todayAction && l.challengeProgress < 100);
  const picked = candidates.find((l) => l.goalId) ?? candidates[0];
  if (!picked?.todayAction) return null;

  return {
    loopId: picked.id,
    module: picked.module,
    title: picked.title,
    todayAction: picked.todayAction,
    challengeProgress: picked.challengeProgress,
    goalTitle: picked.goalId ? goalTitles?.get(picked.goalId) ?? null : null,
    moduleHref: MODULE_HREF[picked.module],
    nextDay: picked.nextDay,
  };
}

async function createGoalLoop(
  userId: string,
  goal: { id: string; title: string; description: string | null; domain: string; progress: number },
  module: CoachingModule,
  days: ChallengeDay[],
  blockers: CoachingBlocker[],
  challengeTitle?: string
) {
  const title = challengeTitle ?? `7-day ${goal.title}`;
  await prisma.coachingLoop.create({
    data: {
      userId,
      goalId: goal.id,
      module,
      title: `Goal loop — ${goal.title}`,
      phase: "coach",
      assessment: JSON.stringify({ goalTitle: goal.title, progress: goal.progress }),
      blockers: JSON.stringify(blockers),
      currentChallenge: JSON.stringify({ title, days }),
      adaptations: JSON.stringify([]),
    },
  });
}

export async function ensureGoalCoachingLoopForGoal(
  userId: string,
  goal: { id: string; title: string; description: string | null; domain: string; progress: number }
): Promise<void> {
  if (goal.progress >= 85) return;

  const existing = await prisma.coachingLoop.findFirst({
    where: { userId, goalId: goal.id, status: "active" },
  });
  if (existing) return;

  const pick = pickGoalChallenge(goal);
  if (!pick) return;

  await createGoalLoop(userId, goal, pick.module, pick.days, pick.blockers, pick.challengeTitle);
}

export async function completeGoalCoachingLoops(userId: string, goalId: string): Promise<void> {
  await prisma.coachingLoop.updateMany({
    where: { userId, goalId, status: "active" },
    data: { status: "completed", phase: "measure" },
  });
}

export async function completeCoachingDay(
  userId: string,
  loopId: string,
  day: number
): Promise<{ adapted: boolean; blockers: CoachingBlocker[]; challengeComplete?: boolean }> {
  const loop = await prisma.coachingLoop.findFirst({ where: { id: loopId, userId } });
  if (!loop?.currentChallenge) return { adapted: false, blockers: [] };

  const challenge = JSON.parse(loop.currentChallenge) as { title: string; days: ChallengeDay[] };
  challenge.days = challenge.days.map((d) => (d.day === day ? { ...d, done: true } : d));

  const done = challenge.days.filter((d) => d.done).length;
  let adapted = false;
  let blockers: CoachingBlocker[] = [];

  if (done >= 3 && done < 5 && loop.module === "career" && loop.linkedEntityId) {
    const app = await prisma.jobApplication.findFirst({
      where: { id: loop.linkedEntityId, userId },
    });
    if (app?.prepChecklist) {
      try {
        const checklist = JSON.parse(app.prepChecklist) as PrepChecklistItem[];
        blockers = assessInterviewBlockers(checklist);
        if (blockers.length > 0 && blockers[0].id === "confidence") {
          challenge.days = adaptInterviewChallenge(blockers, app.company);
          adapted = true;
          const adaptations = loop.adaptations ? JSON.parse(loop.adaptations) : [];
          adaptations.push("Shifted focus to confidence after detecting strong research but weak self-presentation.");
          await prisma.coachingLoop.update({
            where: { id: loopId },
            data: {
              phase: "adapt",
              blockers: JSON.stringify(blockers),
              adaptations: JSON.stringify(adaptations),
              currentChallenge: JSON.stringify(challenge),
            },
          });
          return { adapted: true, blockers };
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (done >= 3 && done < 6 && !adapted) {
    const adaptations: string[] = loop.adaptations ? JSON.parse(loop.adaptations) : [];

    if (loop.module === "health") {
      const habits = await prisma.habit.findMany({ where: { userId, active: true } });
      const fitnessStreak = habits
        .filter((h) => /workout|walk|run|gym|steps/i.test(h.title))
        .reduce((s, h) => s + h.streak, 0);
      if (fitnessStreak === 0) {
        const undone = challenge.days.filter((d) => !d.done);
        const easier = healthMovementChallenge().slice(-undone.length);
        let i = 0;
        challenge.days = challenge.days.map((d) =>
          d.done ? d : { ...easier[i++], day: d.day, done: false }
        );
        adaptations.push("Outcome: no habit streak yet — shortened remaining days to minimum viable movement.");
        adapted = true;
      }
    }

    if (loop.module === "learning") {
      const items = await prisma.learningItem.findMany({ where: { userId } });
      const stalled = items.filter((i) => i.progress < 35);
      if (stalled.length > 0) {
        const title = stalled[0].title;
        const undone = challenge.days.filter((d) => !d.done);
        const micro = learningMicroChallenge(title).slice(-undone.length);
        let i = 0;
        challenge.days = challenge.days.map((d) =>
          d.done ? d : { ...micro[i++], day: d.day, done: false }
        );
        adaptations.push(`Outcome: "${title}" progress stalled — switched to 10-min micro-sessions.`);
        adapted = true;
      }
    }

    if (loop.module === "relationships" && done >= 3) {
      const items = await prisma.relationshipItem.findMany({ where: { userId } });
      const overdue = items.filter((i) => {
        if (!i.cadenceDays) return false;
        if (!i.lastContactAt) return true;
        return (Date.now() - i.lastContactAt.getTime()) / 86400000 > i.cadenceDays;
      });
      if (overdue.length > 0) {
        const name = overdue[0].title;
        const undone = challenge.days.filter((d) => !d.done);
        const focus = socialConnectionChallenge(name).slice(-undone.length);
        let i = 0;
        challenge.days = challenge.days.map((d) =>
          d.done ? d : { ...focus[i++], day: d.day, done: false }
        );
        adaptations.push(`Outcome: "${name}" is overdue — tightened remaining days to direct outreach.`);
        adapted = true;
      }
    }

    if (loop.module === "money" && done >= 4) {
      const items = await prisma.moneyItem.findMany({ where: { userId } });
      const stillDining = items.some((i) =>
        /dining|restaurant|weekend|takeout/i.test(`${i.title} ${i.notes ?? ""}`)
      );
      if (stillDining) {
        const undone = challenge.days.filter((d) => !d.done);
        const focus = diningChallengeDays().slice(-undone.length);
        let i = 0;
        challenge.days = challenge.days.map((d) =>
          d.done ? d : { ...focus[i++], day: d.day, done: false }
        );
        adaptations.push("Outcome: dining pattern still active — tightened the remaining challenge days.");
        adapted = true;
      }
    }

    if (adapted) {
      await prisma.coachingLoop.update({
        where: { id: loopId },
        data: {
          phase: "adapt",
          adaptations: JSON.stringify(adaptations),
          currentChallenge: JSON.stringify(challenge),
        },
      });
      return { adapted: true, blockers };
    }
  }

  const challengeComplete = done >= 7;

  await prisma.coachingLoop.update({
    where: { id: loopId },
    data: {
      currentChallenge: JSON.stringify(challenge),
      phase: challengeComplete ? "measure" : "coach",
      ...(challengeComplete ? { status: "completed" } : {}),
    },
  });

  return { adapted, blockers, challengeComplete: challengeComplete || undefined };
}

export async function ensureCareerInterviewLoop(
  userId: string,
  applicationId: string,
  company: string,
  role: string,
  checklist: PrepChecklistItem[]
): Promise<string | null> {
  const existing = await prisma.coachingLoop.findFirst({
    where: { userId, module: "career", linkedEntityId: applicationId, status: "active" },
  });
  if (existing) return existing.id;

  const blockers = assessInterviewBlockers(checklist);
  const days = adaptInterviewChallenge(blockers, company);

  const loop = await prisma.coachingLoop.create({
    data: {
      userId,
      module: "career",
      title: `Interview prep — ${company}`,
      phase: "coach",
      linkedEntityType: "JobApplication",
      linkedEntityId: applicationId,
      blockers: JSON.stringify(blockers),
      assessment: JSON.stringify({
        company,
        role,
        blockers: blockers.map((b) => b.label),
      }),
      currentChallenge: JSON.stringify({ title: `7-day ${role} prep`, days }),
      adaptations: JSON.stringify([]),
    },
  });

  return loop.id;
}

function healthMovementChallenge(): ChallengeDay[] {
  return [
    { day: 1, title: "Baseline", action: "10-min walk or stretch — any time of day." },
    { day: 2, title: "Same time", action: "Repeat yesterday's movement at the same time." },
    { day: 3, title: "Add 5 min", action: "15 minutes total — walk, yoga, or stairs." },
    { day: 4, title: "Recovery check", action: "Rate energy 1–10. Adjust intensity, not commitment." },
    { day: 5, title: "Stack a habit", action: "Pair movement with something you already do daily." },
    { day: 6, title: "Social move", action: "Walk with someone or join a class — accountability helps." },
    { day: 7, title: "Lock the slot", action: "Pick your default movement time for next week." },
  ];
}

function healthSleepChallenge(): ChallengeDay[] {
  return [
    { day: 1, title: "Wind-down time", action: "Set a screens-off time 45 min before bed." },
    { day: 2, title: "Same bedtime", action: "Hit your target bedtime ±15 min." },
    { day: 3, title: "Morning light", action: "10 min outside or bright light within an hour of waking." },
    { day: 4, title: "Caffeine cut", action: "No caffeine after 2pm (or your personal cutoff)." },
    { day: 5, title: "Room prep", action: "Cool, dark, phone outside bedroom." },
    { day: 6, title: "Review", action: "Note sleep quality — one change for next week." },
    { day: 7, title: "Protect the slot", action: "Block calendar for sleep like a meeting." },
  ];
}

function learningMicroChallenge(title: string): ChallengeDay[] {
  return [
    { day: 1, title: "15-min focus", action: `One focused session on ${title} — timer on.` },
    { day: 2, title: "Teach back", action: "Explain one concept from yesterday in 3 sentences." },
    { day: 3, title: "Apply it", action: "Use one thing you learned in a real task." },
    { day: 4, title: "Shorter burst", action: "10 min — consistency over marathon sessions." },
    { day: 5, title: "Remove friction", action: "Prep materials tonight for tomorrow's session." },
    { day: 6, title: "Checkpoint", action: "Update progress % honestly — what stuck?" },
    { day: 7, title: "Next sprint", action: "Pick the next sub-skill to focus on for 7 days." },
  ];
}

function homeSavingsChallenge(goalTitle: string): ChallengeDay[] {
  return [
    { day: 1, title: "Target clarity", action: `Write the exact number for "${goalTitle}" and today's gap.` },
    { day: 2, title: "Auto-save", action: "Set or simulate one weekly transfer toward the goal." },
    { day: 3, title: "One cut", action: "Find $20/week to redirect — subscription, dining, or impulse." },
    { day: 4, title: "Progress photo", action: "Screenshot balances — celebrate forward motion." },
    { day: 5, title: "Side income", action: "List one way to add $100 this month (even small)." },
    { day: 6, title: "Accountability", action: "Tell someone your weekly savings target." },
    { day: 7, title: "Review gap", action: "Recalculate months to goal — adjust if needed." },
  ];
}

function resumeChallenge(title: string): ChallengeDay[] {
  return [
    { day: 1, title: "Target role clarity", action: `Write ideal role, industry, and level for "${title}".` },
    { day: 2, title: "Achievement audit", action: "List 5 measurable wins from the last 2 years — numbers if possible." },
    { day: 3, title: "Rewrite top 3 bullets", action: "Turn your best wins into impact bullets (action + result)." },
    { day: 4, title: "Tailor one version", action: "Create a variant aligned to one target job posting." },
    { day: 5, title: "LinkedIn sync", action: "Update headline and About to match your resume story." },
    { day: 6, title: "Peer review", action: "Ask someone to skim for clarity — fix one confusing line." },
    { day: 7, title: "Send ready", action: "Export PDF and apply to one role today." },
  ];
}

function schoolChallenge(title: string): ChallengeDay[] {
  return [
    { day: 1, title: "Syllabus map", action: `List every deliverable and exam date tied to "${title}".` },
    { day: 2, title: "Study blocks", action: "Block 3 × 45-min study sessions this week on your calendar." },
    { day: 3, title: "Active recall", action: "Close notes — explain one key concept out loud in 2 minutes." },
    { day: 4, title: "Weak spot", action: "Identify the hardest topic — spend today there only." },
    { day: 5, title: "Practice problems", action: "Do 5 practice questions or exercises without looking up answers first." },
    { day: 6, title: "Teach someone", action: "Explain one concept to a friend or write a short summary." },
    { day: 7, title: "Week preview", action: "Plan next week's top 3 study priorities before Sunday ends." },
  ];
}

function workPerformanceChallenge(title: string): ChallengeDay[] {
  return [
    { day: 1, title: "Priority clarity", action: `Write the #1 outcome your manager cares about for "${title}".` },
    { day: 2, title: "Visibility note", action: "Send a brief update on progress — wins and blockers only." },
    { day: 3, title: "Deep work block", action: "Protect 90 min for your highest-impact task — calendar it." },
    { day: 4, title: "Stakeholder ping", action: "Ask one colleague for feedback on your recent work." },
    { day: 5, title: "Process win", action: "Document or automate one recurring task that eats time." },
    { day: 6, title: "Leadership moment", action: "Volunteer to own one small initiative or unblock someone." },
    { day: 7, title: "Review & pitch", action: "Draft 3 bullets of impact for your next 1:1 or review." },
  ];
}

function jobSearchChallenge(title: string): ChallengeDay[] {
  return [
    { day: 1, title: "Target list", action: "Pick 10 companies that fit your criteria — not just any job." },
    { day: 2, title: "Resume pass", action: "Ensure your top 3 bullets prove fit for your target role." },
    { day: 3, title: "Apply × 2", action: "Submit 2 tailored applications — quality over spray-and-pray." },
    { day: 4, title: "Network outreach", action: "Message 2 people at target companies — ask for insight, not a job." },
    { day: 5, title: "Follow up", action: "Follow up on one pending application or conversation." },
    { day: 6, title: "Pipeline review", action: "Update your tracker — what's working, what's stalled?" },
    { day: 7, title: "Next week plan", action: "Set a weekly apply + outreach target before Sunday." },
  ];
}

function socialConnectionChallenge(title: string): ChallengeDay[] {
  return [
    { day: 1, title: "Reach-out list", action: `Write 5 people you want to reconnect with for "${title}".` },
    { day: 2, title: "One genuine message", action: "Send one low-pressure check-in — no agenda required." },
    { day: 3, title: "Quality time", action: "Schedule a 20-min call, walk, or coffee with someone important." },
    { day: 4, title: "Listen mode", action: "Ask one person about their week — listen more than you talk." },
    { day: 5, title: "Small favor", action: "Offer help on something small — intro, feedback, or resource." },
    { day: 6, title: "New connection", action: "Introduce yourself in one community, class, or event." },
    { day: 7, title: "Protect the habit", action: "Pick one weekly connection ritual to keep (e.g. Friday check-ins)." },
  ];
}

function habitsChallenge(title: string): ChallengeDay[] {
  return [
    { day: 1, title: "Tiny start", action: `Do the smallest version of "${title}" — 2 minutes counts.` },
    { day: 2, title: "Same cue", action: "Stack the habit after something you already do daily." },
    { day: 3, title: "Track it", action: "Mark completion somewhere visible — streak starts here." },
    { day: 4, title: "Remove friction", action: "Prep tonight whatever makes tomorrow easier." },
    { day: 5, title: "Accountability", action: "Tell one person what you're building this week." },
    { day: 6, title: "Never miss twice", action: "If you slipped, restart today — no guilt spiral." },
    { day: 7, title: "Lock the ritual", action: "Pick your default time and place for next week." },
  ];
}

function projectSprintChallenge(title: string): ChallengeDay[] {
  return [
    { day: 1, title: "Scope slice", action: `Define the smallest shippable piece of "${title}".` },
    { day: 2, title: "Block time", action: "90 min deep work — no multitasking." },
    { day: 3, title: "Unblock", action: "Fix the one thing stopping progress — ask for help if needed." },
    { day: 4, title: "Demo draft", action: "Create something you could show someone, even if rough." },
    { day: 5, title: "Feedback", action: "Share progress with one person — collect one improvement." },
    { day: 6, title: "Ship slice", action: "Finish and publish the scoped piece — done beats perfect." },
    { day: 7, title: "Next sprint", action: "Pick the next slice before starting anything new." },
  ];
}

function travelFundChallenge(title: string): ChallengeDay[] {
  return [
    { day: 1, title: "Trip target", action: `Write destination, dates window, and budget for "${title}".` },
    { day: 2, title: "Price research", action: "Check flights and lodging for 3 date options." },
    { day: 3, title: "Weekly save", action: "Set or simulate one transfer toward the trip fund." },
    { day: 4, title: "Cut one leak", action: "Redirect $15–25/week from discretionary spend to travel." },
    { day: 5, title: "Itinerary draft", action: "Outline top 5 experiences — rough order, not perfect." },
    { day: 6, title: "Book or block", action: "Hold dates on calendar or book one refundable item." },
    { day: 7, title: "Countdown", action: "Recalculate weeks to goal — adjust savings if needed." },
  ];
}

function dreamMomentumChallenge(title: string): ChallengeDay[] {
  return [
    { day: 1, title: "Why it matters", action: `Write why "${title}" matters to you in 3 sentences.` },
    { day: 2, title: "First step", action: "Do one 15-min action that moves it forward — no planning only." },
    { day: 3, title: "Remove a blocker", action: "Solve the smallest obstacle stopping you." },
    { day: 4, title: "Find a model", action: "Find one example who did something similar — note 3 lessons." },
    { day: 5, title: "Share it", action: "Tell one person about the dream — verbal commitment helps." },
    { day: 6, title: "Momentum block", action: "45 min focused work on the dream — timer on." },
    { day: 7, title: "Next milestone", action: "Define the next measurable milestone for the following week." },
  ];
}

function businessLaunchChallenge(title: string): ChallengeDay[] {
  return [
    { day: 1, title: "Problem clarity", action: `Write the one problem "${title}" solves in one sentence.` },
    { day: 2, title: "Talk to one person", action: "Interview a potential customer — questions only, no pitch." },
    { day: 3, title: "Offer draft", action: "Define what you sell, to whom, and at what price (even rough)." },
    { day: 4, title: "Landing page", action: "Write a one-page description — headline, benefits, CTA." },
    { day: 5, title: "Outreach × 3", action: "Message 3 prospects with a specific value offer." },
    { day: 6, title: "Ship something", action: "Publish, send, or demo the smallest version of your offer." },
    { day: 7, title: "Review metrics", action: "Note responses, objections, and next experiment." },
  ];
}

type GoalForCoaching = {
  id: string;
  title: string;
  description: string | null;
  domain: string;
  progress: number;
};

type GoalChallengePick = {
  module: CoachingModule;
  days: ChallengeDay[];
  blockers: CoachingBlocker[];
  challengeTitle: string;
};

function goalText(goal: GoalForCoaching): string {
  return `${goal.title} ${goal.description ?? ""}`.toLowerCase();
}

function textMatches(blob: string, pattern: RegExp): boolean {
  return pattern.test(blob);
}

export function pickGoalChallenge(goal: GoalForCoaching): GoalChallengePick | null {
  const blob = goalText(goal);

  if (goal.domain === "MONEY") {
    const days = textMatches(blob, /home|house|down payment|mortgage/i)
      ? homeSavingsChallenge(goal.title)
      : textMatches(blob, /travel|trip|vacation|flight/i)
        ? travelFundChallenge(goal.title)
        : defaultMoneyChallenge();
    return {
      module: "money",
      days,
      blockers: [{ id: "savings_gap", label: "Close the gap to target", severity: "high" }],
      challengeTitle: `7-day ${goal.title}`,
    };
  }

  if (goal.domain === "HEALTH") {
    const days = textMatches(blob, /sleep|rest|insomnia|tired|energy/i)
      ? healthSleepChallenge()
      : healthMovementChallenge();
    return {
      module: "health",
      days,
      blockers: [{ id: "consistency", label: "Consistency", severity: "high" }],
      challengeTitle: `7-day ${goal.title}`,
    };
  }

  if (
    goal.domain === "RELATIONSHIPS" ||
    textMatches(blob, /\bsocial\b|friend|network|relationship|dating|community|connect|family/)
  ) {
    return {
      module: "relationships",
      days: socialConnectionChallenge(goal.title),
      blockers: [{ id: "reach_out", label: "Consistent outreach", severity: "medium" }],
      challengeTitle: `7-day connection — ${goal.title}`,
    };
  }

  if (
    textMatches(blob, /\bschool\b|college|university|degree|exam|study|class|course|gpa|homework|thesis|dissertation|semester/)
  ) {
    return {
      module: "learning",
      days: schoolChallenge(goal.title),
      blockers: [{ id: "study_system", label: "Study system", severity: "medium" }],
      challengeTitle: `7-day study sprint — ${goal.title}`,
    };
  }

  if (goal.domain === "LEARNING") {
    return {
      module: "learning",
      days: learningMicroChallenge(goal.title),
      blockers: [{ id: "momentum", label: "Build momentum", severity: "medium" }],
      challengeTitle: `7-day ${goal.title}`,
    };
  }

  if (goal.domain === "HABITS") {
    return {
      module: "health",
      days: habitsChallenge(goal.title),
      blockers: [{ id: "consistency", label: "Habit consistency", severity: "high" }],
      challengeTitle: `7-day habit build — ${goal.title}`,
    };
  }

  if (goal.domain === "PROJECTS") {
    return {
      module: "learning",
      days: projectSprintChallenge(goal.title),
      blockers: [{ id: "shipping", label: "Ship momentum", severity: "medium" }],
      challengeTitle: `7-day project sprint — ${goal.title}`,
    };
  }

  if (goal.domain === "TRAVEL") {
    return {
      module: "money",
      days: travelFundChallenge(goal.title),
      blockers: [{ id: "planning", label: "Plan and fund", severity: "medium" }],
      challengeTitle: `7-day trip prep — ${goal.title}`,
    };
  }

  if (goal.domain === "DREAMS") {
    return {
      module: "learning",
      days: dreamMomentumChallenge(goal.title),
      blockers: [{ id: "first_step", label: "First concrete step", severity: "medium" }],
      challengeTitle: `7-day dream momentum — ${goal.title}`,
    };
  }

  if (goal.domain === "CAREER" || goal.domain === "BUSINESS") {
    if (textMatches(blob, /resume|cv|curriculum|cover letter|linkedin profile/)) {
      return {
        module: "career",
        days: resumeChallenge(goal.title),
        blockers: [{ id: "positioning", label: "Clear positioning", severity: "high" }],
        challengeTitle: `7-day resume refresh — ${goal.title}`,
      };
    }
    if (textMatches(blob, /interview|offer|hiring|recruiter/)) {
      return {
        module: "career",
        days: adaptInterviewChallenge([{ id: "execution", label: "Follow-through", severity: "medium" }], goal.title),
        blockers: [{ id: "interview_ready", label: "Interview readiness", severity: "high" }],
        challengeTitle: `7-day interview prep — ${goal.title}`,
      };
    }
    if (textMatches(blob, /\bwork\b|promotion|manager|performance|raise|workplace|office|remote/)) {
      return {
        module: "career",
        days: workPerformanceChallenge(goal.title),
        blockers: [{ id: "impact", label: "Visible impact", severity: "medium" }],
        challengeTitle: `7-day work momentum — ${goal.title}`,
      };
    }
    if (goal.domain === "BUSINESS") {
      return {
        module: "career",
        days: businessLaunchChallenge(goal.title),
        blockers: [{ id: "traction", label: "Early traction", severity: "high" }],
        challengeTitle: `7-day business sprint — ${goal.title}`,
      };
    }
    return {
      module: "career",
      days: jobSearchChallenge(goal.title),
      blockers: [{ id: "pipeline", label: "Application pipeline", severity: "high" }],
      challengeTitle: `7-day job search — ${goal.title}`,
    };
  }

  return null;
}

export async function buildHealthImprovementStack(userId: string): Promise<ModuleImprovementStack> {
  const [items, habits, activeLoop, userRow] = await Promise.all([
    prisma.healthItem.findMany({ where: { userId } }),
    prisma.habit.findMany({ where: { userId, active: true } }),
    prisma.coachingLoop.findFirst({
      where: { userId, module: "health", status: "active" },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { preferences: true, beliefs: true } }),
  ]);

  const persona = parseUserPersona(userRow ?? {});
  const fitness = items.filter((i) => i.type === "FITNESS");
  const sleep = items.filter((i) => i.type === "SLEEP" || i.type === "WELLNESS");
  const fitnessHabits = habits.filter((h) => /workout|walk|run|gym|steps/i.test(h.title));
  const avgFitnessProgress =
    fitness.length > 0
      ? fitness.reduce((s, i) => {
          if (!i.targetValue) return s;
          return s + Math.min(100, (i.currentValue / i.targetValue) * 100);
        }, 0) / fitness.length
      : 0;

  const track = {
    headline:
      fitnessHabits.length > 0
        ? `${fitnessHabits.reduce((s, h) => s + h.streak, 0)} combined fitness streak days`
        : fitness.length > 0
          ? `${Math.round(avgFitnessProgress)}% avg fitness target progress`
          : "No health metrics tracked yet",
    detail: `${fitness.length} fitness · ${sleep.length} sleep/wellness · ${fitnessHabits.length} active habits`,
    metric: fitnessHabits.length > 0 ? `${fitnessHabits[0]?.streak ?? 0}-day streak` : undefined,
  };

  const sleepLag =
    sleep.length > 0 &&
    sleep.every((s) => !s.targetValue || s.currentValue / s.targetValue < 0.6) &&
    fitnessHabits.length > 0;

  const understand = sleepLag
    ? {
        headline: "Movement is happening — recovery and sleep are lagging",
        detail: "Energy compounds when output AND recovery both improve. Sleep is your multiplier.",
        insightId: "sleep_lag",
      }
    : fitness.length === 0 && fitnessHabits.length === 0
      ? {
          headline: "You're tracking intent, not outcomes yet",
          detail: "Add one fitness metric or habit — then we can coach specific improvements.",
          insightId: "needs_baseline",
        }
      : {
          headline: "Consistency matters more than intensity",
          detail: "Your data suggests small daily movement beats occasional big sessions.",
          insightId: "consistency",
        };

  let improve: ModuleLayerImprove | null = null;
  if (activeLoop?.currentChallenge) {
    try {
      const parsed = JSON.parse(activeLoop.currentChallenge) as { title: string; days: ChallengeDay[] };
      improve = {
        headline: "Your 7-day health challenge",
        detail: `${parsed.days.filter((d) => d.done).length}/${parsed.days.length} days complete`,
        challengeTitle: parsed.title,
        days: parsed.days,
        loopId: activeLoop.id,
      };
    } catch {
      /* fall through */
    }
  }

  if (!improve && (items.length > 0 || habits.length > 0)) {
    const days = understand.insightId === "sleep_lag" ? healthSleepChallenge() : healthMovementChallenge();
    const hook = beliefCoachingHook(persona, "health");
    improve = {
      headline: "Ready for a personalized health challenge",
      detail:
        (persona.preferences.reminderStyle === "direct"
          ? "7 days. Build the habit that sticks."
          : "7 gentle days — build capacity without burnout.") + (hook ? ` ${hook}` : ""),
      challengeTitle: understand.insightId === "sleep_lag" ? "7-day recovery reset" : "7-day movement habit",
      days,
    };
  }

  return mergeLoopIntoStack({ module: "health", track, understand, improve }, activeLoop);
}

export async function buildLearningImprovementStack(userId: string): Promise<ModuleImprovementStack> {
  const [items, activeLoop, userRow] = await Promise.all([
    prisma.learningItem.findMany({ where: { userId } }),
    prisma.coachingLoop.findFirst({
      where: { userId, module: "learning", status: "active" },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { preferences: true, beliefs: true } }),
  ]);

  const persona = parseUserPersona(userRow ?? {});
  const inProgress = items.filter((i) => i.progress > 0 && i.progress < 100);
  const stalled = items.filter((i) => i.progress < 30 && Date.now() - i.updatedAt.getTime() > 7 * 86400000);
  const avgProgress =
    items.length > 0 ? Math.round(items.reduce((s, i) => s + i.progress, 0) / items.length) : 0;

  const track = {
    headline:
      items.length > 0
        ? `${items.length} skill${items.length === 1 ? "" : "s"} tracked · ${avgProgress}% average progress`
        : "No learning items yet",
    detail: `${inProgress.length} in progress · ${stalled.length} stalled over 7 days`,
    metric: items.length > 0 ? `${avgProgress}%` : undefined,
  };

  const topStalled = stalled[0] ?? inProgress[0] ?? items[0];
  const understand =
    stalled.length > 0
      ? {
          headline: "Progress stalls after the first few sessions",
          detail: `"${topStalled?.title}" hasn't moved in a week — friction, not motivation, is the blocker.`,
          insightId: "stalled",
        }
      : inProgress.length > 0
        ? {
            headline: "You're mid-skill — depth beats breadth right now",
            detail: `Focus on ${topStalled?.title ?? "one skill"} until it crosses 50% before starting another.`,
            insightId: "depth",
          }
        : {
            headline: "Add a course, book, or skill to unlock coaching",
            detail: "Learning loops need one active target to personalize your plan.",
            insightId: "empty",
          };

  let improve: ModuleLayerImprove | null = null;
  if (activeLoop?.currentChallenge) {
    try {
      const parsed = JSON.parse(activeLoop.currentChallenge) as { title: string; days: ChallengeDay[] };
      improve = {
        headline: "Your 7-day learning sprint",
        detail: `${parsed.days.filter((d) => d.done).length}/${parsed.days.length} days complete`,
        challengeTitle: parsed.title,
        days: parsed.days,
        loopId: activeLoop.id,
      };
    } catch {
      /* fall through */
    }
  }

  if (!improve && topStalled) {
    const hook = beliefCoachingHook(persona, "learning");
    const itemBlob = topStalled.title.toLowerCase();
    const isSchool = textMatches(
      itemBlob,
      /\bschool\b|college|university|degree|exam|study|class|course|gpa|homework|thesis|dissertation|semester/
    );
    const isSocial = textMatches(itemBlob, /\bsocial\b|friend|network|relationship|dating|community|connect/);
    const days = isSchool
      ? schoolChallenge(topStalled.title)
      : isSocial
        ? socialConnectionChallenge(topStalled.title)
        : learningMicroChallenge(topStalled.title);
    const challengeTitle = isSchool
      ? `7-day study sprint — ${topStalled.title}`
      : isSocial
        ? `7-day connection — ${topStalled.title}`
        : `7-day ${topStalled.title} sprint`;
    improve = {
      headline: isSchool
        ? "Structured study beats cramming"
        : isSocial
          ? "Connection is a skill — practice it daily"
          : "Micro-learning beats marathon sessions",
      detail:
        (persona.preferences.taskLength === "short"
          ? "7 days of 10–15 min bursts — designed for how you learn."
          : "7 days of focused blocks — we'll adapt if progress stalls.") + (hook ? ` ${hook}` : ""),
      challengeTitle,
      days,
    };
  }

  return mergeLoopIntoStack({ module: "learning", track, understand, improve }, activeLoop);
}

export async function startHealthCoachingLoop(userId: string, stack: ModuleImprovementStack) {
  return startModuleCoachingLoop(userId, "health", stack);
}

export async function startLearningCoachingLoop(userId: string, stack: ModuleImprovementStack) {
  return startModuleCoachingLoop(userId, "learning", stack);
}

export async function startCareerCoachingLoop(userId: string, stack: ModuleImprovementStack) {
  return startModuleCoachingLoop(userId, "career", stack);
}

type CareerInsightId = "interview" | "resume" | "work" | "job_search" | "empty";

function pickCareerInsight(
  blob: string,
  interviewingCount: number
): CareerInsightId {
  if (interviewingCount > 0) return "interview";
  if (textMatches(blob, /resume|cv|curriculum|cover letter|linkedin profile/)) return "resume";
  if (textMatches(blob, /\bwork\b|promotion|manager|performance|raise|workplace|office|remote/)) return "work";
  if (textMatches(blob, /job search|apply|application|hire|role|offer/)) return "job_search";
  return "job_search";
}

function careerChallengeForInsight(
  insightId: CareerInsightId,
  label: string,
  company?: string,
  checklist?: PrepChecklistItem[]
): { days: ChallengeDay[]; title: string } {
  if (insightId === "interview") {
    const blockers = checklist ? assessInterviewBlockers(checklist) : [{ id: "execution", label: "Follow-through", severity: "medium" as const }];
    return {
      days: adaptInterviewChallenge(blockers, company ?? label),
      title: `7-day interview prep — ${company ?? label}`,
    };
  }
  if (insightId === "resume") {
    return { days: resumeChallenge(label), title: "7-day resume refresh" };
  }
  if (insightId === "work") {
    return { days: workPerformanceChallenge(label), title: "7-day work momentum" };
  }
  return { days: jobSearchChallenge(label), title: "7-day job search sprint" };
}

export async function buildCareerImprovementStack(userId: string): Promise<ModuleImprovementStack> {
  const [applications, goals, activeLoop, userRow] = await Promise.all([
    prisma.jobApplication.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }),
    prisma.goal.findMany({
      where: { userId, status: "ACTIVE", domain: { in: ["CAREER", "BUSINESS"] } },
      take: 5,
    }),
    prisma.coachingLoop.findFirst({
      where: { userId, module: "career", status: "active", goalId: null },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { preferences: true, beliefs: true } }),
  ]);

  const persona = parseUserPersona(userRow ?? {});
  const interviewing = applications.filter((a) => a.status === "INTERVIEW");
  const applied = applications.filter((a) => a.status === "APPLIED" || a.status === "INTERVIEW");
  const primaryGoal = goals[0];
  const blob = [
    ...goals.map((g) => `${g.title} ${g.description ?? ""}`),
    ...applications.map((a) => `${a.company} ${a.role} ${a.notes ?? ""}`),
  ]
    .join(" ")
    .toLowerCase();

  const track = {
    headline:
      applications.length > 0
        ? `${applications.length} application${applications.length === 1 ? "" : "s"} · ${interviewing.length} in interview`
        : goals.length > 0
          ? `${goals.length} active career goal${goals.length === 1 ? "" : "s"}`
          : "No career pipeline yet",
    detail:
      applied.length > 0
        ? `${applied.length} in pipeline · add applications or goals to personalize coaching`
        : "Track applications or add a career goal — school, resume, work, and social paths supported via goals.",
    metric: interviewing.length > 0 ? `${interviewing.length} interview${interviewing.length === 1 ? "" : "s"}` : undefined,
  };

  const insightId =
    applications.length === 0 && goals.length === 0
      ? ("empty" as CareerInsightId)
      : pickCareerInsight(blob, interviewing.length);

  const understand =
    insightId === "interview"
      ? {
          headline: "Interview stage — prep beats more applications",
          detail: `${interviewing[0]?.company ?? "Your next interview"} needs focused rehearsal, not scattershot applying.`,
          insightId: "interview",
        }
      : insightId === "resume"
        ? {
            headline: "Positioning is the bottleneck — not effort",
            detail: "Your goals point to resume and profile work before more outreach.",
            insightId: "resume",
          }
        : insightId === "work"
          ? {
              headline: "In-role momentum beats job hunting right now",
              detail: "Visibility, impact, and deep work will move your current work goal faster.",
              insightId: "work",
            }
          : insightId === "empty"
            ? {
                headline: "Add a career goal or application to unlock coaching",
                detail: "Try goals like resume refresh, school prep, job search, or workplace impact.",
                insightId: "empty",
              }
            : {
                headline: "Pipeline beats perfection — consistent outreach wins",
                detail: "Small daily apply + network actions compound faster than one perfect resume.",
                insightId: "job_search",
              };

  let improve: ModuleLayerImprove | null = null;
  if (activeLoop?.currentChallenge) {
    try {
      const parsed = JSON.parse(activeLoop.currentChallenge) as { title: string; days: ChallengeDay[] };
      improve = {
        headline: "Your 7-day career challenge",
        detail: `${parsed.days.filter((d) => d.done).length}/${parsed.days.length} days complete`,
        challengeTitle: parsed.title,
        days: parsed.days,
        loopId: activeLoop.id,
      };
    } catch {
      /* fall through */
    }
  }

  if (!improve && insightId !== "empty") {
    const interviewApp = interviewing[0];
    let checklist: PrepChecklistItem[] | undefined;
    if (interviewApp?.prepChecklist) {
      try {
        checklist = JSON.parse(interviewApp.prepChecklist) as PrepChecklistItem[];
      } catch {
        /* ignore */
      }
    }
    const label = primaryGoal?.title ?? interviewApp?.role ?? "your career";
    const { days, title } = careerChallengeForInsight(
      insightId,
      label,
      interviewApp?.company,
      checklist
    );
    const hook = beliefCoachingHook(persona, "career");
    improve = {
      headline: "Ready for a personalized career challenge",
      detail:
        (persona.preferences.reminderStyle === "direct"
          ? "7 days — resume, interview, work, or search. Pick your lane and execute."
          : "7 adaptive days tuned to school, resume, work, or job search.") + (hook ? ` ${hook}` : ""),
      challengeTitle: title,
      days,
    };
  }

  return mergeLoopIntoStack({ module: "career", track, understand, improve }, activeLoop);
}

function daysSinceContact(lastContactAt: Date | null): number | null {
  if (!lastContactAt) return null;
  return Math.floor((Date.now() - lastContactAt.getTime()) / 86400000);
}

function pickOverdueRelationship(
  items: { title: string; cadenceDays: number | null; lastContactAt: Date | null }[]
) {
  return items
    .filter((i) => {
      if (!i.cadenceDays) return false;
      const since = daysSinceContact(i.lastContactAt);
      return since === null || since > i.cadenceDays;
    })
    .sort((a, b) => {
      const sa = daysSinceContact(a.lastContactAt) ?? 999;
      const sb = daysSinceContact(b.lastContactAt) ?? 999;
      return sb - sa;
    })[0];
}

export async function buildRelationshipsImprovementStack(
  userId: string
): Promise<ModuleImprovementStack> {
  const [items, goals, activeLoop, userRow] = await Promise.all([
    prisma.relationshipItem.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }),
    prisma.goal.findMany({
      where: { userId, status: "ACTIVE", domain: "RELATIONSHIPS" },
      take: 5,
    }),
    prisma.coachingLoop.findFirst({
      where: { userId, module: "relationships", status: "active", goalId: null },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { preferences: true, beliefs: true } }),
  ]);

  const persona = parseUserPersona(userRow ?? {});
  const overdue = pickOverdueRelationship(items);
  const onTrack = items.filter((i) => {
    if (!i.cadenceDays || !i.lastContactAt) return false;
    const since = daysSinceContact(i.lastContactAt);
    return since !== null && since <= i.cadenceDays;
  });

  const track = {
    headline:
      items.length > 0
        ? `${items.length} connection${items.length === 1 ? "" : "s"} tracked · ${onTrack.length} on cadence`
        : goals.length > 0
          ? `${goals.length} active relationship goal${goals.length === 1 ? "" : "s"}`
          : "No connections tracked yet",
    detail:
      overdue != null
        ? `${overdue.title} is due for a check-in — small gestures beat big plans.`
        : items.length > 0
          ? "Consistency beats intensity — one genuine touchpoint at a time."
          : "Add family, friends, or community connections to unlock coaching.",
    metric: overdue ? "Check-in due" : items.length > 0 ? `${onTrack.length} on track` : undefined,
  };

  const understand =
    items.length === 0 && goals.length === 0
      ? {
          headline: "Relationships need a system, not guilt",
          detail: "Add people you care about — we'll coach check-ins before they slip.",
          insightId: "empty",
        }
      : overdue
        ? {
            headline: "Outreach lag is the pattern — not lack of caring",
            detail: `"${overdue.title}" hasn't heard from you in a while. A 2-minute message resets momentum.`,
            insightId: "overdue",
          }
        : onTrack.length >= Math.max(1, Math.floor(items.length / 2))
          ? {
              headline: "Your rhythm is working — deepen, don't spread thin",
              detail: "Quality time beats more contacts. Pick one relationship to invest in this week.",
              insightId: "deepen",
            }
          : {
              headline: "Connection is a habit — not a mood",
              detail: "Short, regular check-ins outperform occasional long catch-ups.",
              insightId: "cadence",
            };

  let improve: ModuleLayerImprove | null = null;
  if (activeLoop?.currentChallenge) {
    try {
      const parsed = JSON.parse(activeLoop.currentChallenge) as { title: string; days: ChallengeDay[] };
      improve = {
        headline: "Your 7-day connection challenge",
        detail: `${parsed.days.filter((d) => d.done).length}/${parsed.days.length} days complete`,
        challengeTitle: parsed.title,
        days: parsed.days,
        loopId: activeLoop.id,
      };
    } catch {
      /* fall through */
    }
  }

  if (!improve && (items.length > 0 || goals.length > 0)) {
    const focus = overdue?.title ?? items[0]?.title ?? goals[0]?.title ?? "your connections";
    const hook = beliefCoachingHook(persona, "relationships");
    improve = {
      headline: "Ready for a 7-day connection challenge",
      detail:
        (persona.preferences.reminderStyle === "direct"
          ? "7 days of outreach — no ghosting yourself."
          : "7 gentle days to rebuild connection rhythm.") + (hook ? ` ${hook}` : ""),
      challengeTitle: `7-day connection — ${focus}`,
      days: socialConnectionChallenge(focus),
    };
  }

  return mergeLoopIntoStack({ module: "relationships", track, understand, improve }, activeLoop);
}

export async function startRelationshipsCoachingLoop(userId: string, stack: ModuleImprovementStack) {
  return startModuleCoachingLoop(userId, "relationships", stack);
}

export async function ensureGoalCoachingLoops(userId: string): Promise<void> {
  const goals = await prisma.goal.findMany({
    where: { userId, status: "ACTIVE", progress: { lt: 85 } },
    take: 8,
  });

  for (const goal of goals) {
    await ensureGoalCoachingLoopForGoal(userId, goal);
  }
}
