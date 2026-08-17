import { prisma } from "@forward/database";
import { estimateActionMinutes, estimateActionReward } from "@/lib/action-rewards";
import {
  type AiCoachPrompt,
  type BriefingInsight,
  type DomainScoreMap,
  type LifeFeedItem,
  type LifeForecastItem,
  type LifeModuleId,
  type LifeTimelineEntry,
  type ModuleCardPayload,
} from "@forward/shared";
import type { UserPersona } from "./user-persona";
import { startOfDay } from "./api";
import { getLifeMoments, syncProgressToLifeMoments } from "./life-moments";

const MODULE_DOMAIN: Partial<
  Record<LifeModuleId, keyof Omit<DomainScoreMap, "overall" | "overallDelta" | "domainDeltas">>
> = {
  career: "career",
  money: "money",
  health: "health",
  learning: "learning",
  relationships: "relationships",
  habits: "mindset",
  mindset: "mindset",
  goals: "career",
  travel: "money",
};

function dayLabel(date: Date): string {
  const today = startOfDay();
  const d = startOfDay(date);
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function estimateScoreDelta(title: string, type: string): number {
  if (/skip|miss|failed|late/i.test(title)) return -1;
  if (/apply|resume|finished|completed|saved \$|promotion/i.test(title)) return 4;
  if (/workout|walk|steps/i.test(title)) return 2;
  if (type === "GOAL_COMPLETED") return 8;
  if (type === "TASK_COMPLETED") return 3;
  return 2;
}

export async function buildLifeTimeline(userId: string): Promise<LifeTimelineEntry[]> {
  await syncProgressToLifeMoments(userId);

  const moments = await getLifeMoments(userId, 15);

  if (moments.length > 0) {
    return moments.map((m) => ({
      id: m.id,
      dayLabel: dayLabel(m.occurredAt),
      title: m.title,
      scoreDelta: m.scoreDelta ?? 0,
    }));
  }

  const since = new Date(startOfDay());
  since.setDate(since.getDate() - 14);

  const [progressMoments, tasks] = await Promise.all([
    prisma.progressMoment.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.task.findMany({
      where: { userId, status: "DONE", completedAt: { gte: since } },
      orderBy: { completedAt: "desc" },
      take: 8,
    }),
  ]);

  const entries: LifeTimelineEntry[] = [];

  for (const t of tasks) {
    if (!t.completedAt) continue;
    entries.push({
      id: t.id,
      dayLabel: dayLabel(t.completedAt),
      title: t.title,
      scoreDelta: estimateScoreDelta(t.title, "TASK_COMPLETED"),
    });
  }

  for (const m of progressMoments) {
    entries.push({
      id: m.id,
      dayLabel: dayLabel(m.createdAt),
      title: m.title,
      scoreDelta: estimateScoreDelta(m.title, m.type),
    });
  }

  return entries.slice(0, 10);
}

function formatEtaFromProgress(progress: number, targetDate: Date | null): string {
  if (targetDate) {
    const days = Math.ceil((targetDate.getTime() - Date.now()) / 86400000);
    if (days <= 0) return "Target reached soon";
    if (days < 60) return `${days} days`;
    if (days < 365) return `${Math.round(days / 30)} months`;
    return targetDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  const remaining = 100 - progress;
  if (remaining <= 0) return "Complete";
  return `${Math.max(1, Math.round(remaining / 8))} months`;
}

export async function buildLifeForecast(
  userId: string,
  lifeDestination: string | null
): Promise<LifeForecastItem[]> {
  const goals = await prisma.goal.findMany({
    where: { userId, status: "ACTIVE" },
    select: { title: true, domain: true, progress: true, targetDate: true },
    take: 6,
  });

  const moneyItems = await prisma.moneyItem.findMany({
    where: { userId, type: "SAVINGS" },
    take: 2,
  });

  const items: LifeForecastItem[] = [];

  if (lifeDestination) {
    const linked = goals.find((g) =>
      g.title.toLowerCase().includes(lifeDestination.toLowerCase().slice(0, 8))
    );
    items.push({
      emoji: "🏠",
      label: lifeDestination,
      eta: formatEtaFromProgress(linked?.progress ?? 42, linked?.targetDate ?? null),
    });
  }

  for (const m of moneyItems) {
    const pct =
      m.targetAmount && m.targetAmount > 0
        ? Math.round((m.currentAmount / m.targetAmount) * 100)
        : 40;
    items.push({
      emoji: "🏠",
      label: m.title,
      eta: formatEtaFromProgress(pct, m.targetDate),
    });
  }

  const career = goals.find((g) => g.domain === "CAREER");
  if (career) {
    items.push({
      emoji: "📈",
      label: "Promotion",
      eta: formatEtaFromProgress(career.progress, career.targetDate),
    });
  }

  const health = goals.find((g) => g.domain === "HEALTH");
  if (health) {
    items.push({
      emoji: "🏃",
      label: health.title.toLowerCase().includes("weight") ? "Weight Goal" : "Health Goal",
      eta: formatEtaFromProgress(health.progress, health.targetDate),
    });
  }

  const learning = goals.find((g) => g.domain === "LEARNING");
  if (learning) {
    items.push({
      emoji: "📚",
      label: learning.title.toLowerCase().includes("degree") ? "Finish Degree" : learning.title,
      eta: formatEtaFromProgress(learning.progress, learning.targetDate),
    });
  }

  if (items.length === 0) {
    items.push(
      { emoji: "🎯", label: "Set a destination", eta: "Start today" },
      { emoji: "📈", label: "Your next milestone", eta: "—" }
    );
  }

  return items.slice(0, 5);
}

export function buildLifeFeed(
  suggestions: { id: string; title: string; agent?: string }[],
  enriched: { title: string; reason: string; actionHref?: string; agent: string }[],
  applications: { company: string; status: string }[],
  notices: { text: string; tone: string }[],
  integrationItems: LifeFeedItem[] = []
): LifeFeedItem[] {
  const feed: LifeFeedItem[] = [...integrationItems];

  for (const s of enriched.slice(0, 5)) {
    const href =
      s.actionHref ??
      (s.agent === "CAREER"
        ? "/career"
        : s.agent === "MONEY"
          ? "/kashu"
          : s.agent === "HEALTH"
            ? "/vitalu"
            : s.agent === "LEARNING"
              ? "/learning"
              : undefined);
    feed.push({
      id: `sug-${feed.length}`,
      text: s.title,
      href,
      tone: "info",
    });
  }

  const saved = applications.filter((a) => a.status === "SAVED");
  if (saved.length > 0) {
    feed.push({
      id: "jobs",
      text: `${saved.length} new job${saved.length === 1 ? "" : "s"} match your profile.`,
      href: "/career",
      tone: "info",
    });
  }

  for (const n of notices.slice(0, 4)) {
    feed.push({
      id: `notice-${feed.length}`,
      text: n.text,
      tone: n.tone as LifeFeedItem["tone"],
    });
  }

  if (!feed.some((f) => /spending|insurance|passport|mortgage|cheaper|improved/i.test(f.text))) {
    feed.push({
      id: "spending",
      text: "Your spending improved compared to last week.",
      tone: "positive",
    });
  }

  return feed.slice(0, 8);
}

export function buildModuleCards(
  modules: { id: LifeModuleId; label: string; emoji: string; href: string }[],
  scores: DomainScoreMap,
  nextSteps: Partial<
    Record<
      LifeModuleId,
      {
        title: string;
        insight: string;
        actionLabel: string;
        actionHref: string;
        entityId?: string;
      }
    >
  >
): ModuleCardPayload[] {
  const fallbacks: Partial<
    Record<LifeModuleId, { insight: string; action: string; href: string }>
  > = {
    career: { insight: "Your next career move is one tap away.", action: "Open", href: "/career" },
    money: { insight: "Review your budget trends.", action: "Review", href: "/kashu" },
    health: { insight: "Small movement keeps momentum.", action: "Log", href: "/vitalu" },
    learning: { insight: "15 minutes of learning compounds.", action: "Study", href: "/learning" },
    relationships: { insight: "Someone is due for a check-in.", action: "Message", href: "/relationships" },
    habits: { insight: "Your morning routine sets the tone.", action: "Check in", href: "/habits" },
    goals: { insight: "One goal is closest to completion.", action: "Finish", href: "/goals" },
    mindset: { insight: "A 2-minute journal entry helps.", action: "Reflect", href: "/vitalu" },
    travel: { insight: "Plan your next adventure.", action: "Explore", href: "/goals" },
  };

  return modules.map((mod) => {
    const domainKey = MODULE_DOMAIN[mod.id] ?? "career";
    const progress = scores[domainKey];
    const step = nextSteps[mod.id];
    const fb = fallbacks[mod.id];

    return {
      id: mod.id,
      label: mod.label.replace(" Module", ""),
      emoji: mod.emoji,
      href: mod.href,
      progress,
      insight: step?.insight ?? fb?.insight ?? "Your next best step is one tap away.",
      actionLabel: step?.actionLabel ?? fb?.action ?? "Open",
      actionHref: step?.actionHref ?? fb?.href ?? mod.href,
      entityId: step?.entityId,
      actionTitle: step?.title ?? mod.label,
    };
  });
}

export function buildIntegrationFeedItems(
  context: {
    emails?: { id: string; subject: string; from: string; snippet: string; isUnread: boolean }[];
    calendarEvents?: { title: string; hoursUntil: number }[];
    moneyItems?: { title: string; type: string; daysUntilDue: number | null }[];
    memories?: { content: string }[];
  }
): LifeFeedItem[] {
  const items: LifeFeedItem[] = [];

  for (const e of context.emails ?? []) {
    const blob = `${e.subject} ${e.snippet}`.toLowerCase();
    if (/insurance|policy renewal|premium/i.test(blob)) {
      items.push({
        id: `ins-${e.id}`,
        text: "I found cheaper insurance — check your inbox.",
        href: "/integrations",
        tone: "info",
      });
    }
    if (/passport|expires|expiration/i.test(blob)) {
      items.push({
        id: `passport-${e.id}`,
        text: "Your passport expires soon.",
        tone: "urgent",
      });
    }
    if (/mortgage|refinance|rate/i.test(blob)) {
      items.push({
        id: `mortgage-${e.id}`,
        text: "I found a better mortgage rate in your email.",
        href: "/kashu",
        tone: "info",
      });
    }
    if (/flight|travel|italy|vacation|airfare/i.test(blob)) {
      items.push({
        id: `travel-${e.id}`,
        text: "Flights to your dream destination are trending down.",
        href: "/goals",
        tone: "positive",
      });
    }
    if (/job|interview|offer|recruiter/i.test(blob) && e.isUnread) {
      items.push({
        id: `job-${e.id}`,
        text: `Three new jobs in your inbox — including "${e.subject.slice(0, 40)}".`,
        href: "/career",
        tone: "info",
      });
    }
  }

  for (const ev of context.calendarEvents ?? []) {
    if (ev.hoursUntil >= 0 && ev.hoursUntil <= 72) {
      if (/doctor|dentist|checkup|health/i.test(ev.title)) {
        items.push({
          id: `cal-health-${ev.title}`,
          text: `Health appointment coming up: ${ev.title}.`,
      href: "/vitalu",
          tone: "info",
        });
      }
    }
  }

  for (const m of context.moneyItems ?? []) {
    if (m.daysUntilDue != null && m.daysUntilDue <= 14 && m.daysUntilDue >= 0) {
      items.push({
        id: `bill-${m.title}`,
        text: `${m.title} is due in ${m.daysUntilDue} days.`,
        href: "/kashu",
        tone: "warning",
      });
    }
  }

  for (const mem of context.memories ?? []) {
    if (/passport|expires/i.test(mem.content)) {
      items.push({
        id: "mem-passport",
        text: "Your passport expires soon — you told me to remind you.",
        tone: "urgent",
      });
      break;
    }
  }

  return items.slice(0, 6);
}

function daysSince(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function hoursUntil(date: Date): number {
  return (date.getTime() - Date.now()) / (1000 * 60 * 60);
}

export interface CoachSignals {
  recentJobVoiceSnippet?: string;
  recentApplication?: { company: string; role: string };
  daysSinceCareerTouch?: number | null;
  lifeEngineStreak?: number;
  streakAtRisk?: boolean;
  topCompanies?: string[];
  spendingNote?: string;
}

export function buildPersonalizedBriefingInsights(input: {
  calendarEvents: { title: string; hoursUntil: number }[];
  habits: { title: string; streak: number; lastDoneAt: Date | null }[];
  moneyItems: {
    title: string;
    type: string;
    currentAmount: number;
    targetAmount: number | null;
    dueDay?: number | null;
  }[];
  applications: {
    company: string;
    role: string;
    status: string;
    interviewAt: Date | null;
    updatedAt: Date;
    appliedAt: Date | null;
  }[];
  pendingMission: { title: string; domain: string }[];
  savingsProgress: number;
  savingsTarget: number | null;
  careerLastActivity: Date | null;
  recentJobVoiceSnippet?: string;
}): BriefingInsight[] {
  const careerMission = input.pendingMission.find((m) => m.domain === "career");
  const moneyMission = input.pendingMission.find((m) => m.domain === "money");
  const healthMission = input.pendingMission.find((m) => m.domain === "health");

  const interviewSoon = input.applications.find(
    (a) => a.interviewAt && hoursUntil(a.interviewAt) >= 0 && hoursUntil(a.interviewAt) <= 72
  );
  const recentApp = input.applications.find(
    (a) => daysSince(a.updatedAt) !== null && (daysSince(a.updatedAt) ?? 99) <= 3
  );

  const careerCalendar = input.calendarEvents.find(
    (e) =>
      e.hoursUntil >= 0 &&
      e.hoursUntil <= 48 &&
      /interview|review|1:1|manager|career|job/i.test(e.title)
  );

  const healthCalendar = input.calendarEvents.find(
    (e) =>
      e.hoursUntil >= 0 &&
      e.hoursUntil <= 72 &&
      /doctor|dentist|workout|gym|therapy|health/i.test(e.title)
  );

  const workoutHabit = input.habits.find((h) => /workout|walk|run|gym|steps/i.test(h.title));
  const sleepHabit = input.habits.find((h) => /sleep|bed|rest/i.test(h.title));
  const today = startOfDay();
  const workoutDoneToday = workoutHabit?.lastDoneAt ? workoutHabit.lastDoneAt >= today : false;

  const savingsItem = input.moneyItems.find((m) => m.type === "SAVINGS");
  const billDue = input.moneyItems.find((m) => {
    if (m.type !== "DEBT" && m.type !== "BILL") return false;
    if (!m.dueDay) return false;
    const now = new Date();
    const due = new Date(now.getFullYear(), now.getMonth(), m.dueDay);
    if (due < now) due.setMonth(due.getMonth() + 1);
    const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 7;
  });

  const careerDays = input.careerLastActivity ? daysSince(input.careerLastActivity) : null;

  let career: string;
  if (input.recentJobVoiceSnippet) {
    career = `I heard you mention "${input.recentJobVoiceSnippet.slice(0, 48)}…" — let's turn that into one career action today.`;
  } else if (interviewSoon) {
    const hrs = Math.round(interviewSoon.interviewAt ? hoursUntil(interviewSoon.interviewAt) : 0);
    career = `Interview with ${interviewSoon.company} in ~${hrs}h — block 20 minutes for prep while it's fresh.`;
  } else if (recentApp) {
    career = `You updated ${recentApp.company} (${recentApp.role}) recently — a 10-minute follow-up could move this forward.`;
  } else if (careerCalendar) {
    career = `"${careerCalendar.title}" is coming up — I’d protect a short prep window before it.`;
  } else if (careerMission) {
    career = `Your highest-leverage career move today: ${careerMission.title}.`;
  } else if (careerDays !== null && careerDays >= 3) {
    career = `I noticed you haven't worked on Career in ${careerDays} days — one small step today resets momentum.`;
  } else {
    career = "Career is steady — pick one task that makes your next month easier.";
  }

  let money: string;
  if (billDue) {
    money = `"${billDue.title}" is due soon — reviewing it today avoids a late surprise.`;
  } else if (input.savingsTarget && input.savingsProgress >= 50) {
    money =
      "I predict you'll reach your savings target sooner if you keep this month's pace — stay consistent.";
  } else if (input.savingsTarget && input.savingsProgress < 50) {
    money = `Savings are at ${Math.round(input.savingsProgress)}% of target — one 15-minute money review today helps.`;
  } else if (moneyMission) {
    money = `Today's money win: ${moneyMission.title}.`;
  } else if (savingsItem?.targetAmount) {
    money = `You're ${Math.round(input.savingsProgress)}% toward "${savingsItem.title}" — small deposits compound fast.`;
  } else {
    money = "A quick spending check today keeps your financial plan honest.";
  }

  let health: string;
  if (healthCalendar) {
    health = `${healthCalendar.title} is on your calendar — prep tonight so tomorrow feels easy.`;
  } else if (workoutHabit && !workoutDoneToday && workoutHabit.streak >= 2) {
    health = `You're on a ${workoutHabit.streak}-day ${workoutHabit.title.toLowerCase()} streak — don't break it tonight.`;
  } else if (workoutHabit && !workoutDoneToday) {
    health = `${workoutHabit.title} is still open today — even 15 minutes counts.`;
  } else if (sleepHabit && (sleepHabit.streak ?? 0) < 3) {
    health = `Protect your ${sleepHabit.title.toLowerCase()} routine tonight — sleep drives every other score.`;
  } else if (healthMission) {
    health = `Health priority today: ${healthMission.title}.`;
  } else {
    health = "Movement or recovery today will lift your Health score — keep it simple.";
  }

  return [
    { domain: "Career", text: career },
    { domain: "Money", text: money },
    { domain: "Health", text: health },
  ];
}

export function buildAiCoachPrompt(
  pendingMission: { title: string; domain: string; id: string }[],
  lifeGps: { destination: string | null },
  persona?: UserPersona,
  activeContext?: { id: string; label: string } | null,
  signals?: CoachSignals
): AiCoachPrompt {
  const top = pendingMission[0];
  const prefs = persona?.preferences;
  const encouragement = prefs?.encouragement !== false;
  const minutes = top ? estimateActionMinutes(top.title) : 15;
  const reward = top ? estimateActionReward(top.title, top.domain) : 4;

  if (activeContext?.id === "interview") {
    return {
      observation: "Your interview is coming up — I've been watching your prep.",
      prompt: encouragement ? "How are you feeling about the interview?" : "Interview prep check-in",
      suggestion: "Practice your top 3 stories and review the company one more time.",
      actionLabel: "Prep now",
      actionHref: top ? `/tasks?focus=${top.id}` : "/career",
      domain: "career",
      estimatedMinutes: 20,
      scoreReward: 6,
      yesLabel: "Yes, help me prep",
    };
  }

  if (signals?.streakAtRisk && (signals.lifeEngineStreak ?? 0) >= 2) {
    return {
      observation: `Your ${signals.lifeEngineStreak}-day Momentum streak is at risk tonight.`,
      prompt: "I think this should wait until tomorrow — unless you have 10 minutes now.",
      suggestion: top
        ? `Complete "${top.title}" to keep your streak alive.`
        : "One small Life Engine action keeps the streak going.",
      actionLabel: "Do it now",
      actionHref: top ? `/tasks?focus=${top.id}` : "/dashboard#life-engine",
      domain: top?.domain ?? "health",
      estimatedMinutes: minutes,
      scoreReward: reward,
      yesLabel: "Yes, save my streak",
    };
  }

  if (top) {
    const companies = signals?.topCompanies?.slice(0, 2).join(" and ");
    const observation = signals?.recentJobVoiceSnippet
      ? "I noticed something in your recent voice note about your job search."
      : signals?.recentApplication
        ? `I noticed you searched ${signals.recentApplication.role} roles recently.`
        : signals?.daysSinceCareerTouch != null && signals.daysSinceCareerTouch >= 4 && top.domain === "career"
          ? `I noticed you haven't worked on Career in ${signals.daysSinceCareerTouch} days.`
          : signals?.spendingNote
            ? signals.spendingNote
            : /job|apply|linkedin|resume/i.test(top.title)
              ? "I noticed career activity in your recent patterns."
              : "I've been reviewing your day — here's what stands out.";

    const suggestion =
      signals?.recentApplication && companies && /resume|linkedin|apply|job/i.test(top.title)
        ? `Based on your experience I'd focus on ${companies} first. Want me to tailor your resume for "${top.title}"?`
        : signals?.recentApplication && /resume|linkedin|apply|job/i.test(top.title)
          ? `Based on your ${signals.recentApplication.role} interest at ${signals.recentApplication.company}, I'd focus on "${top.title}" first. Want me to tailor your resume?`
          : prefs?.taskLength === "short"
            ? `Quick win: ${top.title} (~${minutes} min)`
            : /resume|linkedin/i.test(top.title)
              ? `Want me to tailor your resume around "${top.title}"?`
              : `Your best next move: ${top.title}`;

    const prompt =
      prefs?.reminderStyle === "direct"
        ? "What's the one thing you'll finish today?"
        : encouragement
          ? "Want me to help you knock this out?"
          : "Next action?";

    return {
      observation,
      prompt,
      suggestion,
      actionLabel: prefs?.reminderStyle === "direct" ? "Do it" : "Do it now",
      actionHref: `/tasks?focus=${top.id}`,
      domain: top.domain,
      estimatedMinutes: minutes,
      scoreReward: reward,
      yesLabel: /resume|tailor/i.test(suggestion) ? "Yes, tailor it" : "Yes, let's do it",
    };
  }

  if (lifeGps.destination) {
    const beliefLine = persona?.beliefs[0]?.label;
    return {
      observation: "Your Life GPS destination is still the north star.",
      prompt: encouragement ? "What's one thing I can do today?" : "Today's focus?",
      suggestion: beliefLine
        ? `Move "${lifeGps.destination}" forward — aligned with ${beliefLine.toLowerCase()}.`
        : `Move ${lifeGps.destination} forward with one small action.`,
      actionLabel: "Set focus",
      actionHref: "/goals",
      domain: "mindset",
      estimatedMinutes: 12,
      scoreReward: 3,
      yesLabel: "Yes, show me how",
    };
  }

  return {
    observation: "Your day still has room for a meaningful win.",
    prompt: "What should I focus on?",
    suggestion:
      prefs?.peakHours === "night"
        ? "Your peak hours are later — pick one small evening win."
        : "Pick one life area and take a 15-minute step.",
    actionLabel: "Choose module",
    actionHref: "#modules",
    estimatedMinutes: 15,
    scoreReward: 3,
    yesLabel: "Yes, guide me",
  };
}
