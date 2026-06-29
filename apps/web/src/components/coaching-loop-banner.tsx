"use client";

import type { CoachingLoopPayload } from "@forward/shared";
import { RefreshCw, Trophy } from "lucide-react";

const PHASE_LABEL: Record<string, string> = {
  assess: "Assessing",
  plan: "Planning",
  coach: "Coaching",
  measure: "Measuring",
  adapt: "Adapting",
};

export function CoachingLoopBanner({ loop }: { loop: CoachingLoopPayload }) {
  const complete = loop.challengeProgress >= 100;

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        complete
          ? "border-brand-green/30 bg-gradient-to-r from-brand-green/10 to-brand-blue/5"
          : "border-brand-purple/20 bg-gradient-to-r from-brand-purple/5 to-brand-blue/5"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
            complete ? "bg-brand-green/15 text-brand-green" : "bg-brand-purple/10 text-brand-purple"
          }`}
        >
          {complete ? (
            <span className="inline-flex items-center gap-1">
              <Trophy className="h-3 w-3" />
              Challenge complete
            </span>
          ) : (
            <>Adaptive loop · {PHASE_LABEL[loop.phase] ?? loop.phase}</>
          )}
        </span>
        {loop.adaptations.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] text-brand-blue">
            <RefreshCw className="h-3 w-3" />
            Plan adapted
          </span>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold text-forward-900">{loop.title}</p>
      {loop.blockers.length > 0 && (
        <p className="mt-1 text-xs text-forward-600">
          Focus: {loop.blockers.map((b) => b.label).join(" · ")}
        </p>
      )}
      {loop.todayAction && !complete && (
        <p className="mt-2 rounded-lg bg-white/80 px-3 py-2 text-sm text-forward-700">
          Today: {loop.todayAction}
        </p>
      )}
      {complete && (
        <p className="mt-2 text-sm font-medium text-brand-green">
          7-day challenge finished — +Life XP · saved to your timeline
        </p>
      )}
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-forward-200">
        <div
          className="h-full rounded-full bg-brand-purple"
          style={{ width: `${loop.challengeProgress}%` }}
        />
      </div>
    </div>
  );
}
