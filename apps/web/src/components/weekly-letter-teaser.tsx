"use client";

import type { WeekProgressStats } from "@forward/shared";
import { Calendar, Mail } from "lucide-react";
import { PremiumUpgradeNudge } from "./premium-upgrade-nudge";

function daysUntilSunday(): number {
  const day = new Date().getDay();
  return day === 0 ? 0 : 7 - day;
}

export function WeeklyLetterTeaser({ stats }: { stats?: WeekProgressStats | null }) {
  const daysLeft = daysUntilSunday();
  if (daysLeft === 0) return null;

  const dayLabel = daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;

  const preview =
    stats && stats.tasksCompleted > 0
      ? `So far: ${stats.tasksCompleted} task${stats.tasksCompleted === 1 ? "" : "s"} done${
          stats.lifeEngineStreak >= 2 ? `, ${stats.lifeEngineStreak}-day Momentum streak` : ""
        }${stats.lifeXpGained > 0 ? `, +${stats.lifeXpGained} Life XP` : ""}.`
      : "Keep logging wins this week — your letter writes itself from what you do.";

  return (
    <section className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
          <Mail className="h-5 w-5 text-violet-600" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">
            Weekly letter
          </p>
          <p className="mt-1 text-base font-semibold text-forward-900">
            Your AI weekly letter arrives {dayLabel}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-forward-600">{preview}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-forward-500">
            <Calendar className="h-3.5 w-3.5" />
            Sunday — wins, patterns, and what to focus on next week
          </p>
          <PremiumUpgradeNudge context="weekly-letter" className="mt-4" />
        </div>
      </div>
    </section>
  );
}
