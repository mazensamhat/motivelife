"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Briefcase,
  Heart,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { DailyExperience } from "./daily-experience";
import { GenerationSetup } from "./generation-setup";
import { OnboardingBanner } from "./onboarding-banner";
import { TodayTasks } from "./today-tasks";
import { Card, CardHeading, CardTitle } from "./card";
import { WidgetIcon } from "./themed-icon";
import { Button } from "./button";
import {
  computeLifeScore,
  type Generation,
  type GenerationTheme,
} from "@/lib/generation";
import { DOMAIN_LABELS, type LifeDomain } from "@forward/shared";
import { readApiJson } from "@/lib/fetch-api";

interface Stats {
  completedToday: number;
  completedWeek: number;
  activeGoals: number;
  livesMovedForward: number;
}

interface Goal {
  id: string;
  title: string;
  domain: LifeDomain;
  progress: number;
}

interface Task {
  id: string;
  title: string;
  priority: string;
  status: string;
}

interface MoneyItem {
  type: string;
  title: string;
  currentAmount: number;
  targetAmount: number | null;
}

interface HealthItem {
  title: string;
  currentValue: number;
  targetValue: number | null;
  unit: string | null;
}

const GEN_Z_TAGS = ["Coding", "Design", "Fitness", "Finance", "Career", "Habits"];

export function GenerationDashboard({
  generation,
  theme,
  needsSetup,
}: {
  generation: Generation;
  theme: GenerationTheme;
  needsSetup: boolean;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [money, setMoney] = useState<MoneyItem[]>([]);
  const [health, setHealth] = useState<HealthItem[]>([]);
  const [briefingMission, setBriefingMission] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/progress").then((r) => r.json()),
      fetch("/api/goals").then((r) => r.json()),
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/money").then((r) => r.json()),
      fetch("/api/health").then((r) => r.json()),
      fetch("/api/briefing").then((r) => readApiJson<{ briefing?: { mission?: string } }>(r)),
    ]).then(([progress, goalsData, tasksData, moneyData, healthData, briefingData]) => {
      setStats(progress.stats);
      setGoals((goalsData.goals ?? []).filter((g: Goal & { status: string }) => g.status === "ACTIVE"));
      setTasks(
        (tasksData.tasks ?? []).filter(
          (t: Task) => t.status === "TODO" || t.status === "IN_PROGRESS"
        )
      );
      setMoney(moneyData.items ?? []);
      setHealth(healthData.items ?? []);
      setBriefingMission(briefingData?.briefing?.mission ?? null);
    });
  }, []);

  const lifeScore = stats ? computeLifeScore(stats) : null;
  const pending = tasks.slice(0, 5);

  const domainProgress = (["LEARNING", "CAREER", "HEALTH", "MONEY"] as LifeDomain[]).map((domain) => {
    const domainGoals = goals.filter((g) => g.domain === domain);
    const avg =
      domainGoals.length > 0
        ? Math.round(domainGoals.reduce((s, g) => s + g.progress, 0) / domainGoals.length)
        : 0;
    return { domain, progress: avg };
  });

  const domainIcons: Partial<Record<LifeDomain, typeof Target>> = {
    LEARNING: BookOpen,
    CAREER: Briefcase,
    HEALTH: Heart,
    MONEY: Wallet,
  };

  if (needsSetup) {
    return (
      <div className="space-y-6">
        <GenerationSetup />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OnboardingBanner />

      {generation === "GEN_Z" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5" style={{ borderColor: `${theme.primary}33` }}>
            <div className="flex items-start gap-3">
              <WidgetIcon icon={Target} primary={theme.primary} primaryLight={theme.primaryLight} />
              <div className="flex-1">
                <CardTitle>Today&apos;s Mission</CardTitle>
                <p className="mt-2 text-sm text-forward-700">
                  {briefingMission ?? "Set a goal and break it into tasks to get your mission."}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <CardTitle>Progress Overview</CardTitle>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {domainProgress.map(({ domain, progress }) => {
                const Icon = domainIcons[domain] ?? Target;
                return (
                  <div key={domain} className="rounded-xl bg-forward-50 p-3">
                    <div className="flex items-center gap-2">
                      <WidgetIcon icon={Icon} primary={theme.primary} primaryLight={theme.primaryLight} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-forward-600">{DOMAIN_LABELS[domain]}</p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-forward-200">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${progress}%`, backgroundColor: theme.primary }}
                          />
                        </div>
                        <p className="mt-0.5 text-xs text-forward-500">{progress}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <CardTitle>Explore & Grow</CardTitle>
            <div className="mt-3 flex flex-wrap gap-2">
              {GEN_Z_TAGS.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{ backgroundColor: theme.primaryLight, color: theme.primaryDark }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </Card>

          <Card className="p-5 brand-gradient text-white">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 opacity-90" />
              <div>
                <p className="font-medium">Motivation Boost</p>
                <p className="mt-1 text-sm opacity-90">
                  {lifeScore != null
                    ? `Motive Life Score ${lifeScore} — you're building momentum. Keep going.`
                    : "Small steps compound. Check in on one habit today."}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {generation === "MILLENNIAL" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <CardTitle>Top Priorities</CardTitle>
            <ul className="mt-3 space-y-2">
              {pending.length === 0 ? (
                <li className="text-sm text-forward-500">No pending tasks — add one to get moving.</li>
              ) : (
                pending.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-lg bg-forward-50 px-3 py-2">
                    <span className="text-sm text-forward-800">{t.title}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                      style={{
                        backgroundColor:
                          t.priority === "URGENT" || t.priority === "HIGH"
                            ? theme.primaryLight
                            : "#eef0f4",
                        color:
                          t.priority === "URGENT" || t.priority === "HIGH"
                            ? theme.primaryDark
                            : "#7381a0",
                      }}
                    >
                      {t.priority === "URGENT" ? "High" : t.priority === "HIGH" ? "On track" : "Low"}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </Card>

          <Card className="p-5">
            <CardTitle>Life Overview</CardTitle>
            <div className="mt-4 space-y-4">
              {(["CAREER", "MONEY", "HEALTH"] as LifeDomain[]).map((domain) => {
                const g = goals.filter((x) => x.domain === domain);
                const pct = g.length ? Math.round(g.reduce((s, x) => s + x.progress, 0) / g.length) : 0;
                const Icon = domainIcons[domain] ?? Target;
                return (
                  <div key={domain} className="flex items-center gap-3">
                    <WidgetIcon icon={Icon} primary={theme.primary} primaryLight={theme.primaryLight} />
                    <div className="flex-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-forward-600">{DOMAIN_LABELS[domain]}</span>
                        <span style={{ color: theme.primary }}>{pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-forward-100">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: theme.primary }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {generation === "GEN_X" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <CardTitle>Focus Today</CardTitle>
            <ul className="mt-3 space-y-2">
              {pending.slice(0, 4).map((t, i) => (
                <li key={t.id} className="flex gap-3 text-sm">
                  <span className="font-medium" style={{ color: theme.primary }}>
                    {9 + i * 2}:00
                  </span>
                  <span className="text-forward-800">{t.title}</span>
                </li>
              ))}
              {pending.length === 0 && (
                <li className="text-sm text-forward-500">Your schedule is clear — pick one priority.</li>
              )}
            </ul>
          </Card>

          <Card className="p-5">
            <CardTitle>Goals This Quarter</CardTitle>
            <ul className="mt-3 space-y-3">
              {goals.slice(0, 3).map((g) => (
                <li key={g.id}>
                  <div className="flex justify-between text-sm">
                    <span className="text-forward-800">{g.title}</span>
                    <span style={{ color: theme.primary }}>{g.progress}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-forward-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${g.progress}%`, backgroundColor: theme.primary }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center gap-3">
              <WidgetIcon icon={TrendingUp} primary={theme.primary} primaryLight={theme.primaryLight} />
              <div>
                <CardTitle>Financial Overview</CardTitle>
                <p className="mt-1 text-sm text-forward-600">
                  {money.length > 0
                    ? `${money.length} money item${money.length === 1 ? "" : "s"} tracked`
                    : "Add savings, debt, or bills to see your overview."}
                </p>
                <Link href="/money">
                  <Button size="sm" className="mt-3">
                    View Money
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      )}

      {generation === "BOOMER" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <CardTitle>Today&apos;s Plan</CardTitle>
            <ul className="mt-3 space-y-2 text-sm text-forward-700">
              <li>☀️ Morning walk — 20 min</li>
              <li>📖 {briefingMission ?? "Review your goals"}</li>
              <li>🧘 Evening reflection</li>
            </ul>
          </Card>

          <Card className="p-5">
            <CardTitle>Wellness Overview</CardTitle>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {health.slice(0, 4).map((h) => (
                <div key={h.title} className="rounded-xl bg-forward-50 p-3 text-center">
                  <WidgetIcon
                    icon={Heart}
                    primary={theme.primary}
                    primaryLight={theme.primaryLight}
                  />
                  <p className="mt-2 text-xs font-medium text-forward-700">{h.title}</p>
                  <p className="text-lg font-bold" style={{ color: theme.primary }}>
                    {h.currentValue}
                    {h.unit ? ` ${h.unit}` : ""}
                  </p>
                </div>
              ))}
              {health.length === 0 && (
                <p className="col-span-2 text-sm text-forward-500">
                  Add health targets to track wellness.
                </p>
              )}
            </div>
          </Card>

          <Card
            className="p-6 lg:col-span-2"
            style={{
              background: `linear-gradient(135deg, ${theme.primaryDark} 0%, ${theme.primary} 100%)`,
            }}
          >
            <p className="text-lg font-medium text-white">
              &ldquo;Progress, not perfection — every step forward counts.&rdquo;
            </p>
            <p className="mt-2 text-sm text-white/80">Your life goals are within reach.</p>
          </Card>
        </div>
      )}

      <div id="briefing">
        <CardHeading className="mb-3">Daily clarity</CardHeading>
        <DailyExperience />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-forward-900">Today&apos;s tasks</h2>
        <TodayTasks />
      </div>
    </div>
  );
}
