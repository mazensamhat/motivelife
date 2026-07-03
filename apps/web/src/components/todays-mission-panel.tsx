"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "./button";
import { Card } from "./card";
import type { MissionItem } from "@forward/shared";
import { cn } from "@/lib/utils";
import { CelebrationBurst } from "./celebration-burst";

function estimateMinutes(title: string) {
  if (/walk|stretch|meditat/i.test(title)) return 8;
  if (/workout|run|gym/i.test(title)) return 18;
  if (/resume|linkedin|apply/i.test(title)) return 14;
  if (/budget|spend|subscription/i.test(title)) return 8;
  return 12;
}

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
  const primary = local.find((i) => !i.done) ?? local[0];
  const [celebrate, setCelebrate] = useState(false);

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
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 2200);
    onComplete?.();
  }

  if (!primary) {
    return (
      <Card className="border-forward-200 p-5">
        <p className="text-sm font-medium text-forward-900">Today&apos;s Opportunity</p>
        <p className="mt-2 text-sm text-forward-500">
          No priority yet. Add tasks or habits and your chief of staff will pick one for you.
        </p>
        <Link href="/tasks" className="mt-4 inline-block">
          <Button size="sm">Add a task</Button>
        </Link>
      </Card>
    );
  }

  const minutes = estimateMinutes(primary.title);
  const observation =
    primary.domain === "career"
      ? "I noticed Career could use a small push today."
      : primary.domain === "health"
        ? "Your health momentum is waiting on one action."
        : primary.domain === "money"
          ? "A quick money move today keeps your plan on track."
          : "This is the highest-leverage win on your list right now.";

  return (
    <section id="mission" className="relative">
      {celebrate ? <CelebrationBurst /> : null}
      <Card className="overflow-hidden border-forward-900/10 p-0">
        <div className="bg-forward-950 px-5 py-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
            Today&apos;s Opportunity
          </p>
          <p className="mt-2 text-sm leading-relaxed text-forward-300">{observation}</p>
        </div>
        <div className="px-5 py-5">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => complete(primary.id)}
              disabled={primary.done}
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                primary.done
                  ? "border-brand-green bg-brand-green text-forward-950"
                  : "border-forward-300 hover:border-brand-blue"
              )}
              aria-label={primary.done ? "Done" : "Mark complete"}
            >
              {primary.done && "✓"}
            </button>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-lg font-semibold",
                  primary.done ? "text-forward-400 line-through" : "text-forward-900"
                )}
              >
                {primary.title}
              </p>
              <p className="mt-1 text-xs text-forward-500">{primary.domainLabel}</p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <span className="text-forward-600">
                  <span className="text-forward-400">Est. time · </span>
                  {minutes} min
                </span>
                <span className="font-semibold text-brand-green">+{missionBonus} Life Score</span>
              </div>
            </div>
          </div>
          {!primary.done ? (
            <Link href={`/tasks?focus=${primary.id}`} className="mt-5 inline-block">
              <Button size="sm">Start</Button>
            </Link>
          ) : (
            <p className="mt-4 text-sm font-semibold text-brand-green">Win logged — nice work today.</p>
          )}
        </div>
      </Card>
    </section>
  );
}
