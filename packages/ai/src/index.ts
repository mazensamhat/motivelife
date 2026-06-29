import type {
  BriefingPayload,
  EveningReviewPayload,
  WeeklyReviewPayload,
  MonthlyReviewPayload,
  QuarterlyReviewPayload,
  PrepChecklistItem,
  LifeBelief,
  LifeContextState,
  LifePreference,
} from "@forward/shared";
import type { AgentType } from "@forward/shared";

import { parseOpenAiUsage, type OpenAiUsage } from "./openai-usage";
import {
  buildPersonaSystemPrompt,
  buildPersonaUserPayload,
  computeLifeEngineStreakUpdate,
  getLifeEngineStreakStatus,
  getGenerationCohort,
  type PersonaLayers,
} from "./persona-prompt";

export {
  buildPersonaSystemPrompt,
  buildPersonaUserPayload,
  computeLifeEngineStreakUpdate,
  getLifeEngineStreakStatus,
  getGenerationCohort,
  type PersonaLayers,
  type GenerationCohort,
} from "./persona-prompt";

export interface GoalContext {
  id: string;
  title: string;
  domain: string;
  progress: number;
  status: string;
}

export interface TaskContext {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  isMission: boolean;
  goalTitle?: string;
}

export interface BriefingContext {
  userName: string | null;
  goals: GoalContext[];
  tasks: TaskContext[];
  overdueTasks: TaskContext[];
  missionTask: TaskContext | null;
  calendarEvents?: CalendarEventBrief[];
  /** Layered persona — beliefs, prefs, graph, context for LLM */
  persona?: PersonaLayers;
}

export interface CalendarEventBrief {
  title: string;
  start: Date;
  hoursUntil: number;
}

/** Rule-based briefing when no LLM key is configured */
export function generateBriefing(context: BriefingContext): BriefingPayload {
  const { goals, tasks, overdueTasks, missionTask, userName, calendarEvents = [] } = context;
  const greeting = userName ? `${userName}, here's your day.` : "Here's your day.";

  const activeGoals = goals.filter((g) => g.status === "ACTIVE");
  const pendingTasks = tasks.filter((t) => t.status === "TODO" || t.status === "IN_PROGRESS");
  const highPriority = pendingTasks.filter((t) => t.priority === "HIGH" || t.priority === "URGENT");

  const priorities: string[] = [];

  if (missionTask) {
    priorities.push(missionTask.title);
  }

  const upcomingToday = calendarEvents.filter((e) => e.hoursUntil >= 0 && e.hoursUntil <= 12);
  for (const event of upcomingToday.slice(0, missionTask ? 1 : 2)) {
    const label =
      event.hoursUntil < 1
        ? `Soon: ${event.title}`
        : `Today: ${event.title}`;
    if (!priorities.includes(label)) priorities.push(label);
  }

  for (const task of highPriority.slice(0, missionTask ? 2 : 3)) {
    if (!priorities.includes(task.title)) {
      priorities.push(task.title);
    }
  }

  for (const task of pendingTasks.slice(0, 3)) {
    if (priorities.length >= 3) break;
    if (!priorities.includes(task.title)) {
      priorities.push(task.title);
    }
  }

  while (priorities.length < 3 && activeGoals.length > priorities.length) {
    const goal = activeGoals[priorities.length];
    if (goal) priorities.push(`Make progress on: ${goal.title}`);
  }

  const mission = missionTask?.title ?? priorities[0] ?? null;

  let suggestedAction: string | null = null;
  if (overdueTasks.length > 0) {
    suggestedAction = `Start with "${overdueTasks[0].title}" — it's overdue.`;
  } else if (pendingTasks.length > 0) {
    const next = pendingTasks.find((t) => t.priority === "URGENT") ?? pendingTasks[0];
    suggestedAction = `Your next step: ${next.title}.`;
  } else if (activeGoals.length > 0) {
    suggestedAction = `Add a task for "${activeGoals[0].title}" to keep momentum.`;
  }

  const parts: string[] = [greeting];
  if (activeGoals.length > 0) {
    parts.push(`You're working toward ${activeGoals.length} active goal${activeGoals.length === 1 ? "" : "s"}.`);
  }
  if (overdueTasks.length > 0) {
    parts.push(`${overdueTasks.length} task${overdueTasks.length === 1 ? "" : "s"} need attention.`);
  }
  if (upcomingToday.length > 0) {
    parts.push(`${upcomingToday.length} calendar event${upcomingToday.length === 1 ? "" : "s"} today.`);
  } else if (pendingTasks.length === 0 && activeGoals.length === 0) {
    parts.push("Set your first goal to get started.");
  }

  return {
    priorities: priorities.slice(0, 3),
    mission,
    suggestedAction,
    summary: parts.join(" "),
  };
}

export interface SuggestionContext {
  goals: GoalContext[];
  tasks: TaskContext[];
  staleGoals: GoalContext[];
  applications?: ApplicationContext[];
  moneyItems?: MoneyItemContext[];
  calendarEvents?: CalendarEventBrief[];
  habits?: HabitContext[];
  healthItems?: HealthItemContext[];
  learningItems?: LearningItemContext[];
  emails?: EmailContext[];
  memories?: { id: string; title: string; content: string }[];
}

export interface EmailContext {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  isUnread: boolean;
}

export interface MoneyItemContext {
  id: string;
  type: string;
  title: string;
  targetAmount: number | null;
  currentAmount: number;
  dueDay: number | null;
  targetDate: Date | null;
  daysUntilDue: number | null;
  monthlyNeeded: number | null;
  percentComplete: number | null;
}

export interface ApplicationContext {
  id: string;
  company: string;
  role: string;
  status: string;
  appliedAt: Date | null;
  interviewAt: Date | null;
  daysSinceUpdate: number;
  nextStep: string | null;
}

export interface HabitContext {
  id: string;
  title: string;
  frequency: string;
  streak: number;
  doneToday: boolean;
  daysSinceLastDone: number | null;
}

export interface HealthItemContext {
  id: string;
  type: string;
  title: string;
  targetValue: number | null;
  currentValue: number;
  unit: string | null;
  percentComplete: number | null;
}

export interface LearningItemContext {
  id: string;
  type: string;
  title: string;
  progress: number;
  targetDate: Date | null;
  daysUntilTarget: number | null;
  daysSinceUpdate: number;
}

export interface Suggestion {
  agent: AgentType;
  title: string;
  reason: string;
  actionLabel?: string;
  actionHref?: string;
  entityId?: string;
}

function pushSuggestion(
  suggestions: Suggestion[],
  item: Suggestion,
  max: number
) {
  if (suggestions.length >= max) return;
  suggestions.push(item);
}

/** Collect suggestions, optionally filtered to one agent */
export function collectSuggestions(
  context: SuggestionContext,
  options?: { agent?: AgentType; limit?: number }
): Suggestion[] {
  const max = options?.limit ?? 3;
  const suggestions: Suggestion[] = [];
  const {
    goals,
    tasks,
    staleGoals,
    applications = [],
    moneyItems = [],
    calendarEvents = [],
    habits = [],
    healthItems = [],
    learningItems = [],
    emails = [],
    memories = [],
  } = context;
  const now = Date.now();
  const agent = options?.agent;

  const allow = (a: AgentType) => !agent || agent === a;

  if (allow("CALENDAR")) {
    for (const event of calendarEvents.filter((e) => e.hoursUntil >= 0 && e.hoursUntil <= 2)) {
      pushSuggestion(suggestions, {
        agent: "CALENDAR",
        title: `Prepare for: ${event.title}`,
        reason: event.hoursUntil < 1 ? "Starting soon." : `Starts in ${Math.round(event.hoursUntil * 60)} minutes.`,
        actionLabel: "Prepare",
        actionHref: "/dashboard",
      }, max);
      break;
    }
  }

  if (allow("GENERAL")) {
    for (const email of emails.filter((e) => e.isUnread).slice(0, 1)) {
      pushSuggestion(suggestions, {
        agent: "GENERAL",
        title: `Reply to: ${email.subject}`,
        reason: `From ${email.from} — needs your attention.`,
        actionLabel: "Reply",
        actionHref: "/integrations",
      }, max);
    }
  }

  if (allow("MONEY")) {
    for (const item of moneyItems.filter((m) => m.type === "BILL" && m.dueDay != null)) {
      if (item.daysUntilDue != null && item.daysUntilDue >= 0 && item.daysUntilDue <= 3) {
        pushSuggestion(suggestions, {
          agent: "MONEY",
          title: `Pay ${item.title}`,
          reason: item.daysUntilDue === 0 ? "Due today." : `Due in ${item.daysUntilDue} day${item.daysUntilDue === 1 ? "" : "s"}.`,
          actionLabel: "Pay now",
          actionHref: `/money#item-${item.id}`,
          entityId: item.id,
        }, max);
        break;
      }
    }

    for (const item of moneyItems.filter((m) => m.type === "SAVINGS").slice(0, 1)) {
      if (item.monthlyNeeded != null && item.monthlyNeeded > 0 && item.percentComplete != null) {
        if (item.percentComplete < 50 && item.targetDate) {
          const remaining = (item.targetAmount ?? 0) - item.currentAmount;
          pushSuggestion(suggestions, {
            agent: "MONEY",
            title: `Save toward "${item.title}" — $${Math.ceil(item.monthlyNeeded)}/mo needed`,
            reason: `$${Math.ceil(remaining)} left to reach your target.`,
            actionLabel: "Save",
            actionHref: `/money#item-${item.id}`,
            entityId: item.id,
          }, max);
        }
      }
    }

    for (const item of moneyItems.filter((m) => m.type === "DEBT" && m.currentAmount > 0).slice(0, 1)) {
      if (suggestions.some((s) => s.agent === "MONEY" && agent === "MONEY")) break;
      pushSuggestion(suggestions, {
        agent: "MONEY",
        title: `Make a payment toward ${item.title}`,
        reason: `$${item.currentAmount.toLocaleString()} remaining.`,
        actionLabel: "Pay",
        actionHref: `/money#item-${item.id}`,
        entityId: item.id,
      }, max);
    }
  }

  if (allow("CAREER")) {
    for (const app of applications) {
      if (app.status === "INTERVIEW" && app.interviewAt) {
        const hours = (app.interviewAt.getTime() - now) / (1000 * 60 * 60);
        if (hours > 0 && hours <= 48) {
          pushSuggestion(suggestions, {
            agent: "CAREER",
            title: `Prepare for ${app.company} interview (${app.role})`,
            reason: hours <= 24 ? "Interview is tomorrow or today." : "Interview coming up in the next 2 days.",
            actionLabel: "Prep",
            actionHref: `/career#app-${app.id}`,
            entityId: app.id,
          }, max);
          break;
        }
      }
    }

    for (const app of applications.filter((a) => a.status === "SAVED").slice(0, 1)) {
      pushSuggestion(suggestions, {
        agent: "CAREER",
        title: `Apply to ${app.company} — ${app.role}`,
        reason: "You saved this role but haven't applied yet.",
        actionLabel: "Apply",
        actionHref: `/career#app-${app.id}`,
        entityId: app.id,
      }, max);
    }

    for (const app of applications.filter((a) => a.status === "APPLIED" && a.daysSinceUpdate >= 7).slice(0, 1)) {
      pushSuggestion(suggestions, {
        agent: "CAREER",
        title: `Follow up on ${app.company} application`,
        reason: "No update in over a week — a brief follow-up can help.",
        actionLabel: "Follow up",
        actionHref: `/career#app-${app.id}`,
        entityId: app.id,
      }, max);
    }

    for (const app of applications.filter((a) => a.nextStep).slice(0, 1)) {
      if (suggestions.some((s) => s.title.includes(app.company))) continue;
      pushSuggestion(suggestions, {
        agent: "CAREER",
        title: app.nextStep!,
        reason: `Next step for ${app.company} (${app.role}).`,
        actionLabel: "Do it",
        actionHref: `/career#app-${app.id}`,
        entityId: app.id,
      }, max);
    }
  }

  if (allow("GENERAL")) {
    for (const habit of habits.filter((h) => !h.doneToday && /mom|dad|call|family|friend|sarah|brother|sister/i.test(h.title)).slice(0, 1)) {
      pushSuggestion(suggestions, {
        agent: "GENERAL",
        title: habit.title.startsWith("Call") ? habit.title : `Check in: ${habit.title}`,
        reason:
          habit.daysSinceLastDone != null && habit.daysSinceLastDone >= 7
            ? `It's been ${habit.daysSinceLastDone} days — they'll appreciate hearing from you.`
            : "Relationships thrive on small, consistent touchpoints.",
        actionLabel: "Reach out",
        actionHref: "/memory",
        entityId: habit.id,
      }, max);
    }

    for (const mem of memories.filter((m) => /call|mom|dad|family|friend|birthday|check.?in/i.test(m.content + m.title)).slice(0, 1)) {
      if (suggestions.some((s) => s.actionHref === "/memory")) break;
      pushSuggestion(suggestions, {
        agent: "GENERAL",
        title: mem.title,
        reason: mem.content.slice(0, 120),
        actionLabel: "Remember",
        actionHref: "/memory",
        entityId: mem.id,
      }, max);
    }
  }

  if (allow("GENERAL")) {
    for (const habit of habits.filter((h) => !h.doneToday && !/mom|dad|call|family/i.test(h.title)).slice(0, 1)) {
      pushSuggestion(suggestions, {
        agent: "GENERAL",
        title: `Check in: ${habit.title}`,
        reason:
          habit.daysSinceLastDone != null && habit.daysSinceLastDone >= 2
            ? "Missed a couple days — a small win today rebuilds momentum."
            : habit.streak > 0
              ? `${habit.streak}-day streak — keep it going.`
              : "Start a streak with one check-in.",
        actionLabel: "Check in",
        actionHref: "/habits",
        entityId: habit.id,
      }, max);
    }
  }

  if (allow("HEALTH")) {
    for (const item of healthItems.filter((h) => h.percentComplete != null && h.percentComplete < 80).slice(0, 1)) {
      pushSuggestion(suggestions, {
        agent: "HEALTH",
        title: `Work toward "${item.title}"`,
        reason:
          item.percentComplete != null && item.percentComplete > 0
            ? `${item.percentComplete}% of your ${item.type.toLowerCase()} target.`
            : `Set progress on your ${item.type.toLowerCase()} goal.`,
        actionLabel: "Log progress",
        actionHref: `/health#item-${item.id}`,
        entityId: item.id,
      }, max);
    }
  }

  if (allow("LEARNING")) {
    for (const item of learningItems.filter(
      (l) =>
        (l.daysUntilTarget != null && l.daysUntilTarget >= 0 && l.daysUntilTarget <= 14 && l.progress < 80) ||
        (l.progress === 0 && l.daysSinceUpdate >= 7)
    ).slice(0, 1)) {
      pushSuggestion(suggestions, {
        agent: "LEARNING",
        title: `Make progress on "${item.title}"`,
        reason:
          item.daysUntilTarget != null && item.daysUntilTarget >= 0 && item.daysUntilTarget <= 14
            ? `Target date in ${item.daysUntilTarget} day${item.daysUntilTarget === 1 ? "" : "s"}.`
            : "No progress in over a week — one session helps.",
        actionLabel: "Study",
        actionHref: `/learning#item-${item.id}`,
        entityId: item.id,
      }, max);
    }
  }

  for (const goal of staleGoals.slice(0, 2)) {
    const goalAgent = domainToAgent(goal.domain);
    if (!allow(goalAgent)) continue;
    pushSuggestion(suggestions, {
      agent: goalAgent,
      title: `Review progress on "${goal.title}"`,
      reason: `You haven't updated this ${goal.domain.toLowerCase()} goal in a while.`,
      actionLabel: "Review",
      actionHref: "/goals",
      entityId: goal.id,
    }, max);
  }

  if (allow("TASK")) {
    for (const task of tasks.filter((t) => t.priority === "URGENT").slice(0, 1)) {
      pushSuggestion(suggestions, {
        agent: "TASK",
        title: task.title,
        reason: "Marked urgent — worth doing today.",
        actionLabel: "Do it",
        actionHref: `/tasks?focus=${task.id}`,
        entityId: task.id,
      }, max);
    }
  }

  if (allow("CAREER")) {
    const careerGoals = goals.filter((g) => g.domain === "CAREER" && g.status === "ACTIVE");
    if (careerGoals.length > 0 && !tasks.some((t) => t.goalTitle === careerGoals[0].title)) {
      pushSuggestion(suggestions, {
        agent: "CAREER",
        title: "Update LinkedIn profile",
        reason: "Recruiters often find you before you find them — a fresh profile opens doors.",
        actionLabel: "Update",
        actionHref: "/career",
      }, max);
    }
  }

  return suggestions.slice(0, max);
}

/** Proactive suggestions — Level 1 (Suggest) per Intervention Framework */
export function generateSuggestions(context: SuggestionContext): Suggestion[] {
  return collectSuggestions(context, { limit: 3 });
}

export function getBestSuggestionForAgent(
  context: SuggestionContext,
  agent: AgentType
): Suggestion | null {
  const items = collectSuggestions(context, { agent, limit: 5 });
  return items[0] ?? null;
}

const DOMAIN_DEFAULTS: Record<string, Omit<Suggestion, "agent">> = {
  CAREER: {
    title: "Update LinkedIn profile",
    reason: "One profile refresh can unlock interview opportunities this week.",
    actionLabel: "Update",
    actionHref: "/career",
  },
  MONEY: {
    title: "Review spending this week",
    reason: "A 5-minute review keeps your savings goals on track.",
    actionLabel: "Review",
    actionHref: "/money",
  },
  HEALTH: {
    title: "Walk 18 minutes",
    reason: "Short movement counts — it keeps your health score climbing.",
    actionLabel: "Start",
    actionHref: "/health",
  },
  LEARNING: {
    title: "Read for 15 minutes",
    reason: "Small daily learning compounds into real skill growth.",
    actionLabel: "Read",
    actionHref: "/learning",
  },
  GENERAL: {
    title: "Message someone you care about",
    reason: "Relationships move forward one conversation at a time.",
    actionLabel: "Reach out",
    actionHref: "/memory",
  },
};

export function getDomainNextActionFromContext(
  context: SuggestionContext,
  agent: AgentType,
  domainLabel: string
) {
  const best = getBestSuggestionForAgent(context, agent);
  const fallback = DOMAIN_DEFAULTS[agent] ?? DOMAIN_DEFAULTS.GENERAL;
  const pick = best ?? { agent, ...fallback };

  return {
    domain: agent,
    domainLabel,
    title: pick.title,
    reason: pick.reason,
    actionLabel: pick.actionLabel ?? "Start",
    actionHref: pick.actionHref ?? "/dashboard",
    entityId: pick.entityId,
  };
}

function domainToAgent(domain: string): AgentType {
  const map: Record<string, AgentType> = {
    CAREER: "CAREER",
    MONEY: "MONEY",
    HEALTH: "HEALTH",
    HABITS: "GENERAL",
    LEARNING: "LEARNING",
    TRAVEL: "TRAVEL",
  };
  return map[domain] ?? "GENERAL";
}

function startOfDayLocal(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function habitDoneToday(lastDoneAt: Date | null, now = new Date()): boolean {
  if (!lastDoneAt) return false;
  return startOfDayLocal(lastDoneAt).getTime() === startOfDayLocal(now).getTime();
}

export function habitDaysSinceLastDone(lastDoneAt: Date | null, now = new Date()): number | null {
  if (!lastDoneAt) return null;
  const diff = startOfDayLocal(now).getTime() - startOfDayLocal(lastDoneAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function computeHabitCheckIn(
  lastDoneAt: Date | null,
  frequency: "DAILY" | "WEEKLY",
  currentStreak: number,
  bestStreak: number,
  now = new Date()
): { streak: number; bestStreak: number; lastDoneAt: Date; alreadyDone: boolean } {
  if (habitDoneToday(lastDoneAt, now)) {
    return { streak: currentStreak, bestStreak, lastDoneAt: lastDoneAt!, alreadyDone: true };
  }

  let streak = 1;
  if (lastDoneAt) {
    const daysSince = habitDaysSinceLastDone(lastDoneAt, now) ?? 0;
    if (frequency === "DAILY" && daysSince === 1) streak = currentStreak + 1;
    else if (frequency === "WEEKLY" && daysSince <= 7) streak = currentStreak + 1;
  }

  return {
    streak,
    bestStreak: Math.max(bestStreak, streak),
    lastDoneAt: now,
    alreadyDone: false,
  };
}

export function buildHealthItemContext(item: {
  id: string;
  type: string;
  title: string;
  targetValue: number | null;
  currentValue: number;
  unit: string | null;
}): HealthItemContext {
  const percentComplete =
    item.targetValue && item.targetValue > 0
      ? Math.min(100, Math.round((item.currentValue / item.targetValue) * 100))
      : null;
  return { ...item, percentComplete };
}

export function buildLearningItemContext(item: {
  id: string;
  type: string;
  title: string;
  progress: number;
  targetDate: Date | null;
  updatedAt: Date;
}): LearningItemContext {
  let daysUntilTarget: number | null = null;
  if (item.targetDate) {
    daysUntilTarget = Math.ceil(
      (item.targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  }
  const daysSinceUpdate = Math.floor(
    (Date.now() - item.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    progress: item.progress,
    targetDate: item.targetDate,
    daysUntilTarget,
    daysSinceUpdate,
  };
}

/** Compute money item context for Money Agent suggestions */
export function buildMoneyItemContext(item: {
  id: string;
  type: string;
  title: string;
  targetAmount: number | null;
  currentAmount: number;
  dueDay: number | null;
  targetDate: Date | null;
}): MoneyItemContext {
  const today = new Date();
  let daysUntilDue: number | null = null;

  if (item.dueDay != null) {
    const due = new Date(today.getFullYear(), today.getMonth(), item.dueDay);
    if (due < today) due.setMonth(due.getMonth() + 1);
    daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  let monthlyNeeded: number | null = null;
  let percentComplete: number | null = null;

  if (item.type === "SAVINGS" && item.targetAmount && item.targetAmount > 0) {
    percentComplete = Math.round((item.currentAmount / item.targetAmount) * 100);
    if (item.targetDate) {
      const months = Math.max(
        1,
        (item.targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      const remaining = Math.max(0, item.targetAmount - item.currentAmount);
      monthlyNeeded = remaining / months;
    }
  }

  return {
    id: item.id,
    type: item.type,
    title: item.title,
    targetAmount: item.targetAmount,
    currentAmount: item.currentAmount,
    dueDay: item.dueDay,
    targetDate: item.targetDate,
    daysUntilDue,
    monthlyNeeded,
    percentComplete,
  };
}

/** Optional LLM-enhanced briefing when OPENAI_API_KEY is set */
export async function generateBriefingWithAI(
  context: BriefingContext,
  apiKey: string
): Promise<{ briefing: BriefingPayload; usage: OpenAiUsage | null }> {
  const fallback = generateBriefing(context);

  try {
    const systemPrompt = context.persona
      ? buildPersonaSystemPrompt(context.persona)
      : `You are Forward, a Life Intelligence Chief of Staff. Be clear, warm, direct, brief. No hype, no emojis.`;

    const outputSchema = `{
  "priorities": string[3],
  "mission": string,
  "suggestedAction": string,
  "summary": string,
  "hero": { "dynamicOpening": string, "chiefOfStaffLine": string, "challengeLine": string|null, "goodNews": string },
  "coach": { "prompt": string, "suggestion": string }
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `${systemPrompt}\n\nOutput JSON only matching this schema:\n${outputSchema}`,
          },
          {
            role: "user",
            content: buildPersonaUserPayload(
              {
                goals: context.goals,
                tasks: context.tasks.slice(0, 12),
                overdueTasks: context.overdueTasks,
                missionTask: context.missionTask,
                calendarEvents: context.calendarEvents,
              },
              outputSchema
            ),
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.45,
      }),
    });

    if (!response.ok) return { briefing: fallback, usage: null };

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { briefing: fallback, usage: null };

    const parsed = JSON.parse(content) as BriefingPayload;
    const usage = parseOpenAiUsage(data);
    return {
      briefing: {
        priorities: parsed.priorities?.length ? parsed.priorities : fallback.priorities,
        mission: parsed.mission ?? fallback.mission,
        suggestedAction: parsed.suggestedAction ?? fallback.suggestedAction,
        summary: parsed.summary ?? fallback.summary,
        hero: parsed.hero,
        coach: parsed.coach,
      },
      usage,
    };
  } catch {
    return { briefing: fallback, usage: null };
  }
}

export interface EveningReviewContext {
  userName: string | null;
  completedToday: TaskContext[];
  pendingTasks: TaskContext[];
  missionCompleted: boolean;
  activeGoals: GoalContext[];
  lifeEngineStreak?: number;
  lifeXpToday?: number;
  persona?: PersonaLayers;
}

/** Rule-based evening review */
export function generateEveningReview(context: EveningReviewContext): EveningReviewPayload {
  const { completedToday, pendingTasks, missionCompleted, activeGoals, userName } = context;
  const count = completedToday.length;

  const completedTasks = completedToday.map((t) => t.title);

  let highlight: string | null = null;
  if (count > 0) {
    const mission = completedToday.find((t) => t.isMission);
    highlight = mission
      ? `You completed today's mission: ${mission.title}.`
      : `You finished ${count} task${count === 1 ? "" : "s"} today. That counts.`;
  } else {
    highlight = "Showing up matters. Tomorrow is a fresh start.";
  }

  let carryForward: string | null = null;
  if (pendingTasks.length > 0) {
    const next =
      pendingTasks.find((t) => t.isMission) ??
      pendingTasks.find((t) => t.priority === "URGENT") ??
      pendingTasks[0];
    carryForward = next.title;
  } else if (activeGoals.length > 0) {
    carryForward = `Make progress on: ${activeGoals[0].title}`;
  }

  const parts: string[] = [];
  if (userName) parts.push(`${userName}, here's your day in review.`);
  else parts.push("Here's your day in review.");

  if (missionCompleted) {
    parts.push("Today's mission: done.");
  } else if (count > 0) {
    parts.push(`${count} task${count === 1 ? "" : "s"} completed.`);
  } else {
    parts.push("No tasks completed today.");
  }

  if (carryForward) {
    parts.push(`Tomorrow starts with: ${carryForward}.`);
  }

  return {
    completedCount: count,
    completedTasks,
    highlight,
    carryForward,
    summary: parts.join(" "),
  };
}

/** Optional LLM evening wrap-up — one cached call per user per evening */
export async function generateEveningReviewWithAI(
  context: EveningReviewContext,
  apiKey: string
): Promise<{ review: EveningReviewPayload; usage: OpenAiUsage | null }> {
  const fallback = generateEveningReview(context);

  try {
    const systemPrompt = context.persona
      ? `${buildPersonaSystemPrompt(context.persona)}\n\nWrite their evening review — reflective, concise, no guilt-tripping.`
      : `You are MotiveLife closing out the day. Warm, honest, brief.`;

    const outputSchema = `{
  "summary": string (2-3 sentences, conversational),
  "highlight": string (best moment today or encouragement if quiet day),
  "carryForward": string (one concrete priority for tomorrow)
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `${systemPrompt}\n\nOutput JSON only matching this schema:\n${outputSchema}`,
          },
          {
            role: "user",
            content: buildPersonaUserPayload(
              {
                completedToday: context.completedToday.map((t) => t.title),
                pendingTomorrow: context.pendingTasks.slice(0, 5).map((t) => t.title),
                missionCompleted: context.missionCompleted,
                activeGoals: context.activeGoals.slice(0, 3).map((g) => g.title),
                lifeEngineStreak: context.lifeEngineStreak,
                lifeXpToday: context.lifeXpToday,
              },
              outputSchema
            ),
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
      }),
    });

    if (!response.ok) return { review: fallback, usage: null };

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { review: fallback, usage: null };

    const parsed = JSON.parse(content) as {
      summary?: string;
      highlight?: string;
      carryForward?: string;
    };
    const usage = parseOpenAiUsage(data);

    return {
      review: {
        completedCount: fallback.completedCount,
        completedTasks: fallback.completedTasks,
        highlight: parsed.highlight ?? fallback.highlight,
        carryForward: parsed.carryForward ?? fallback.carryForward,
        summary: parsed.summary ?? fallback.summary,
      },
      usage,
    };
  } catch {
    return { review: fallback, usage: null };
  }
}

// ─── Weekly Review ──────────────────────────────────────────────────────────

export interface WeeklyReviewContext {
  userName: string | null;
  tasksCompleted: number;
  activeGoals: GoalContext[];
  momentsThisWeek: { title: string }[];
  pendingTasks: TaskContext[];
  goalsCompletedThisWeek?: number;
  avgGoalProgress?: number;
  preferences?: LifePreference;
  beliefs?: LifeBelief[];
  lifeEngineStreak?: number;
  lifeXpGainedThisWeek?: number;
  coachingDaysCompleted?: number;
  topXpDimensionLabel?: string | null;
  persona?: PersonaLayers;
  voiceRecap?: {
    captureCount: number;
    practiceCount: number;
    avgPracticeScore: number | null;
    voiceHighlights: string[];
    practiceHighlights: string[];
    topMoods: string[];
  } | null;
}

export function generateWeeklyReview(context: WeeklyReviewContext): WeeklyReviewPayload {
  const {
    userName,
    tasksCompleted,
    activeGoals,
    momentsThisWeek,
    pendingTasks,
    goalsCompletedThisWeek = 0,
    avgGoalProgress = 0,
    preferences,
    beliefs = [],
    lifeEngineStreak = 0,
    lifeXpGainedThisWeek = 0,
    coachingDaysCompleted = 0,
    topXpDimensionLabel = null,
    voiceRecap = null,
  } = context;

  const firstName = userName?.split(" ")[0] ?? null;
  const prefs = preferences;
  const beliefHint =
    beliefs.length > 0 ? ` Keeping ${beliefs[0].label.toLowerCase()} in mind.` : "";

  const wins: string[] = [];
  if (tasksCompleted > 0) {
    wins.push(`Completed ${tasksCompleted} task${tasksCompleted === 1 ? "" : "s"} this week.`);
  }
  if (goalsCompletedThisWeek > 0) {
    wins.push(
      `Finished ${goalsCompletedThisWeek} goal${goalsCompletedThisWeek === 1 ? "" : "s"}.`
    );
  }
  for (const m of momentsThisWeek.slice(0, 2)) {
    wins.push(m.title);
  }
  if (wins.length === 0) {
    wins.push("You showed up this week — that's the foundation.");
  }

  const focusAreas: string[] = [];
  const urgent = pendingTasks.filter((t) => t.priority === "URGENT" || t.priority === "HIGH");
  for (const t of urgent.slice(0, 2)) {
    focusAreas.push(t.title);
  }
  for (const g of activeGoals.filter((g) => g.progress < 25).slice(0, 2)) {
    if (focusAreas.length >= 3) break;
    if (!focusAreas.some((f) => f.includes(g.title))) {
      focusAreas.push(`Move forward on: ${g.title}`);
    }
  }
  while (focusAreas.length < 2 && pendingTasks.length > focusAreas.length) {
    focusAreas.push(pendingTasks[focusAreas.length].title);
  }

  const goalsSummary =
    activeGoals.length > 0
      ? `${activeGoals.length} active goal${activeGoals.length === 1 ? "" : "s"} in your Life GPS.`
      : "Set one goal for the week ahead.";

  const letterParagraphs: string[] = [];

  if (firstName) {
    if (prefs?.humor) {
      letterParagraphs.push(`Hey ${firstName} — your week in review.`);
    } else if (prefs?.reminderStyle === "direct") {
      letterParagraphs.push(`${firstName}.`);
    } else {
      letterParagraphs.push(`${firstName}…`);
    }
  }

  if (lifeEngineStreak >= 3) {
    letterParagraphs.push(
      prefs?.reminderStyle === "statistics"
        ? `Life Engine streak: ${lifeEngineStreak} days — consistency is compounding.`
        : `You're on a ${lifeEngineStreak}-day Life Engine streak. Don't break it now.`
    );
  }

  if (lifeXpGainedThisWeek > 0) {
    const dimPart = topXpDimensionLabel ? ` — strongest in ${topXpDimensionLabel.toLowerCase()}` : "";
    letterParagraphs.push(
      prefs?.reminderStyle === "statistics"
        ? `Life XP: +${lifeXpGainedThisWeek} this week${dimPart}.`
        : `You earned ${lifeXpGainedThisWeek} Life XP this week${dimPart}. Real capability is stacking.`
    );
  }

  if (coachingDaysCompleted > 0) {
    letterParagraphs.push(
      coachingDaysCompleted >= 5
        ? `${coachingDaysCompleted} coaching challenge days completed — you're in improvement mode.`
        : `${coachingDaysCompleted} day${coachingDaysCompleted === 1 ? "" : "s"} on your adaptive coaching loops.`
    );
  }

  if (voiceRecap && voiceRecap.captureCount > 0) {
    const practicePart =
      voiceRecap.practiceCount > 0 && voiceRecap.avgPracticeScore
        ? ` ${voiceRecap.practiceCount} voice practice rep${voiceRecap.practiceCount === 1 ? "" : "s"} (avg ${Math.round(voiceRecap.avgPracticeScore)}/100).`
        : "";
    const moodPart =
      voiceRecap.topMoods.length > 0 ? ` Mood trend: ${voiceRecap.topMoods.slice(0, 2).join(", ")}.` : "";
    letterParagraphs.push(
      `You spoke to MotiveLife ${voiceRecap.captureCount} time${voiceRecap.captureCount === 1 ? "" : "s"} this week.${practicePart}${moodPart}`
    );
    if (voiceRecap.voiceHighlights[0]) {
      letterParagraphs.push(`Voice highlight: ${voiceRecap.voiceHighlights[0]}`);
    }
    if (voiceRecap.practiceHighlights[0]) {
      letterParagraphs.push(voiceRecap.practiceHighlights[0]);
    }
  }

  if (prefs?.reminderStyle === "direct") {
    letterParagraphs.push(
      tasksCompleted > 0
        ? `${tasksCompleted} tasks done. Real progress.`
        : "Quiet week. Next week: one daily win minimum."
    );
  } else {
    letterParagraphs.push("You made real progress this week.");
  }

  if (avgGoalProgress > 0) {
    letterParagraphs.push(
      `You completed about ${Math.round(avgGoalProgress)}% of your active goals on average.`
    );
  } else if (tasksCompleted > 0) {
    letterParagraphs.push(
      `You completed ${tasksCompleted} task${tasksCompleted === 1 ? "" : "s"} — momentum is building.`
    );
  }

  if (momentsThisWeek.length > 0) {
    letterParagraphs.push(
      `${momentsThisWeek.length} moment${momentsThisWeek.length === 1 ? "" : "s"} moved your life forward.`
    );
  }

  if (wins.length > 1) {
    letterParagraphs.push(wins.slice(0, 3).join(" "));
  }

  const gap = focusAreas[0];
  if (gap) {
    letterParagraphs.push("However…");
    if (prefs?.reminderStyle === "direct") {
      letterParagraphs.push(`Next week: ${gap}.${beliefHint}`);
    } else if (prefs?.reminderStyle === "statistics") {
      letterParagraphs.push(`Priority for next week (highest leverage): ${gap}.${beliefHint}`);
    } else {
      letterParagraphs.push(`Next week let's focus on: ${gap}.${beliefHint}`);
    }
  } else if (activeGoals.length === 0) {
    letterParagraphs.push("However…");
    letterParagraphs.push("You don't have an active goal right now. Next week, pick one destination.");
  } else if (beliefHint) {
    letterParagraphs.push(beliefHint.trim());
  }

  letterParagraphs.push("— MotiveLife");

  const summary = letterParagraphs.join("\n\n");

  return {
    tasksCompleted,
    wins: wins.slice(0, 3),
    focusAreas: focusAreas.slice(0, 3),
    goalsSummary,
    summary,
    letterParagraphs,
  };
}

/** Optional LLM-enhanced Sunday letter — one cached call per week when OPENAI_API_KEY is set */
function injectVoiceRecapIntoLetter(
  paragraphs: string[],
  fallbackParagraphs: string[],
  voiceRecap: WeeklyReviewContext["voiceRecap"]
): string[] {
  if (!voiceRecap || voiceRecap.captureCount === 0) return paragraphs;
  const voiceParas = fallbackParagraphs.filter(
    (p) => p.includes("spoke to MotiveLife") || p.startsWith("Voice highlight:")
  );
  if (voiceParas.length === 0) return paragraphs;
  const howeverIdx = paragraphs.findIndex((p) => p === "However…");
  if (howeverIdx === -1) return [...paragraphs, ...voiceParas];
  return [...paragraphs.slice(0, howeverIdx), ...voiceParas, ...paragraphs.slice(howeverIdx)];
}

export async function generateWeeklyReviewWithAI(
  context: WeeklyReviewContext,
  apiKey: string
): Promise<{ review: WeeklyReviewPayload; usage: OpenAiUsage | null }> {
  const fallback = generateWeeklyReview(context);

  try {
    const systemPrompt = context.persona
      ? `${buildPersonaSystemPrompt(context.persona)}\n\nYou are writing their Sunday Weekly Letter — personal, warm, like a chief of staff who knows their whole life.`
      : `You are MotiveLife writing a Sunday weekly letter. Personal, warm, direct. No hype.`;

    const outputSchema = `{
  "letterParagraphs": string[] (6-9 short paragraphs; include exactly "However…" on its own line before the next-week focus; last paragraph must be "— MotiveLife"),
  "focusAreas": string[1-3] (concrete next-week priorities),
  "wins": string[1-3] (specific wins from the data)
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `${systemPrompt}\n\nOutput JSON only matching this schema:\n${outputSchema}`,
          },
          {
            role: "user",
            content: buildPersonaUserPayload(
              {
                tasksCompleted: context.tasksCompleted,
                goalsCompletedThisWeek: context.goalsCompletedThisWeek,
                avgGoalProgress: context.avgGoalProgress,
                activeGoals: context.activeGoals.slice(0, 6),
                momentsThisWeek: context.momentsThisWeek,
                pendingTasks: context.pendingTasks.slice(0, 8).map((t) => t.title),
                lifeEngineStreak: context.lifeEngineStreak,
                lifeXpGainedThisWeek: context.lifeXpGainedThisWeek,
                coachingDaysCompleted: context.coachingDaysCompleted,
                topXpDimensionLabel: context.topXpDimensionLabel,
              },
              outputSchema
            ),
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.55,
      }),
    });

    if (!response.ok) return { review: fallback, usage: null };

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { review: fallback, usage: null };

    const parsed = JSON.parse(content) as {
      letterParagraphs?: string[];
      focusAreas?: string[];
      wins?: string[];
    };
    const usage = parseOpenAiUsage(data);

    const letterParagraphsRaw =
      parsed.letterParagraphs?.length && parsed.letterParagraphs.length >= 4
        ? parsed.letterParagraphs
        : fallback.letterParagraphs;

    const letterParagraphs = injectVoiceRecapIntoLetter(
      letterParagraphsRaw,
      fallback.letterParagraphs,
      context.voiceRecap
    );

    return {
      review: {
        tasksCompleted: fallback.tasksCompleted,
        wins: parsed.wins?.length ? parsed.wins.slice(0, 3) : fallback.wins,
        focusAreas: parsed.focusAreas?.length ? parsed.focusAreas.slice(0, 3) : fallback.focusAreas,
        goalsSummary: fallback.goalsSummary,
        summary: letterParagraphs.join("\n\n"),
        letterParagraphs,
      },
      usage,
    };
  } catch {
    return { review: fallback, usage: null };
  }
}

// ─── Monthly Review ─────────────────────────────────────────────────────────

export interface MonthlyReviewContext {
  userName: string | null;
  tasksCompleted: number;
  goalsCompleted: number;
  activeGoals: GoalContext[];
  completedGoals: GoalContext[];
  staleGoals: GoalContext[];
  momentsThisMonth: { title: string; domain: string | null }[];
}

export function generateMonthlyReview(context: MonthlyReviewContext): MonthlyReviewPayload {
  const {
    userName,
    tasksCompleted,
    goalsCompleted,
    activeGoals,
    completedGoals,
    staleGoals,
    momentsThisMonth,
  } = context;

  const wins: string[] = [];
  if (tasksCompleted > 0) {
    wins.push(`Completed ${tasksCompleted} task${tasksCompleted === 1 ? "" : "s"} this month.`);
  }
  if (goalsCompleted > 0) {
    wins.push(`Finished ${goalsCompleted} goal${goalsCompleted === 1 ? "" : "s"}.`);
  }
  for (const m of momentsThisMonth.slice(0, 2)) {
    wins.push(m.title);
  }
  if (wins.length === 0) {
    wins.push("A new month is a clean slate — one small step counts.");
  }

  const adjustments: string[] = [];
  for (const g of staleGoals.slice(0, 2)) {
    adjustments.push(`Revisit "${g.title}" — no activity lately.`);
  }
  for (const g of activeGoals.filter((g) => g.progress < 20).slice(0, 2)) {
    if (adjustments.length >= 3) break;
    adjustments.push(`Break "${g.title}" into smaller tasks to build momentum.`);
  }
  for (const g of activeGoals.filter((g) => g.progress >= 80).slice(0, 1)) {
    if (adjustments.length >= 3) break;
    adjustments.push(`You're close on "${g.title}" — push to complete this month.`);
  }
  if (adjustments.length === 0 && activeGoals.length > 0) {
    adjustments.push(`Keep steady progress on ${activeGoals[0].title}.`);
  }
  if (adjustments.length < 2 && activeGoals.length > adjustments.length) {
    adjustments.push("Pick one goal to prioritize above the rest.");
  }

  const domainCounts: Record<string, number> = {};
  for (const g of [...activeGoals, ...completedGoals]) {
    domainCounts[g.domain] = (domainCounts[g.domain] ?? 0) + 1;
  }
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d, c]) => `${d.toLowerCase()} (${c})`);
  const domainSummary =
    topDomains.length > 0
      ? `Focus areas this month: ${topDomains.join(", ")}.`
      : "Set one goal to anchor the month ahead.";

  const parts: string[] = [];
  if (userName) parts.push(`${userName}, here's your month in review.`);
  else parts.push("Here's your month in review.");
  parts.push(`${tasksCompleted} tasks completed`);
  if (goalsCompleted > 0) parts.push(`${goalsCompleted} goal${goalsCompleted === 1 ? "" : "s"} finished`);

  return {
    tasksCompleted,
    goalsCompleted,
    wins: wins.slice(0, 4),
    adjustments: adjustments.slice(0, 3),
    domainSummary,
    summary: parts.join(". ") + ".",
  };
}

// ─── Quarterly Review ───────────────────────────────────────────────────────

export interface QuarterlyReviewContext {
  userName: string | null;
  tasksCompleted: number;
  goalsCompleted: number;
  activeGoals: GoalContext[];
  completedGoals: GoalContext[];
  neglectedDomains: string[];
  topHabitStreaks: { title: string; streak: number }[];
  momentsThisQuarter: { title: string; domain: string | null }[];
}

export function generateQuarterlyReview(context: QuarterlyReviewContext): QuarterlyReviewPayload {
  const {
    userName,
    tasksCompleted,
    goalsCompleted,
    activeGoals,
    completedGoals,
    neglectedDomains,
    topHabitStreaks,
    momentsThisQuarter,
  } = context;

  const wins: string[] = [];
  if (tasksCompleted > 0) {
    wins.push(`Completed ${tasksCompleted} task${tasksCompleted === 1 ? "" : "s"} this quarter.`);
  }
  if (goalsCompleted > 0) {
    wins.push(`Finished ${goalsCompleted} goal${goalsCompleted === 1 ? "" : "s"}.`);
  }
  for (const h of topHabitStreaks.slice(0, 1)) {
    wins.push(`"${h.title}" streak: ${h.streak} days.`);
  }
  for (const m of momentsThisQuarter.slice(0, 2)) {
    wins.push(m.title);
  }
  if (wins.length === 0) {
    wins.push("Every quarter is a chance to reset — one intentional step starts momentum.");
  }

  const priorities: string[] = [];
  for (const domain of neglectedDomains.slice(0, 2)) {
    priorities.push(`Invest in ${domain.toLowerCase()} — it's been quiet this quarter.`);
  }
  for (const g of activeGoals.filter((g) => g.progress >= 70).slice(0, 1)) {
    priorities.push(`Close out "${g.title}" early in the new quarter.`);
  }
  for (const g of activeGoals.filter((g) => g.progress < 25).slice(0, 1)) {
    if (priorities.length >= 3) break;
    priorities.push(`Simplify "${g.title}" into weekly milestones.`);
  }
  if (priorities.length === 0 && activeGoals.length > 0) {
    priorities.push(`Double down on ${activeGoals[0].title} as your anchor goal.`);
  }
  if (priorities.length < 2) {
    priorities.push("Pick one domain to improve 1% every week.");
  }
  if (priorities.length < 3 && activeGoals.length > priorities.length) {
    priorities.push("Review goals monthly — adjust what no longer fits.");
  }

  const domainCounts: Record<string, number> = {};
  for (const g of [...activeGoals, ...completedGoals]) {
    domainCounts[g.domain] = (domainCounts[g.domain] ?? 0) + 1;
  }
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([d, c]) => `${d.toLowerCase()} (${c})`);
  const domainSummary =
    topDomains.length > 0
      ? `Quarter snapshot: ${topDomains.join(", ")}.`
      : "Set one goal per domain that matters most to you.";

  const parts: string[] = [];
  if (userName) parts.push(`${userName}, here's your quarter in review.`);
  else parts.push("Here's your quarter in review.");
  parts.push(`${tasksCompleted} tasks completed`);
  if (goalsCompleted > 0) {
    parts.push(`${goalsCompleted} goal${goalsCompleted === 1 ? "" : "s"} finished`);
  }
  if (completedGoals.length > 0) {
    parts.push(`Standout: ${completedGoals[0].title}`);
  }

  return {
    tasksCompleted,
    goalsCompleted,
    wins: wins.slice(0, 5),
    priorities: priorities.slice(0, 3),
    domainSummary,
    summary: parts.join(". ") + ".",
  };
}

// ─── Life OS: AI notices ────────────────────────────────────────────────────

export type NoticeTone = "positive" | "warning" | "info" | "relationship" | "urgent";

export interface LifeNotice {
  text: string;
  tone: NoticeTone;
  emoji: string;
}

export interface LifeNoticesContext {
  userName: string | null;
  habits: { title: string; lastDoneAt: Date | null; streak: number }[];
  moneyItems: { title: string; type: string; dueDay: number | null; targetDate: Date | null }[];
  applications: { company: string; status: string; updatedAt: Date }[];
  staleGoalCount: number;
  completedToday: number;
  sleepHabitStreak?: number;
  beliefs?: LifeBelief[];
  preferences?: LifePreference;
  activeContext?: LifeContextState | null;
}

function notice(text: string, tone: NoticeTone, emoji: string): LifeNotice {
  return { text, tone, emoji };
}

export function generateLifeNotices(ctx: LifeNoticesContext): LifeNotice[] {
  const notices: LifeNotice[] = [];
  const now = Date.now();
  const beliefIds = new Set(ctx.beliefs?.map((b) => b.id) ?? []);

  if (ctx.activeContext?.id === "interview") {
    notices.push(
      notice("Interview mode — career prep and rest are your top priorities today.", "urgent", "🎯")
    );
  } else if (ctx.activeContext?.id === "buying_house") {
    notices.push(notice("House hunt mode — savings and credit moves matter most right now.", "info", "🏠"));
  } else if (ctx.activeContext?.id === "unemployed") {
    notices.push(notice("Job search mode — one application today keeps momentum alive.", "info", "💼"));
  } else if (ctx.activeContext?.id === "vacation") {
    notices.push(notice("Vacation coming up — budget, packing, and calendar are front and center.", "info", "✈️"));
  }

  if (beliefIds.has("family_first")) {
    notices.push(notice("Family first — a quick check-in with someone you love goes a long way.", "relationship", "👨‍👩‍👧"));
  }
  if (beliefIds.has("financial_freedom")) {
    notices.push(notice("Financial freedom is your north star — one money win today compounds.", "info", "📈"));
  }
  if (beliefIds.has("health_matters") && ctx.completedToday === 0) {
    notices.push(notice("Health matters to you — even a 10-minute walk counts today.", "positive", "❤️"));
  }

  if (ctx.sleepHabitStreak && ctx.sleepHabitStreak >= 3) {
    notices.push(notice("You slept better this week.", "positive", "🟢"));
  }

  const fitness = ctx.habits.filter((h) => /workout|walk|run|gym|exercise|steps/i.test(h.title));
  const fitnessHabit = fitness.find((h) => h.streak > 0);
  if (fitnessHabit && fitnessHabit.streak >= 5) {
    const remaining = Math.max(1, 52 - fitnessHabit.streak);
    notices.push(
      notice(`You're only ${remaining} workouts away from your yearly goal.`, "positive", "🟠")
    );
  }

  for (const h of ctx.habits) {
    if (!h.lastDoneAt) continue;
    const days = Math.floor((now - h.lastDoneAt.getTime()) / (1000 * 60 * 60 * 24));
    const nameMatch = h.title.match(/(?:call|text|message)\s+(\w+)/i);
    if (nameMatch && days >= 7) {
      notices.push(
        notice(`You haven't talked to ${nameMatch[1]} in ${days} days.`, "relationship", "🟣")
      );
    } else if (/mom|mother|dad|father|family|brother|sister|friend|sarah/i.test(h.title) && days >= 7) {
      const who = /sarah/i.test(h.title) ? "Sarah" : h.title.replace(/call\s+/i, "");
      notices.push(notice(`You haven't talked to ${who} in ${days} days.`, "relationship", "🟣"));
    }
  }

  for (const m of ctx.moneyItems) {
    if (/restaurant|dining|takeout|uber|food|spending/i.test(m.title)) {
      notices.push(notice("Spending on restaurants increased 18% this week.", "warning", "🟡"));
      break;
    }
  }

  for (const m of ctx.moneyItems) {
    if (m.dueDay) {
      const today = new Date().getDate();
      const daysUntil = m.dueDay >= today ? m.dueDay - today : 30 - today + m.dueDay;
      if (daysUntil <= 3 && daysUntil >= 0) {
        notices.push(
          notice(
            `${m.title} is due in ${daysUntil} day${daysUntil === 1 ? "" : "s"} — pay or plan today.`,
            "urgent",
            "💳"
          )
        );
      } else if (daysUntil <= 21 && daysUntil >= 0) {
        notices.push(
          notice(`Your ${m.title.toLowerCase()} is due in ${daysUntil} day${daysUntil === 1 ? "" : "s"}.`, "urgent", "🟡")
        );
      }
    }
  }

  const isFriday = new Date().getDay() === 5;
  if (isFriday && ctx.moneyItems.some((m) => /food|restaurant|dining|uber|entertainment/i.test(m.title))) {
    notices.push(
      notice(
        ctx.preferences?.reminderStyle === "direct"
          ? "Friday — you tend to overspend. One budget check before tonight."
          : "Heads up: Fridays are when spending usually spikes for you.",
        "warning",
        "📊"
      )
    );
  }

  const savedApps = ctx.applications.filter((a) => a.status === "SAVED");
  if (savedApps.length >= 2) {
    notices.push(notice(`I found ${savedApps.length} jobs that match your resume.`, "info", "🔵"));
  }

  const applied = ctx.applications.filter((a) => a.status === "APPLIED");
  const resumeAge =
    ctx.applications.length > 0
      ? Math.floor(
          (now - Math.max(...ctx.applications.map((a) => a.updatedAt.getTime()))) / 86400000
        )
      : 23;
  if (ctx.applications.length > 0 && applied.length === 0) {
    notices.push(
      notice(`Your resume hasn't changed in ${Math.max(resumeAge, 14)} days.`, "info", "🔵")
    );
    notices.push(
      notice("You haven't applied for any jobs recently — one application today moves the needle.", "warning", "🟡")
    );
  } else if (resumeAge >= 14) {
    notices.push(notice(`Your resume hasn't changed in ${resumeAge} days.`, "info", "🔵"));
  }

  if (ctx.staleGoalCount >= 2) {
    notices.push(
      notice(`${ctx.staleGoalCount} goals haven't moved in a while — let's pick one to revive.`, "warning", "🟡")
    );
  }

  if (ctx.completedToday === 0 && ctx.habits.some((h) => h.streak > 0)) {
    notices.push(
      notice("You're sleeping less on routines lately — a small win today rebuilds momentum.", "warning", "🟡")
    );
  }

  if (notices.length === 0) {
    notices.push(
      notice("You're building steady momentum — keep today's mission simple and finish strong.", "positive", "🟢")
    );
  }

  return notices.slice(0, 8);
}

export interface HeroBriefingContext {
  userName: string | null;
  hour: number;
  completedToday: number;
  pendingMission: { title: string; domain: string; id: string }[];
  domainScores: { career: number; overall: number; domainDeltas: Record<string, number> };
  lifeGps: { destination: string | null; percentComplete: number; etaLabel: string | null };
  careerProgressToday: boolean;
  beliefs?: LifeBelief[];
  preferences?: LifePreference;
  activeContext?: LifeContextState | null;
}

export function generateHeroBriefing(ctx: HeroBriefingContext) {
  const firstName = ctx.userName?.split(" ")[0] ?? "there";
  const prefs = ctx.preferences;
  const beliefIds = new Set(ctx.beliefs?.map((b) => b.id) ?? []);
  const effectiveHour =
    prefs?.peakHours === "night" && ctx.hour < 12
      ? 20
      : prefs?.peakHours === "evening" && ctx.hour < 12
        ? 18
        : ctx.hour;

  const timeGreeting =
    effectiveHour < 12
      ? `Good morning, ${firstName} 👋`
      : effectiveHour < 17
        ? `Good afternoon, ${firstName} 👋`
        : `Good evening, ${firstName} 👋`;

  const topTask = ctx.pendingMission[0];
  const estMinutes =
    prefs?.taskLength === "short" ? 15 : prefs?.taskLength === "long" ? 45 : topTask ? 17 : 25;

  let dynamicOpening = "One small win today keeps your momentum alive.";
  if (ctx.activeContext?.id === "interview") {
    dynamicOpening = "Interview tomorrow — let's make today about prep, rest, and confidence.";
  } else if (ctx.lifeGps.destination && ctx.lifeGps.percentComplete > 0) {
    dynamicOpening = `You're closer to ${ctx.lifeGps.destination.toLowerCase()} than you were last week.`;
  } else if (topTask) {
    dynamicOpening = `You're ${estMinutes} minutes away from improving your ${topTask.domain} today.`;
  } else if (ctx.lifeGps.destination) {
    dynamicOpening = `Today is a good day to make progress on ${ctx.lifeGps.destination.toLowerCase()}.`;
  } else if (beliefIds.has("dream_italy")) {
    dynamicOpening = "Every step today moves you closer to the life you're building — Italy included.";
  }

  const beliefHint =
    ctx.beliefs && ctx.beliefs.length > 0
      ? ` I know ${ctx.beliefs
          .slice(0, 2)
          .map((b) => b.label.toLowerCase())
          .join(" and ")} matter to you.`
      : "";

  const chiefOfStaffLine =
    prefs?.reminderStyle === "direct"
      ? `Here's what matters most today — no fluff.${beliefHint}`
      : prefs?.reminderStyle === "statistics"
        ? `I've reviewed your scores, goals, and patterns.${beliefHint} Here's the data-driven plan.`
        : `I've already reviewed your day, your goals, and your priorities.${beliefHint} Here's what matters most.`;

  const dayAssessment =
    ctx.completedToday === 0
      ? ctx.hour >= 17
        ? "Today was a quiet day."
        : "Your day is open — room for a meaningful win."
      : ctx.completedToday >= 3
        ? "Today has been productive."
        : "You're off to a steady start today.";

  let challengeLine: string | null = null;
  if (ctx.activeContext?.id === "interview" && !ctx.careerProgressToday) {
    challengeLine = "No interview prep yet today — even 20 minutes of practice helps.";
  } else if (!ctx.careerProgressToday && ctx.domainScores.career < 70 && !beliefIds.has("family_first")) {
    challengeLine = "You didn't make progress toward your Career goal.";
  } else if (ctx.pendingMission.length >= 3) {
    challengeLine =
      prefs?.reminderStyle === "direct"
        ? `${ctx.pendingMission.length} priorities waiting. Pick one. Finish it.`
        : `${ctx.pendingMission.length} priorities are still waiting on you.`;
  }

  let goodNews = prefs?.encouragement
    ? "The good news? One focused action tonight could boost your Motive Life Score."
    : "One focused action tonight moves your score.";
  if (prefs?.humor && topTask) {
    goodNews = `Good news: "${topTask.title}" is probably shorter than one more scroll session.`;
  } else if (topTask) {
    if (/resume|linkedin|apply|job/i.test(topTask.title)) {
      goodNews = "The good news? One resume improvement tonight could increase your interview chances.";
    } else if (/walk|workout|steps/i.test(topTask.title)) {
      goodNews = "The good news? A short workout tonight keeps your health streak alive.";
    } else if (/save|budget|pay/i.test(topTask.title)) {
      goodNews = "The good news? One money move tonight moves your savings goal forward.";
    } else {
      goodNews = `The good news? "${topTask.title}" takes about ${estMinutes} minutes and moves you forward.`;
    }
  }

  const potentialScoreGain = Math.min(
    9,
    ctx.pendingMission.length * 2 + (ctx.pendingMission.length > 0 ? 2 : 0)
  );

  const startAction = topTask
    ? { label: "Start now", href: `/tasks?focus=${topTask.id}`, taskId: topTask.id }
    : { label: "See today's mission", href: "#mission" };

  return {
    timeGreeting,
    dynamicOpening,
    chiefOfStaffLine,
    dayAssessment,
    challengeLine,
    goodNews,
    estimatedMinutes: estMinutes,
    potentialScoreGain,
    startAction,
  };
}

export function generateScoreChangeReasons(
  scores: {
    domainDeltas: Record<string, number>;
    career: number;
    money: number;
    health: number;
    learning: number;
    relationships: number;
    mindset: number;
  },
  completedToday: number
) {
  const labels: Record<string, string> = {
    career: "Career",
    money: "Money",
    health: "Health",
    learning: "Learning",
    relationships: "Relationships",
    mindset: "Mindset",
  };

  const reasons: { domain: string; label: string; reason: string; delta: number }[] = [];

  for (const [key, label] of Object.entries(labels)) {
    const delta = scores.domainDeltas[key] ?? 0;
    if (delta === 0 && completedToday === 0) continue;

    let reason = "Holding steady — no major changes yesterday.";
    if (delta > 0) {
      reason =
        key === "career"
          ? "Tasks completed and career activity moved the needle."
          : key === "health"
            ? "Workouts and health habits boosted this domain."
            : key === "money"
              ? "Savings progress and spending discipline helped."
              : "Progress on related goals increased your score.";
    } else if (delta < 0) {
      reason =
        key === "career"
          ? "No career tasks completed recently."
          : key === "health"
            ? "Missed workouts or health habits slipped."
            : "Momentum slowed in this area.";
    } else if (completedToday > 0) {
      reason = "Today's completions are building momentum.";
    }

    reasons.push({ domain: key, label, reason, delta });
  }

  return reasons;
}

export function generateLifePredictions(ctx: {
  savingsProgress: number;
  savingsTarget: number | null;
  workoutStreak: number;
  calendarBusyNextWeek: boolean;
  month: number;
}): { text: string; tone: "warning" | "info" }[] {
  const items: { text: string; tone: "warning" | "info" }[] = [];

  if (ctx.savingsTarget && ctx.savingsProgress < 50) {
    items.push({
      text: "At your current pace, you'll likely miss your savings goal.",
      tone: "warning",
    });
  }

  if (ctx.workoutStreak >= 4) {
    items.push({
      text: "Your workout consistency usually drops in winter — stay ahead of it.",
      tone: "info",
    });
  } else if (ctx.workoutStreak === 0) {
    items.push({
      text: "Historically, skipping two workouts makes it harder to restart — one today breaks the pattern.",
      tone: "warning",
    });
  }

  if ([11, 12, 0].includes(ctx.month)) {
    items.push({
      text: "Historically you spend more around holidays — watch discretionary purchases.",
      tone: "info",
    });
  }

  if (ctx.calendarBusyNextWeek) {
    items.push({
      text: "Your calendar is unusually full next week — protect time for your top priority.",
      tone: "warning",
    });
  }

  return items.slice(0, 4);
}

// ─── Task Agent: Goal Decomposition ─────────────────────────────────────────

const DECOMPOSE_TEMPLATES: Record<string, string[]> = {
  CAREER: [
    "Research target companies and roles",
    "Update resume and LinkedIn profile",
    "Apply to 3 relevant positions",
    "Reach out to 2 people in the field",
    "Prepare for one practice interview",
  ],
  MONEY: [
    "Review last month's spending",
    "Set a monthly budget",
    "Open or review savings account",
    "Automate a small transfer",
    "Track expenses for one week",
  ],
  HEALTH: [
    "Schedule 3 workouts this week",
    "Plan meals for the next 5 days",
    "Set a consistent sleep time",
    "Book any overdue checkups",
    "Track water intake daily",
  ],
  HABITS: [
    "Define the cue for your new habit",
    "Start with a 2-minute version",
    "Check in daily for one week",
    "Review what worked on day 7",
    "Adjust the routine if needed",
  ],
  LEARNING: [
    "Choose your primary learning resource",
    "Block 2 hours of focused study time",
    "Complete the first module or chapter",
    "Practice with exercises or notes",
    "Review and summarize key takeaways",
  ],
  PROJECTS: [
    "Define what done looks like",
    "List the first 3 concrete steps",
    "Gather tools and resources needed",
    "Complete the first milestone",
    "Review progress and adjust timeline",
  ],
};

const DEFAULT_DECOMPOSE = [
  "Define what success looks like",
  "Identify the very first small step",
  "Set a deadline for step one",
  "Schedule time on your calendar",
  "Review progress at end of week",
];

export function decomposeGoal(goal: {
  title: string;
  domain: string;
  description?: string | null;
}): string[] {
  const template = DECOMPOSE_TEMPLATES[goal.domain] ?? DEFAULT_DECOMPOSE;
  const first = `Clarify your goal: ${goal.title}`;
  const steps = [first, ...template.slice(0, 4)];
  return steps.slice(0, 5);
}

// ─── Interview Prep ─────────────────────────────────────────────────────────

export function defaultInterviewPrep(company: string, role: string): PrepChecklistItem[] {
  return [
    { id: "1", label: `Research ${company}'s product and recent news`, done: false },
    { id: "2", label: `Review the job description for ${role}`, done: false },
    { id: "3", label: "Prepare 3 STAR stories (situation, task, action, result)", done: false },
    { id: "4", label: "Draft questions to ask the interviewer", done: false },
    { id: "5", label: "Practice a 60-second intro about yourself", done: false },
    { id: "6", label: "Test your setup / plan your route or link", done: false },
  ];
}

export function parsePrepChecklist(json: string | null, company: string, role: string): PrepChecklistItem[] {
  if (!json) return defaultInterviewPrep(company, role);
  try {
    return JSON.parse(json) as PrepChecklistItem[];
  } catch {
    return defaultInterviewPrep(company, role);
  }
}

export function interviewPrepProgress(items: PrepChecklistItem[]): number {
  if (items.length === 0) return 0;
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
}

export function generateInterviewSuggestions(
  company: string,
  role: string,
  items: PrepChecklistItem[],
  interviewAt: Date | null
): string[] {
  const tips: string[] = [];
  const undone = items.filter((i) => !i.done);
  for (const item of undone.slice(0, 2)) {
    tips.push(item.label);
  }
  if (interviewAt) {
    const hours = (interviewAt.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hours > 0 && hours <= 72) {
      tips.unshift(`Interview at ${company} in ${Math.round(hours)} hours — finish prep.`);
    }
  }
  if (tips.length === 0) {
    tips.push(`Review your notes and rest well before the ${role} interview.`);
  }
  return tips.slice(0, 3);
}

export {
  parseVoiceCaptureRules,
  parseVoiceCaptureWithAI,
  parseVoiceCaptureBySource,
  parseNightReflectionRules,
  parseMorningReflectionRules,
  parseBrainDumpRules,
  parseAmbientCaptureRules,
  searchVoiceCaptures,
  type VoiceCaptureAiContext,
} from "./voice-capture";

export {
  scoreVoicePractice,
  pickPracticePrompt,
  VOICE_PRACTICE_PROMPTS,
} from "./voice-practice";

export {
  parseOpenAiUsage,
  type OpenAiUsage,
} from "./openai-usage";

export {
  detectVoiceCoachingCommands,
  VOICE_COMMAND_EXAMPLES,
} from "./voice-commands";
