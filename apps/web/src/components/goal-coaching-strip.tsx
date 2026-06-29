"use client";

import { useState } from "react";
import type { CoachingLoopPayload } from "@forward/shared";
import { Button } from "./button";

export function GoalCoachingStrip({
  loop,
  onUpdate,
}: {
  goalId: string;
  loop: CoachingLoopPayload | undefined;
  onUpdate?: () => void;
}) {
  const [completing, setCompleting] = useState(false);

  if (!loop) return null;

  async function markDone() {
    setCompleting(true);
    try {
      await fetch(`/api/coaching-loops/${loop!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: loop!.nextDay }),
      });
      onUpdate?.();
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-brand-purple/20 bg-brand-purple/5 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-purple">
        Adaptive loop · day {loop.nextDay} of 7
      </p>
      {loop.todayAction && <p className="mt-1 text-xs text-forward-700">{loop.todayAction}</p>}
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-forward-200">
          <div
            className="h-full rounded-full bg-brand-purple"
            style={{ width: `${loop.challengeProgress}%` }}
          />
        </div>
        <Button size="sm" variant="ghost" disabled={completing} onClick={markDone}>
          {completing ? "…" : "Done"}
        </Button>
      </div>
    </div>
  );
}
