"use client";

import { useEffect, useState } from "react";
import type { CoachingLoopPayload } from "@forward/shared";
import { CoachingLoopBanner } from "./coaching-loop-banner";
import { Button } from "./button";

export function CareerCoachingPanel() {
  const [loops, setLoops] = useState<CoachingLoopPayload[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/coaching-loops");
    const data = await res.json();
    setLoops((data.loops ?? []).filter((l: CoachingLoopPayload) => l.module === "career"));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function completeDay(loopId: string, day: number) {
    await fetch(`/api/coaching-loops/${loopId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day }),
    });
    load();
  }

  if (loading || loops.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
          Adaptive Coaching Loop
        </p>
        <h2 className="mt-1 text-lg font-semibold text-forward-900">
          Assess → Plan → Coach → Measure → Adapt
        </h2>
        <p className="mt-1 text-sm text-forward-500">
          Your prep plan shifts when we detect what&apos;s actually blocking you — confidence, STAR stories, or
          communication.
        </p>
      </div>

      {loops.map((loop) => (
        <div key={loop.id} className="space-y-3">
          <CoachingLoopBanner loop={loop} />
          <div className="rounded-xl border border-forward-200 bg-white p-4">
            <p className="text-xs font-semibold text-forward-500">7-day adaptive prep</p>
            <p className="mt-2 text-sm text-forward-700">
              {loop.todayAction ?? "Complete a prep checklist item above to unlock the next adaptation."}
            </p>
            {loop.challengeProgress < 100 && (
              <Button
                size="sm"
                className="mt-3"
                onClick={() => {
                  const nextDay = Math.max(1, Math.round((loop.challengeProgress / 100) * 7) + 1);
                  completeDay(loop.id, Math.min(nextDay, 7));
                }}
              >
                Mark today&apos;s coaching done
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
