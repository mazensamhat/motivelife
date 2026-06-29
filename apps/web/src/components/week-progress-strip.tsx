"use client";

import type { WeekProgressStats } from "@forward/shared";
import { CheckCircle2, Flame, Sparkles, Target } from "lucide-react";

export function WeekProgressStrip({ stats }: { stats: WeekProgressStats }) {
  const hasActivity =
    stats.tasksCompleted > 0 ||
    stats.lifeXpGained > 0 ||
    stats.coachingDaysCompleted > 0 ||
    stats.lifeEngineStreak > 0;

  if (!hasActivity) return null;

  const items = [
    stats.tasksCompleted > 0
      ? { icon: CheckCircle2, label: `${stats.tasksCompleted} task${stats.tasksCompleted === 1 ? "" : "s"}`, tone: "text-brand-blue" }
      : null,
    stats.lifeXpGained > 0
      ? {
          icon: Sparkles,
          label: `+${stats.lifeXpGained} Life XP${stats.topXpDimension ? ` · ${stats.topXpDimension.label}` : ""}`,
          tone: "text-brand-purple",
        }
      : null,
    stats.coachingDaysCompleted > 0
      ? {
          icon: Target,
          label: `${stats.coachingDaysCompleted} coaching day${stats.coachingDaysCompleted === 1 ? "" : "s"}`,
          tone: "text-brand-green",
        }
      : null,
    stats.lifeEngineStreak >= 2
      ? { icon: Flame, label: `${stats.lifeEngineStreak}-day streak`, tone: "text-orange-500" }
      : null,
  ].filter(Boolean) as { icon: typeof Flame; label: string; tone: string }[];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-forward-200 bg-white px-4 py-3 text-sm shadow-sm">
      <span className="text-xs font-semibold uppercase tracking-widest text-forward-400">This week</span>
      {items.map(({ icon: Icon, label, tone }) => (
        <span key={label} className={`inline-flex items-center gap-1.5 font-medium text-forward-700`}>
          <Icon className={`h-3.5 w-3.5 ${tone}`} />
          {label}
        </span>
      ))}
    </div>
  );
}
