"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Sparkles, X } from "lucide-react";
import type { CoachSetupReminder } from "@forward/shared";
import { Button } from "./button";
import { cn } from "@/lib/utils";

const DISMISS_STORAGE_KEY = "motivelife-coach-setup-dismiss";

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify([...ids]));
}

function impactLabel(impact: CoachSetupReminder["coachImpact"]) {
  return impact === "high" ? "High impact for your coach" : "Helps personalize coaching";
}

export function CoachSetupRemindersPanel({
  reminders,
  compact = false,
  maxVisible = 3,
  className,
}: {
  reminders: CoachSetupReminder[];
  compact?: boolean;
  maxVisible?: number;
  className?: string;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setDismissed(loadDismissed());
  }, []);

  const visible = useMemo(
    () => reminders.filter((r) => !dismissed.has(r.id)),
    [reminders, dismissed]
  );

  if (visible.length === 0) return null;

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }

  const shown = expanded ? visible : visible.slice(0, maxVisible);

  if (compact) {
    const top = visible[0];
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-cyan/25 bg-brand-cyan/5 px-4 py-3",
          className
        )}
      >
        <div className="flex min-w-0 items-start gap-2">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-brand-cyan" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-forward-900">{top.title}</p>
            <p className="text-xs text-forward-600">
              {visible.length > 1
                ? `${visible.length} setup steps help your coach — start with this one.`
                : top.description}
            </p>
          </div>
        </div>
        <Link href={top.href}>
          <Button size="sm">Set up</Button>
        </Link>
      </div>
    );
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-brand-cyan/25 bg-gradient-to-br from-brand-cyan/5 via-white to-forward-50 shadow-sm",
        className
      )}
    >
      <div className="border-b border-brand-cyan/15 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-cyan">
              Help your coach know you
            </p>
            <h2 className="mt-1 text-lg font-semibold text-forward-900">
              {visible.length} setup step{visible.length === 1 ? "" : "s"} remaining
            </h2>
            <p className="mt-1 text-sm text-forward-600">
              Your chief of staff coaches better with finances, calendar, beliefs, and goals in
              place — not generic advice.
            </p>
          </div>
          <Sparkles size={22} className="shrink-0 text-brand-cyan" />
        </div>
      </div>

      <ul className="divide-y divide-forward-100">
        {shown.map((item) => (
          <li key={item.id} className="flex items-start gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-forward-900">{item.title}</p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    item.coachImpact === "high"
                      ? "bg-brand-green/15 text-brand-green"
                      : "bg-forward-100 text-forward-600"
                  )}
                >
                  {impactLabel(item.coachImpact)}
                </span>
                {item.minutes ? (
                  <span className="text-[10px] text-forward-400">~{item.minutes} min</span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-forward-600">{item.description}</p>
              <Link
                href={item.href}
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline"
              >
                Complete setup
                <ChevronRight size={14} />
              </Link>
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="shrink-0 rounded-lg p-1 text-forward-400 hover:bg-forward-100 hover:text-forward-600"
              aria-label={`Dismiss ${item.title}`}
            >
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>

      {!expanded && visible.length > maxVisible ? (
        <div className="border-t border-forward-100 px-5 py-3">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-sm font-medium text-brand-blue hover:underline"
          >
            Show {visible.length - maxVisible} more
          </button>
        </div>
      ) : expanded && visible.length > maxVisible ? (
        <div className="border-t border-forward-100 px-5 py-3">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-sm font-medium text-brand-blue hover:underline"
          >
            Show fewer
          </button>
        </div>
      ) : null}
    </section>
  );
}
