"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import { Input, Select } from "./input";
import {
  LEARNING_ITEM_TYPES,
  LEARNING_TYPE_LABELS,
  type LearningItemType,
} from "@forward/shared";
import { cn } from "@/lib/utils";
import { readApiJson } from "@/lib/fetch-api";

interface LearningItem {
  id: string;
  type: LearningItemType;
  title: string;
  progress: number;
  targetDate: string | null;
  url: string | null;
  notes: string | null;
  goal?: { id: string; title: string } | null;
}

interface Goal {
  id: string;
  title: string;
  domain: string;
}

export function LearningPanel() {
  const [items, setItems] = useState<LearningItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<LearningItemType>("COURSE");
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState("0");
  const [targetDate, setTargetDate] = useState("");
  const [url, setUrl] = useState("");
  const [goalId, setGoalId] = useState("");

  async function load() {
    const [learningRes, goalsRes] = await Promise.all([
      fetch("/api/learning"),
      fetch("/api/goals"),
    ]);
    const learningData = await readApiJson<{ items?: LearningItem[] }>(learningRes);
    const goalsData = await readApiJson<{ goals?: Goal[] }>(goalsRes);
    setItems(learningData?.items ?? []);
    setGoals((goalsData?.goals ?? []).filter((g) => g.domain === "LEARNING"));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/learning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        title,
        progress: parseInt(progress, 10) || 0,
        targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
        url: url || undefined,
        goalId: goalId || undefined,
      }),
    });
    setTitle("");
    setProgress("0");
    setTargetDate("");
    setUrl("");
    setGoalId("");
    setShowForm(false);
    load();
  }

  async function updateProgress(id: string, next: number) {
    await fetch("/api/learning", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, progress: Math.min(100, Math.max(0, next)) }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch("/api/learning", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  if (loading) return <div className="h-48 animate-pulse rounded-xl bg-forward-100" />;

  const byType = LEARNING_ITEM_TYPES.map((t) => ({
    type: t,
    items: items.filter((i) => i.type === t),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <CardHeading>Learning</CardHeading>
          <p className="mt-1 text-sm text-forward-500">
            Learning Agent — courses, books, and skills on your Progress Graph.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add item"}
        </Button>
      </div>

      {items.length === 0 && !showForm && (
        <Card>
          <p className="text-sm text-forward-500">
            Track what you&apos;re learning. motivelife.ai nudges you when deadlines approach or progress stalls.
          </p>
          <Link href="/dashboard#life-gps" className="mt-2 inline-block text-sm text-accent hover:underline">
            Create a learning goal →
          </Link>
        </Card>
      )}

      {showForm && (
        <Card>
          <form onSubmit={createItem} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Type</label>
                <Select value={type} onChange={(e) => setType(e.target.value as LearningItemType)}>
                  {LEARNING_ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {LEARNING_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="React course, Atomic Habits..."
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Progress (%)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={(e) => setProgress(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Target date</label>
                <Input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Link (optional)</label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            {goals.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Link to learning goal</label>
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
              <h3 className="mb-3 text-sm font-medium text-forward-500">{LEARNING_TYPE_LABELS[t]}</h3>
              <div className="space-y-3">
                {group.map((item) => (
                  <Card key={item.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-forward-900">{item.title}</p>
                        {item.targetDate && (
                          <p className="mt-1 text-xs text-forward-500">
                            Target:{" "}
                            {new Date(item.targetDate).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        )}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block text-xs text-accent hover:underline"
                          >
                            Open resource
                          </a>
                        )}
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-forward-500">
                            <span>Progress</span>
                            <span>{item.progress}%</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-forward-100">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                item.progress === 100 ? "bg-success" : "brand-gradient"
                              )}
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => updateProgress(item.id, item.progress + 10)}>
                          +10%
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => updateProgress(item.id, item.progress + 25)}>
                          +25%
                        </Button>
                        {item.progress < 100 && (
                          <Button size="sm" onClick={() => updateProgress(item.id, 100)}>
                            Done
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => remove(item.id)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )
      )}
    </div>
  );
}
