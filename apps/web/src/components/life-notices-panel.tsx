"use client";

import type { LifeNotice } from "@forward/shared";
import { cn } from "@/lib/utils";

const TONE_BG: Record<LifeNotice["tone"], string> = {
  positive: "bg-emerald-500/10 border-emerald-500/20",
  warning: "bg-amber-500/10 border-amber-500/20",
  info: "bg-blue-500/10 border-blue-500/20",
  relationship: "bg-violet-500/10 border-violet-500/20",
  urgent: "bg-orange-500/10 border-orange-500/20",
};

export function LifeNoticesPanel({ notices }: { notices: LifeNotice[] }) {
  if (notices.length === 0) return null;

  return (
    <section className="rounded-2xl border border-forward-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-forward-500">
        I noticed…
      </p>
      <p className="mt-1 text-sm text-forward-500">
        Discoveries about your life — updated as MotiveLife learns you.
      </p>
      <ul className="mt-4 space-y-2">
        {notices.map((n, i) => (
          <li
            key={i}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm text-forward-800",
              TONE_BG[n.tone]
            )}
          >
            <span className="shrink-0 text-base">{n.emoji}</span>
            <span>{n.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
