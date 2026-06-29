"use client";

import type { LifeContextState } from "@forward/shared";
import { LIFE_CONTEXTS } from "@forward/shared";
import { cn } from "@/lib/utils";

const CONTEXT_HINTS: Partial<Record<string, string>> = {
  interview: "Dashboard tuned for your interview — career and prep move to the top.",
  vacation: "Vacation mode — packing, budget, and travel prep surfaced for you.",
  buying_house: "House hunt mode — savings, credit, and career links highlighted.",
  unemployed: "Job search mode — applications and learning prioritized.",
  new_parent: "New parent mode — health, sleep, and family take priority.",
  moving: "Moving mode — logistics, budget, and calendar are prioritized.",
  promotion: "Promotion mode — career wins and visibility matter this week.",
  retirement: "Retirement mode — savings, health, and long-term planning surfaced.",
  starting_business: "Startup mode — career, money, and learning take the lead.",
  student: "Student mode — learning and career prep move to the top.",
};

export function LifeContextBanner({
  context,
  onDismiss,
}: {
  context: LifeContextState;
  onDismiss?: () => void;
}) {
  const preset = LIFE_CONTEXTS.find((c) => c.id === context.id);
  const emoji = preset?.emoji ?? "✨";
  const hint = CONTEXT_HINTS[context.id] ?? `Life context: ${context.label}`;

  return (
    <section
      className={cn(
        "rounded-2xl border border-brand-blue/20 bg-gradient-to-r from-brand-blue/5 to-forward-50 p-5 shadow-sm"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">
            Life Context
          </p>
          <p className="mt-1 text-lg font-semibold text-forward-900">
            {emoji} {context.label}
            {context.autoDetected && (
              <span className="ml-2 text-xs font-normal text-forward-500">Auto-detected</span>
            )}
          </p>
          <p className="mt-2 text-sm text-forward-600">{hint}</p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-xs text-forward-400 hover:text-forward-600"
          >
            Clear
          </button>
        )}
      </div>
    </section>
  );
}
