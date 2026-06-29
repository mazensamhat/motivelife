"use client";

import { useState } from "react";
import Link from "next/link";
import type { AiCoachPrompt } from "@forward/shared";
import { ArrowRight, Check } from "lucide-react";

export function AiCoachChip({ coach }: { coach: AiCoachPrompt }) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function markDone() {
    setLoading(true);
    try {
      const taskMatch = coach.actionHref.match(/focus=([^&]+)/);
      await fetch("/api/next-action/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: "career",
          title: coach.suggestion.replace(/^Your best next move: /, ""),
          actionHref: coach.actionHref,
          entityId: taskMatch?.[1],
        }),
      });
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-forward-200 bg-gradient-to-r from-forward-950 via-forward-900 to-forward-950 text-white shadow-lg">
      <div className="px-5 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
          AI Coach
        </p>
        <p className="mt-3 text-lg font-medium">{coach.prompt}</p>
        <p className="mt-2 text-sm leading-relaxed text-forward-300">{coach.suggestion}</p>
        {done ? (
          <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-green">
            <Check className="h-4 w-4" />
            Logged to your Life Timeline
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={markDone}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-forward-950 hover:bg-brand-green/90 disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {loading ? "Saving…" : "Done"}
            </button>
            <Link
              href={coach.actionHref}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              {coach.actionLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
