import { prisma } from "@forward/database";
import {
  type AiCoachPrompt,
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
          ? "/money"
          : s.agent === "HEALTH"
            ? "/health"
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
    money: { insight: "Review your budget trends.", action: "Review", href: "/money" },
    health: { insight: "Small movement keeps momentum.", action: "Log", href: "/health" },
    learning: { insight: "15 minutes of learning compounds.", action: "Study", href: "/learning" },
    relationships: { insight: "Someone is due for a check-in.", action: "Message", href: "/relationships" },
    habits: { insight: "Your morning routine sets the tone.", action: "Check in", href: "/habits" },
    goals: { insight: "One goal is closest to completion.", action: "Finish", href: "/dashboard#life-gps" },
    mindset: { insight: "A 2-minute journal entry helps.", action: "Reflect", href: "/health" },
    travel: { insight: "Plan your next adventure.", action: "Explore", href: "/dashboard#life-gps" },
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
        href: "/money",
        tone: "info",
      });
    }
    if (/flight|travel|italy|vacation|airfare/i.test(blob)) {
      items.push({
        id: `travel-${e.id}`,
        text: "Flights to your dream destination are trending down.",
        href: "/dashboard#life-gps",
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
          href: "/health",
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
        href: "/money",
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

export function buildAiCoachPrompt(
  pendingMission: { title: string; domain: string; id: string }[],
  lifeGps: { destination: string | null },
  persona?: UserPersona,
  activeContext?: { id: string; label: string } | null
): AiCoachPrompt {
  const top = pendingMission[0];
  const prefs = persona?.preferences;
  const encouragement = prefs?.encouragement !== false;

  if (activeContext?.id === "interview") {
    return {
      prompt: encouragement ? "How are you feeling about the interview?" : "Interview prep check-in",
      suggestion: "Practice your top 3 stories and review the company one more time.",
      actionLabel: "Prep now",
      actionHref: top ? `/tasks?focus=${top.id}` : "/career",
    };
  }

  if (top) {
    const prompt =
      prefs?.reminderStyle === "direct"
        ? "What's the one thing you'll finish today?"
        : encouragement
          ? "How did today go?"
          : "Next action?";
    return {
      prompt,
      suggestion:
        prefs?.taskLength === "short"
          ? `Quick win: ${top.title} (~15 min)`
          : `Your best next move: ${top.title}`,
      actionLabel: prefs?.reminderStyle === "direct" ? "Do it" : "Do it now",
      actionHref: `/tasks?focus=${top.id}`,
    };
  }

  if (lifeGps.destination) {
    const beliefLine = persona?.beliefs[0]?.label;
    return {
      prompt: encouragement ? "What's one thing I can do today?" : "Today's focus?",
      suggestion: beliefLine
        ? `Move "${lifeGps.destination}" forward — aligned with ${beliefLine.toLowerCase()}.`
        : `Move ${lifeGps.destination} forward with one small action.`,
      actionLabel: "Set focus",
      actionHref: "/dashboard#life-gps",
    };
  }

  return {
    prompt: "What should I focus on?",
    suggestion:
      prefs?.peakHours === "night"
        ? "Your peak hours are later — pick one small evening win."
        : "Pick one life area and take a 15-minute step.",
    actionLabel: "Choose module",
    actionHref: "#modules",
  };
}
