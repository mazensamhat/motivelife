"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "./button";
import { Card } from "./card";
import type { MissionItem } from "@forward/shared";
import { cn } from "@/lib/utils";

export function TodaysMissionPanel({
  items,
  missionBonus,
  onComplete,
}: {
  items: MissionItem[];
  missionBonus: number;
  onComplete?: () => void;
}) {
  const [local, setLocal] = useState(items);
  const doneCount = local.filter((i) => i.done).length;
  const allDone = local.length > 0 && doneCount === local.length;

  async function complete(id: string) {
    const item = local.find((i) => i.id === id);
    if (!item || item.done) return;

    if (item.domainLabel === "Habits" && !item.isMission) {
      await fetch("/api/habits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, checkIn: true }),
      });
    } else {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "DONE" }),
      });
    }

    setLocal((prev) => prev.map((i) => (i.id === id ? { ...i, done: true } : i)));
    onComplete?.();
  }

  if (local.length === 0) {
    return (
      <Card className="border-forward-200 p-5">
        <p className="text-sm font-medium text-forward-900">Today&apos;s Mission</p>
        <p className="mt-2 text-sm text-forward-500">
          No mission yet. Add tasks or habits and MotiveLife will build your day.
        </p>
        <Link href="/tasks" className="mt-4 inline-block">
          <Button size="sm">Add to mission</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-forward-900/10 p-0">
      <div className="bg-forward-950 px-5 py-4 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
          Today&apos;s Mission
        </p>
        <p className="mt-1 text-sm text-forward-300">
          {doneCount}/{local.length} complete
          {allDone ? " — mission accomplished!" : ""}
        </p>
      </div>
      <ul className="divide-y divide-forward-100">
        {local.map((item) => (
          <li key={item.id} className="flex items-center gap-4 px-5 py-4">
            <button
              type="button"
              onClick={() => complete(item.id)}
              disabled={item.done}
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                item.done
                  ? "border-brand-green bg-brand-green text-forward-950"
                  : "border-forward-300 hover:border-brand-blue"
              )}
              aria-label={item.done ? "Done" : "Mark complete"}
            >
              {item.done && "✓"}
            </button>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  item.done ? "text-forward-400 line-through" : "text-forward-900"
                )}
              >
                {item.title}
              </p>
              <p className="text-xs text-forward-500">{item.domainLabel}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t border-forward-100 bg-forward-50 px-5 py-3 text-center">
        <p className="text-xs font-medium text-forward-600">
          Complete mission{" "}
          <span className="font-bold text-brand-green">+{missionBonus} Motive Life Score</span>
        </p>
      </div>
    </Card>
  );
}
