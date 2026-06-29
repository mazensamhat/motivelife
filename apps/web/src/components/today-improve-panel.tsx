"use client";

import Link from "next/link";
import { useState } from "react";
import type { TodayImprovePayload } from "@forward/shared";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { Rocket } from "lucide-react";

export function TodayImprovePanel({
  improve,
  onComplete,
}: {
  improve: TodayImprovePayload;
  onComplete?: () => void;
}) {
  const [completing, setCompleting] = useState(false);
  const [done, setDone] = useState(false);
  const [challengeComplete, setChallengeComplete] = useState(false);

  async function markDone() {
    setCompleting(true);
    try {
      const res = await fetch(`/api/coaching-loops/${improve.loopId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: improve.nextDay }),
      });
      const data = (await res.json()) as { challengeComplete?: boolean };
      setDone(true);
      if (data.challengeComplete) setChallengeComplete(true);
      onComplete?.();
    } finally {
      setCompleting(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-green/30 bg-gradient-to-br from-brand-green/5 via-white to-brand-blue/5 shadow-sm">
      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-green/15 text-brand-green">
            <Rocket className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">Improve today</p>
            <h2 className="mt-1 text-lg font-semibold text-forward-900">
              {improve.goalTitle ? `Toward: ${improve.goalTitle}` : improve.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-forward-700">{improve.todayAction}</p>
            {improve.beliefHook && (
              <p className="mt-2 text-xs italic text-brand-purple/90">{improve.beliefHook}</p>
            )}
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-forward-200">
              <div
                className="h-full rounded-full bg-brand-green transition-all"
                style={{ width: `${improve.challengeProgress}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-forward-400">
              {improve.challengeProgress}% of your 7-day challenge · adapts from outcomes
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {!done ? (
            <Button size="sm" disabled={completing} onClick={markDone}>
              {completing ? "Saving…" : "Mark done"}
            </Button>
          ) : challengeComplete ? (
            <span className="text-sm font-medium text-brand-green">7-day challenge complete — major Life XP boost</span>
          ) : (
            <span className="text-sm font-medium text-brand-green">+ Life XP · keep going tomorrow</span>
          )}
          <Link
            href={improve.moduleHref}
            className={cn(
              "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium",
              "text-forward-600 hover:bg-forward-100 hover:text-forward-900"
            )}
          >
            Open {improve.module} module →
          </Link>
        </div>
      </div>
    </section>
  );
}
