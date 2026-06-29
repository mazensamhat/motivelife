import { prisma } from "@forward/database";
import type {
  MorningReflectionContext,
  ReflectionExtraction,
  VoiceCaptureAppliedAction,
  VoiceCapturePlan,
  VoiceCaptureSource,
} from "@forward/shared";
import { ensureGoalCoachingLoopForGoal } from "./adaptive-coaching";
import { autoLinkGoalToDestination } from "./life-graph";
import { recordLifeMoment } from "./life-moments";
import { applyVoiceCoachingCommands } from "./voice-coaching-commands";
import { startOfDay } from "./api";

function endOfDay(date = new Date()) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
}

const VALID_DOMAINS = new Set<string>([
  "CAREER",
  "MONEY",
  "HEALTH",
  "LEARNING",
  "RELATIONSHIPS",
  "TRAVEL",
  "BUSINESS",
  "HABITS",
  "PROJECTS",
  "DREAMS",
]);

function asDomain(value: string | null | undefined) {
  if (!value || !VALID_DOMAINS.has(value)) return undefined;
  return value as import("@forward/shared").LifeDomain;
}

function dedupeMemories(memories: VoiceCapturePlan["memories"]) {
  const seen = new Set<string>();
  return memories.filter((m) => {
    const key = m.content.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function reflectionFromPlan(plan: VoiceCapturePlan): ReflectionExtraction {
  return {
    wins: plan.wins ?? [],
    problems: plan.problems ?? [],
    ideas: plan.ideas ?? [],
    tomorrowPriorities: plan.tomorrowPriorities ?? [],
    habits: plan.habits ?? [],
  };
}

async function syncEveningReviewFromReflection(
  userId: string,
  plan: VoiceCapturePlan,
  transcript: string
) {
  const today = startOfDay();
  const tomorrow = endOfDay();

  const [completedTasks, completedCount] = await Promise.all([
    prisma.task.findMany({
      where: { userId, status: "DONE", completedAt: { gte: today } },
      select: { title: true },
      take: 10,
    }),
    prisma.task.count({
      where: { userId, status: "DONE", completedAt: { gte: today } },
    }),
  ]);

  const highlight = plan.wins?.[0] ?? plan.summary;
  const carryForward =
    plan.tomorrowPriorities?.[0] ?? plan.tasks[0]?.title ?? null;
  const summary =
    plan.summary ||
    (plan.wins?.length
      ? `Wins: ${plan.wins.slice(0, 2).join("; ")}`
      : transcript.slice(0, 400));

  const existing = await prisma.eveningReview.findFirst({
    where: { userId, date: { gte: today, lt: tomorrow } },
  });

  const data = {
    completedCount,
    completedTasks: JSON.stringify(completedTasks.map((t) => t.title)),
    highlight: highlight?.slice(0, 500) ?? null,
    carryForward: carryForward?.slice(0, 500) ?? null,
    summary: summary.slice(0, 2000),
  };

  if (existing) {
    await prisma.eveningReview.update({ where: { id: existing.id }, data });
  } else {
    await prisma.eveningReview.create({
      data: { userId, date: today, ...data },
    });
  }
}

export async function applyVoiceCapturePlan(
  userId: string,
  plan: VoiceCapturePlan,
  source: VoiceCaptureSource = "capture",
  transcript?: string
): Promise<VoiceCaptureAppliedAction[]> {
  const applied: VoiceCaptureAppliedAction[] = [];
  const today = startOfDay();

  for (const memory of dedupeMemories(plan.memories)) {
    const row = await prisma.memory.create({
      data: {
        userId,
        content: memory.content,
        type: memory.type ?? "FACT",
        domain: asDomain(memory.domain ?? null),
      },
    });
    applied.push({
      type: "memory",
      label: `Memory saved`,
      entityId: row.id,
      href: "/memory",
    });
  }

  for (const win of plan.wins ?? []) {
    applied.push({ type: "memory", label: `Win: ${win.slice(0, 60)}`, href: "/memory" });
  }

  for (const problem of plan.problems ?? []) {
    applied.push({ type: "insight", label: `Noted: ${problem.slice(0, 60)}`, href: "/memory" });
  }

  for (const goalInput of plan.goals) {
    const domain = asDomain(goalInput.domain) ?? "HABITS";
    const goal = await prisma.goal.create({
      data: {
        userId,
        title: goalInput.title.slice(0, 200),
        description: goalInput.description ?? undefined,
        domain,
      },
    });
    await autoLinkGoalToDestination(userId, goal.id, goal.title);
    await ensureGoalCoachingLoopForGoal(userId, goal);
    applied.push({
      type: "goal",
      label: `Goal: ${goal.title}`,
      entityId: goal.id,
      href: "/dashboard#life-gps",
    });
  }

  for (const taskInput of plan.tasks) {
    const priority = (["LOW", "MEDIUM", "HIGH", "URGENT"] as const).includes(
      taskInput.priority as "LOW"
    )
      ? (taskInput.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT")
      : source === "night_reflection"
        ? "HIGH"
        : "MEDIUM";
    const task = await prisma.task.create({
      data: {
        userId,
        title: taskInput.title.slice(0, 200),
        priority,
      },
    });
    applied.push({
      type: "task",
      label: `Task: ${task.title}`,
      entityId: task.id,
      href: "/tasks",
    });
  }

  for (const note of plan.healthNotes) {
    const isSleep = /sleep/i.test(note.title) || note.unit === "hours";
    const item = await prisma.healthItem.create({
      data: {
        userId,
        type: isSleep ? "SLEEP" : "WELLNESS",
        title: note.title.slice(0, 200),
        currentValue: note.value ?? 0,
        targetValue: isSleep && note.value ? Math.max(note.value, 7) : undefined,
        unit: note.unit ?? undefined,
        notes: note.notes ?? undefined,
      },
    });
    applied.push({
      type: "health",
      label: `Health: ${item.title}`,
      entityId: item.id,
      href: "/health",
    });
  }

  for (const note of plan.moneyNotes) {
    const content =
      note.notes ??
      (note.amount != null ? `${note.title}: $${note.amount}` : note.title);
    await prisma.memory.create({
      data: {
        userId,
        content: content.slice(0, 2000),
        type: "FACT",
        domain: "MONEY",
      },
    });
    applied.push({
      type: "money",
      label: note.amount != null ? `$${note.amount} spend logged` : `Money note captured`,
      href: "/money",
    });
  }

  for (const note of plan.relationshipNotes) {
    const item = await prisma.relationshipItem.create({
      data: {
        userId,
        type: "FAMILY",
        title: note.title.slice(0, 200),
        notes: note.notes ?? undefined,
        cadenceDays: 14,
        lastContactAt: new Date(),
      },
    });
    applied.push({
      type: "relationship",
      label: `Connection: ${item.title}`,
      entityId: item.id,
      href: "/relationships",
    });
  }

  for (const insight of plan.insights) {
    try {
      await prisma.lifeInsight.create({
        data: {
          userId,
          date: today,
          insight: insight.text.slice(0, 500),
          category: insight.category ?? "PATTERN",
          evidence: JSON.stringify({ source: "voice_capture" }),
        },
      });
      applied.push({
        type: "insight",
        label: insight.text.slice(0, 80),
        href: "/memory",
      });
    } catch {
      /* duplicate */
    }
  }

  for (const signal of plan.signals) {
    applied.push({
      type: "signal",
      label: `Signal: ${signal.replace(/_/g, " ")}`,
    });
  }

  if (source === "night_reflection") {
    await syncEveningReviewFromReflection(
      userId,
      plan,
      plan.memories[0]?.content ?? plan.summary
    );
    applied.unshift({
      type: "insight",
      label: "Evening review updated from your voice",
      href: "/dashboard",
    });
  }

  if (applied.some((a) => a.type === "memory")) {
    await recordLifeMoment(userId, {
      title: plan.summary.slice(0, 120),
      domain: asDomain(plan.memories[0]?.domain ?? null) ?? "HABITS",
      scoreDelta: source === "night_reflection" ? 5 : 3,
      sourceType: "VOICE_CAPTURE",
    });
  }

  if (transcript && source !== "voice_practice") {
    const coachingActions = await applyVoiceCoachingCommands(userId, transcript);
    for (const action of coachingActions) {
      applied.unshift(action);
    }
    if (coachingActions.length > 0 && !plan.coachNote) {
      plan.coachNote = "Challenge started from your voice command.";
    }
  }

  return applied;
}

export async function getYesterdayVoiceBriefing(userId: string) {
  const today = startOfDay();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const captures = await prisma.voiceCapture.findMany({
    where: {
      userId,
      createdAt: { gte: yesterday, lt: today },
      source: { not: "voice_practice" },
    },
    orderBy: { createdAt: "desc" },
  });

  if (captures.length === 0) return null;

  const night = captures.find((c) => c.source === "night_reflection") ?? captures[0];
  let signals: string[] = [];
  try {
    if (night.signals) signals = JSON.parse(night.signals);
  } catch {
    /* ignore */
  }

  let morningHook: string | null = null;
  if (night.mood === "stressed") {
    morningHook = "Yesterday you sounded stressed — let's protect your energy and pick one light win today.";
  } else if (signals.includes("burnout")) {
    morningHook = "Your voice check-in flagged burnout yesterday. Small, sustainable steps only today.";
  } else if (night.summary) {
    morningHook = `Building on yesterday: ${night.summary.slice(0, 110)}${night.summary.length > 110 ? "…" : ""}`;
  }

  let challengeFromVoice: string | null = null;
  if (signals.includes("sleep_debt")) {
    challengeFromVoice = "You mentioned poor sleep yesterday — guard an early wind-down tonight.";
  } else if (signals.includes("burnout") && !signals.includes("sleep_debt")) {
    challengeFromVoice = "Burnout showed up in yesterday's reflection — block recovery time before stacking more tasks.";
  } else if (signals.includes("career_signal") && night.mood === "anxious") {
    challengeFromVoice = "Career stress came through yesterday — 15 minutes of voice practice on Career could sharpen your confidence.";
  } else if (signals.includes("relationship_signal")) {
    challengeFromVoice = "A relationship thread surfaced yesterday — practice what you'll say on Social & Relationships.";
  } else if (signals.includes("spending")) {
    challengeFromVoice = "Spending came up in yesterday's capture — one mindful money check-in today keeps you on track.";
  }

  return {
    mood: night.mood,
    signals,
    summary: night.summary,
    morningHook,
    challengeFromVoice,
  };
}

export async function getMorningReflectionContext(
  userId: string
): Promise<MorningReflectionContext> {
  const today = startOfDay();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [yesterdayCaptures, morningToday] = await Promise.all([
    prisma.voiceCapture.findMany({
      where: { userId, createdAt: { gte: yesterday, lt: today } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.voiceCapture.findFirst({
      where: {
        userId,
        source: "morning_reflection",
        createdAt: { gte: today },
      },
    }),
  ]);

  const night =
    yesterdayCaptures.find((c) => c.source === "night_reflection") ?? yesterdayCaptures[0];

  let yesterdaySignals: string[] = [];
  try {
    if (night?.signals) yesterdaySignals = JSON.parse(night.signals);
  } catch {
    /* ignore */
  }

  let prompt = "How are you feeling today? Hold the mic and talk for a moment.";
  if (night?.mood === "stressed") {
    prompt = "Yesterday you mentioned being stressed. How are you feeling today?";
  } else if (night?.summary) {
    prompt = `Yesterday: "${night.summary.slice(0, 80)}…" — how are you starting today?`;
  } else if (yesterdaySignals.includes("burnout")) {
    prompt = "Yesterday's check-in flagged burnout. How's your energy this morning?";
  }

  return {
    hasYesterdayReflection: Boolean(night),
    morningDoneToday: Boolean(morningToday),
    yesterdaySummary: night?.summary ?? null,
    yesterdayMood: night?.mood ?? null,
    yesterdaySignals,
    prompt,
  };
}
