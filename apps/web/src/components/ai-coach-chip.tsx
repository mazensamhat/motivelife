"use client";

import { useState } from "react";
import Link from "next/link";
import type { AiCoachPrompt } from "@forward/shared";
import { ArrowRight, Check, X } from "lucide-react";

export function AiCoachChip({ coach }: { coach: AiCoachPrompt }) {
  const [done, setDone] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [loading, setLoading] = useState(false);

  async function accept() {
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

  if (declined) {
    return (
      <section className="rounded-2xl border border-forward-200 bg-forward-50 px-5 py-4 text-sm text-forward-600">
        Coach&apos;s Advice — I&apos;ll remind you tomorrow. Rest counts too.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-forward-200 bg-gradient-to-r from-forward-950 via-forward-900 to-forward-950 text-white shadow-lg">
      <div className="px-5 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
          Coach&apos;s Advice
        </p>
        <p className="mt-3 text-lg font-medium leading-relaxed">{coach.prompt}</p>
        <p className="mt-2 text-sm leading-relaxed text-forward-300">{coach.suggestion}</p>
        {done ? (
          <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-green">
            <Check className="h-4 w-4" />
            Logged to your Life Timeline
          </p>
        ) : (
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={accept}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-green px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-forward-950 hover:bg-brand-green/90 disabled:opacity-60"
            >
              {loading ? "Saving…" : "Yes"}
            </button>
            <button
              type="button"
              onClick={() => setDeclined(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold text-forward-300 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
              Not today
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
