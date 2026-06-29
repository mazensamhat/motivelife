"use client";

import type { LifePredictItem } from "@forward/shared";
import { cn } from "@/lib/utils";
import { AlertTriangle, Sparkles } from "lucide-react";

export function LifePredictsPanel({ items }: { items: LifePredictItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-600" />
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-700">
          AI Predicts
        </p>
      </div>
      <p className="mt-1 text-sm text-forward-600">Intelligence that knows your patterns.</p>
      <ul className="mt-4 space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
              item.tone === "warning"
                ? "border-amber-200 bg-amber-50/80 text-forward-800"
                : "border-violet-100 bg-white/80 text-forward-800"
            )}
          >
            {item.tone === "warning" ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            ) : (
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
            )}
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
