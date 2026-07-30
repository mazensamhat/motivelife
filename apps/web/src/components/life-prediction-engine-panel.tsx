"use client";

import Link from "next/link";
import type { LifePredictItem } from "@forward/shared";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Briefcase,
  CalendarClock,
  Heart,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

const CATEGORY_META: Record<
  LifePredictItem["category"],
  { icon: typeof Sparkles; label: string }
> = {
  deadline: { icon: CalendarClock, label: "Deadline" },
  money: { icon: Wallet, label: "Money" },
  health: { icon: Heart, label: "Health" },
  career: { icon: Briefcase, label: "Career" },
  calendar: { icon: CalendarClock, label: "Calendar" },
  relationship: { icon: Users, label: "Relationships" },
  general: { icon: TrendingUp, label: "Life" },
};

function toneStyles(tone: LifePredictItem["tone"]) {
  switch (tone) {
    case "urgent":
      return "border-red-200 bg-red-50";
    case "warning":
      return "border-amber-200 bg-amber-50";
    case "positive":
      return "border-emerald-200 bg-emerald-50";
    default:
      return "border-violet-100 bg-white";
  }
}

export function LifePredictionEnginePanel({
  items,
  compact = false,
  maxItems = 5,
}: {
  items: LifePredictItem[];
  compact?: boolean;
  maxItems?: number;
}) {
  const shown = items.slice(0, maxItems);
  if (shown.length === 0) return null;

  return (
    <section
      className={cn(
        "rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/70 via-white to-brand-cyan/5 shadow-sm",
        compact ? "p-4" : "p-5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-700">
            Life Probability Engine™
          </p>
          <p className="mt-1 text-sm text-forward-600">
            The future as probabilities — with confidence — not guesses.
          </p>
        </div>
        {!compact ? (
          <span className="rounded-full border border-violet-200 bg-violet-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
            {shown.length} live
          </span>
        ) : null}
      </div>

      <ul className={cn("space-y-2", compact ? "mt-3" : "mt-4")}>
        {shown.map((item) => {
          const meta = CATEGORY_META[item.category];
          const Icon = item.tone === "urgent" || item.tone === "warning" ? AlertTriangle : meta.icon;
          const inner = (
            <div
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm transition hover:shadow-sm",
                toneStyles(item.tone)
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  item.tone === "urgent"
                    ? "text-red-600"
                    : item.tone === "warning"
                      ? "text-amber-600"
                      : item.tone === "positive"
                        ? "text-emerald-600"
                        : "text-violet-600"
                )}
              />
              <div className="min-w-0 flex-1">
                {item.subtitle ? (
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-forward-500">
                    {item.subtitle}
                  </p>
                ) : null}
                <p className="font-medium text-forward-900">{item.text}</p>
                {item.confidence != null ? (
                  <p className="mt-1 text-xs text-forward-500">{item.confidence}% confidence</p>
                ) : null}
              </div>
            </div>
          );

          return (
            <li key={item.id}>
              {item.href ? (
                <Link href={item.href} className="block">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
