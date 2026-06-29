"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import { Input, Select } from "./input";
import {
  HEALTH_ITEM_TYPES,
  HEALTH_TYPE_LABELS,
  type HealthItemType,
} from "@forward/shared";
import { cn } from "@/lib/utils";
import { readApiJson } from "@/lib/fetch-api";

interface HealthItem {
  id: string;
  type: HealthItemType;
  title: string;
  targetValue: number | null;
  currentValue: number;
  unit: string | null;
  notes: string | null;
  goal?: { id: string; title: string } | null;
}

interface Goal {
  id: string;
  title: string;
  domain: string;
}

const UNIT_HINTS: Record<HealthItemType, string> = {
  SLEEP: "hours",
  FITNESS: "minutes",
  NUTRITION: "servings",
  WELLNESS: "sessions",
};

function progressPercent(item: HealthItem) {
  if (!item.targetValue || item.targetValue <= 0) return null;
  return Math.min(100, Math.round((item.currentValue / item.targetValue) * 100));
}

export function HealthPanel() {
  const [items, setItems] = useState<HealthItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<HealthItemType>("FITNESS");
  const [title, setTitle] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [unit, setUnit] = useState("");
  const [goalId, setGoalId] = useState("");

  async function load() {
    const [healthRes, goalsRes] = await Promise.all([fetch("/api/health"), fetch("/api/goals")]);
    const healthData = await readApiJson<{ items?: HealthItem[] }>(healthRes);
    const goalsData = await readApiJson<{ goals?: Goal[] }>(goalsRes);
    setItems(healthData?.items ?? []);
    setGoals((goalsData?.goals ?? []).filter((g) => g.domain === "HEALTH"));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!unit) setUnit(UNIT_HINTS[type]);
  }, [type, unit]);

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        title,
        targetValue: targetValue ? parseFloat(targetValue) : undefined,
        currentValue: currentValue ? parseFloat(currentValue) : undefined,
        unit: unit || undefined,
        goalId: goalId || undefined,
      }),
    });
    setTitle("");
    setTargetValue("");
    setCurrentValue("");
    setShowForm(false);
    load();
  }

  async function updateValue(id: string, delta: number) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    await fetch("/api/health", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, currentValue: Math.max(0, item.currentValue + delta) }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch("/api/health", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  if (loading) return <div className="h-48 animate-pulse rounded-xl bg-forward-100" />;

  const byType = HEALTH_ITEM_TYPES.map((t) => ({
    type: t,
    items: items.filter((i) => i.type === t),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <CardHeading>Health</CardHeading>
          <p className="mt-1 text-sm text-forward-500">
            Health Agent — sleep, fitness, nutrition, and wellness targets.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add target"}
        </Button>
      </div>

      {items.length === 0 && !showForm && (
        <Card>
          <p className="text-sm text-forward-500">
            Track a wellness target. motivelife.ai suggests action when you&apos;re falling behind.
          </p>
          <Link href="/dashboard#life-gps" className="mt-2 inline-block text-sm text-accent hover:underline">
            Create a health goal →
          </Link>
        </Card>
      )}

      {showForm && (
        <Card>
          <form onSubmit={createItem} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Type</label>
                <Select value={type} onChange={(e) => setType(e.target.value as HealthItemType)}>
                  {HEALTH_ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {HEALTH_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    type === "SLEEP"
                      ? "7 hours nightly"
                      : type === "FITNESS"
                        ? "Weekly workouts"
                        : "Daily vegetables"
                  }
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Target</label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="7"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Current</label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Unit</label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={UNIT_HINTS[type]} />
              </div>
            </div>
            {goals.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Link to health goal</label>
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
            <Button type="submit">Add</Button>
          </form>
        </Card>
      )}

      {byType.map(
        ({ type: t, items: group }) =>
          group.length > 0 && (
            <div key={t}>
              <h3 className="mb-3 text-sm font-medium text-forward-500">{HEALTH_TYPE_LABELS[t]}</h3>
              <div className="space-y-3">
                {group.map((item) => {
                  const pct = progressPercent(item);
                  return (
                    <Card key={item.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-forward-900">{item.title}</p>
                          <p className="mt-1 text-sm text-forward-600">
                            {item.currentValue}
                            {item.unit ? ` ${item.unit}` : ""}
                            {item.targetValue != null &&
                              ` of ${item.targetValue}${item.unit ? ` ${item.unit}` : ""}`}
                          </p>
                          {pct != null && (
                            <div className="mt-3">
                              <div className="flex justify-between text-xs text-forward-500">
                                <span>Progress</span>
                                <span>{pct}%</span>
                              </div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-forward-100">
                                <div
                                  className={cn("h-full rounded-full brand-gradient transition-all")}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => updateValue(item.id, 1)}>
                            +1
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => updateValue(item.id, 5)}>
                            +5
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(item.id)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )
      )}
    </div>
  );
}
