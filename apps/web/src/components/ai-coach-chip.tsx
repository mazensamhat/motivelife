"use client";

import { useState } from "react";
import Link from "next/link";
import type { AiCoachPrompt } from "@forward/shared";
import { Check, Sparkles, X } from "lucide-react";
import { CelebrationBurst } from "./celebration-burst";
import { ScoreGainFlash } from "./score-gain-flash";

export function AiCoachChip({ coach }: { coach: AiCoachPrompt }) {
  const [done, setDone] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  async function accept() {
    setLoading(true);
    try {
      const taskMatch = coach.actionHref.match(/focus=([^&]+)/);
      const res = await fetch("/api/next-action/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: coach.domain ?? "career",
          title: coach.suggestion.replace(/^Your best next move: /, "").replace(/^Want me to tailor your resume.*\?/, coach.actionLabel),
          actionHref: coach.actionHref,
          entityId: taskMatch?.[1],
        }),
      });
      if (res.ok) {
        setDone(true);
        setCelebrate(true);
        window.setTimeout(() => setCelebrate(false), 2200);
      }
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

  const minutes = coach.estimatedMinutes ?? 12;
  const reward = coach.scoreReward ?? 4;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand-purple/20 bg-gradient-to-br from-violet-50/50 via-white to-forward-50 shadow-sm">
      {celebrate ? (
        <>
          <CelebrationBurst />
          <ScoreGainFlash amount={reward} />
        </>
      ) : null}
      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-purple" />
          <p className="text-xs font-semibold uppercase tracking-widest text-forward-500">
            Coach&apos;s Advice
          </p>
        </div>
        <p className="mt-4 text-lg font-semibold leading-relaxed text-forward-900">{coach.observation}</p>
        <p className="mt-3 text-base leading-relaxed text-forward-600">{coach.suggestion}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-forward-500">
          <span>Est. {minutes} min</span>
          <span className="font-semibold text-brand-green">+{reward} Life Score</span>
        </div>
        {done ? (
          <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-green">
            <Check className="h-4 w-4" />
            Logged to your Life Timeline
          </p>
        ) : (
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={accept}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-green px-6 py-3 text-sm font-bold uppercase tracking-wide text-forward-950 hover:bg-brand-green/90 disabled:opacity-60"
            >
              {loading ? "Saving…" : coach.yesLabel ?? "Yes"}
            </button>
            <button
              type="button"
              onClick={() => setDeclined(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-forward-200 px-6 py-3 text-sm font-semibold text-forward-600 hover:bg-forward-50"
            >
              <X className="h-4 w-4" />
              Not today
            </button>
            <Link
              href={coach.actionHref}
              className="inline-flex items-center self-center text-sm font-medium text-brand-blue hover:text-brand-blue/80"
            >
              {coach.actionLabel} →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
