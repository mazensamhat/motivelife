"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "./button";
import { Card } from "./card";
import { Input, Select, Textarea } from "./input";
import { DOMAIN_LABELS, LIFE_DOMAINS, type LifeDomain } from "@forward/shared";
import { cn } from "@/lib/utils";
import { GoalCoachingStrip } from "./goal-coaching-strip";
import { PremiumGate } from "./premium-gate";
import type { CoachingLoopPayload } from "@forward/shared";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  domain: LifeDomain;
  status: string;
  progress: number;
  _count?: { tasks: number };
}

export interface LifeGpsGoalsProps {
  linkedGoalId?: string | null;
  destination?: string | null;
  onChange?: () => void;
  compact?: boolean;
}

export function LifeGpsGoals({
  linkedGoalId,
  destination,
  onChange,
  compact = false,
}: LifeGpsGoalsProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [decomposingId, setDecomposingId] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState<LifeDomain>("CAREER");
  const [goalLoops, setGoalLoops] = useState<Map<string, CoachingLoopPayload>>(new Map());

  async function load() {
    const [goalsRes, loopsRes] = await Promise.all([
      fetch("/api/goals"),
      fetch("/api/coaching-loops"),
    ]);
    const data = await goalsRes.json();
    const loopsData = await loopsRes.json();
    setGoals(data.goals ?? []);

    const map = new Map<string, CoachingLoopPayload>();
    for (const loop of (loopsData.loops ?? []) as CoachingLoopPayload[]) {
      if (loop.goalId) map.set(loop.goalId, loop);
    }
    setGoalLoops(map);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function decomposeGoal(goalId: string) {
    setDecomposingId(goalId);
    try {
      const res = await fetch("/api/goals/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId }),
      });
      if (res.ok) {
        await load();
        onChange?.();
      }
    } finally {
      setDecomposingId(null);
    }
  }

  async function setAsDestination(goal: Goal) {
    setLinkingId(goal.id);
    try {
      await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lifeDestination: goal.title,
          lifeDestinationGoalId: goal.id,
        }),
      });
      onChange?.();
    } finally {
      setLinkingId(null);
    }
  }

  async function createGoal(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, domain }),
    });
    if (res.ok) {
      const data = await res.json();
      setTitle("");
      setDescription("");
      setShowForm(false);
      await load();
      if (data.goal?.id) {
        if (!destination) await setAsDestination(data.goal as Goal);
        await decomposeGoal(data.goal.id);
      } else {
        onChange?.();
      }
    }
  }

  async function markComplete(goalId: string) {
    await fetch("/api/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: goalId, status: "COMPLETED" }),
    });
    await load();
    onChange?.();
  }

  if (loading) {
    return <div className={cn("animate-pulse rounded-xl bg-forward-100", compact ? "h-24" : "h-48")} />;
  }

  return (
    <div className={cn("space-y-4", compact && "border-t border-forward-200/80 pt-4")}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-forward-900">Your goals</p>
          <p className="text-xs text-forward-500">Linked to your Life Graph and Today&apos;s missions</p>
        </div>
        <Button size="sm" variant={compact ? "secondary" : "primary"} onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add goal"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={createGoal} className="space-y-3 rounded-xl border border-forward-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-forward-700">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={destination ?? "Save $3,000, Fix my resume…"}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-forward-700">Domain</label>
            <Select value={domain} onChange={(e) => setDomain(e.target.value as LifeDomain)}>
              {LIFE_DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {DOMAIN_LABELS[d]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-forward-700">Why it matters (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="This connects to where I'm headed…"
            />
          </div>
          <Button type="submit" size="sm">
            Create & break into tasks
          </Button>
        </form>
      )}

      {goals.length === 0 ? (
        <p className="rounded-xl border border-dashed border-forward-200 bg-forward-50/50 px-4 py-3 text-sm text-forward-600">
          Add a goal to connect your destination to daily actions.
        </p>
      ) : (
        <ul className={cn("space-y-3", !compact && "sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0")}>
          {goals.map((goal) => {
            const taskCount = goal._count?.tasks ?? 0;
            const needsTasks = goal.status === "ACTIVE" && taskCount === 0;
            const isDestination = linkedGoalId === goal.id;

            return (
              <li
                key={goal.id}
                className={cn(
                  "rounded-xl border bg-white p-4",
                  isDestination ? "border-brand-blue/40 ring-1 ring-brand-blue/20" : "border-forward-200"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium brand-gradient-text">{DOMAIN_LABELS[goal.domain]}</p>
                      {isDestination && (
                        <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-blue">
                          Life GPS
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-medium text-forward-900">{goal.title}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-forward-100 px-2 py-0.5 text-xs text-forward-600">
                    {goal.progress}%
                  </span>
                </div>

                {needsTasks && (
                  <p className="mt-2 text-xs text-forward-600">
                    Break into tasks to wire this into Today.
                  </p>
                )}

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-forward-100">
                  <div
                    className="h-full rounded-full brand-gradient transition-all"
                    style={{ width: `${goal.progress}%` }}
                  />
                </div>

                <p className="mt-2 text-xs text-forward-400">{taskCount} tasks linked</p>

                <PremiumGate feature="Goal coaching loops">
                  <GoalCoachingStrip
                    goalId={goal.id}
                    loop={goalLoops.get(goal.id)}
                    onUpdate={load}
                  />
                </PremiumGate>

                <div className="mt-3 flex flex-wrap gap-2">
                  {needsTasks && (
                    <Button
                      size="sm"
                      disabled={decomposingId === goal.id}
                      onClick={() => decomposeGoal(goal.id)}
                    >
                      {decomposingId === goal.id ? "Building…" : "Break into tasks"}
                    </Button>
                  )}
                  {!isDestination && goal.status === "ACTIVE" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={linkingId === goal.id}
                      onClick={() => setAsDestination(goal)}
                    >
                      {linkingId === goal.id ? "Linking…" : "Track on GPS"}
                    </Button>
                  )}
                  {goal.status === "ACTIVE" && taskCount > 0 && (
                    <Link
                      href="/dashboard#mission"
                      className="inline-flex items-center text-xs font-medium text-brand-blue hover:underline"
                    >
                      Today&apos;s missions →
                    </Link>
                  )}
                  {goal.status === "ACTIVE" && goal.progress >= 80 && (
                    <Button size="sm" variant="ghost" onClick={() => markComplete(goal.id)}>
                      Complete
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
