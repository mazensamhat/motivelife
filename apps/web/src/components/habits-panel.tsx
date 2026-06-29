"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import { Input, Select } from "./input";
import { HABIT_FREQUENCIES, HABIT_FREQUENCY_LABELS, type HabitFrequency } from "@forward/shared";
import { cn } from "@/lib/utils";
import { readApiJson } from "@/lib/fetch-api";

interface Habit {
  id: string;
  title: string;
  frequency: HabitFrequency;
  streak: number;
  bestStreak: number;
  lastDoneAt: string | null;
  active: boolean;
  doneToday: boolean;
  goal?: { id: string; title: string } | null;
}

interface Goal {
  id: string;
  title: string;
  domain: string;
}

export function HabitsPanel() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<HabitFrequency>("DAILY");
  const [goalId, setGoalId] = useState("");

  async function load() {
    const [habitsRes, goalsRes] = await Promise.all([fetch("/api/habits"), fetch("/api/goals")]);
    const habitsData = await readApiJson<{ habits?: Habit[] }>(habitsRes);
    const goalsData = await readApiJson<{ goals?: Goal[] }>(goalsRes);
    setHabits(habitsData?.habits ?? []);
    setGoals((goalsData?.goals ?? []).filter((g) => g.domain === "HABITS"));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createHabit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, frequency, goalId: goalId || undefined }),
    });
    setTitle("");
    setGoalId("");
    setShowForm(false);
    load();
  }

  async function checkIn(id: string) {
    await fetch("/api/habits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, checkIn: true }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch("/api/habits", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  if (loading) return <div className="h-48 animate-pulse rounded-xl bg-forward-100" />;

  const active = habits.filter((h) => h.active);
  const doneCount = active.filter((h) => h.doneToday).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <CardHeading>Habits</CardHeading>
          <p className="mt-1 text-sm text-forward-500">
            Build routines with streaks — gentle reminders, no guilt.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add habit"}
        </Button>
      </div>

      {active.length > 0 && (
        <Card className="p-4">
          <p className="text-sm text-forward-600">
            Today: <span className="font-semibold text-forward-900">{doneCount}</span> of{" "}
            <span className="font-semibold text-forward-900">{active.length}</span> habits checked in
          </p>
        </Card>
      )}

      {habits.length === 0 && !showForm && (
        <Card>
          <p className="text-sm text-forward-500">
            Start one small habit. motivelife.ai tracks your streak and nudges you when you miss a day.
          </p>
          <Link href="/dashboard#life-gps" className="mt-2 inline-block text-sm text-accent hover:underline">
            Create a habits goal →
          </Link>
        </Card>
      )}

      {showForm && (
        <Card>
          <form onSubmit={createHabit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Habit</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Morning walk, read 10 pages..."
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Frequency</label>
                <Select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as HabitFrequency)}
                >
                  {HABIT_FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {HABIT_FREQUENCY_LABELS[f]}
                    </option>
                  ))}
                </Select>
              </div>
              {goals.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Link to goal</label>
                  <Select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                    <option value="">None</option>
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
            <Button type="submit">Add habit</Button>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {active.map((habit) => (
          <Card key={habit.id} className={cn("p-4", habit.doneToday && "border-green-200 bg-green-50/30")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-forward-900">{habit.title}</p>
                  <span className="rounded-full bg-forward-100 px-2 py-0.5 text-xs text-forward-600">
                    {HABIT_FREQUENCY_LABELS[habit.frequency]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-forward-600">
                  {habit.streak > 0 ? (
                    <>
                      <span className="font-semibold brand-gradient-text">{habit.streak}-day streak</span>
                      {habit.bestStreak > habit.streak && (
                        <span className="text-forward-400"> · best {habit.bestStreak}</span>
                      )}
                    </>
                  ) : (
                    "Start your streak today"
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={habit.doneToday ? "secondary" : "primary"}
                  disabled={habit.doneToday}
                  onClick={() => checkIn(habit.id)}
                >
                  {habit.doneToday ? "Done today" : "Check in"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(habit.id)}>
                  Remove
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
