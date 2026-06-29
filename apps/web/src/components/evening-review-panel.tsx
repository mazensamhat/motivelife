"use client";

import { useEffect, useState } from "react";
import { Moon, Sparkles } from "lucide-react";
import { Button } from "./button";
import { readApiError, readApiJson } from "@/lib/fetch-api";

interface ReviewData {
  summary: string | null;
  completedCount: number;
  completedTasks: string[];
  highlight: string | null;
  carryForward: string | null;
  aiGenerated?: boolean;
}

export function EveningReviewPanel() {
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(refresh = false) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/review${refresh ? "?refresh=true" : ""}`);
      const data = await readApiJson<{ review?: ReviewData }>(res);
      if (!res.ok || !data?.review) {
        setError(await readApiError(res));
        return;
      }
      setReview(data.review);
    } catch {
      setError("Could not load your evening review.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <div className="h-36 animate-pulse rounded-2xl bg-forward-100" />;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
        {error}
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => load(true)}>
          Try again
        </Button>
      </div>
    );
  }

  if (!review) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-950 via-forward-900 to-forward-950 text-white shadow-xl">
      <div className="border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-indigo-300" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
            Evening review
          </p>
          {review.aiGenerated && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-purple/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-purple">
              <Sparkles className="h-3 w-3" />
              AI
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-forward-400">Close the loop on today before tomorrow starts.</p>
      </div>

      <div className="px-6 py-6">
        <p className="text-base leading-relaxed text-forward-100">{review.summary}</p>

        {review.highlight && (
          <p className="mt-4 text-sm font-medium text-indigo-200">{review.highlight}</p>
        )}

        {review.completedTasks.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {review.completedTasks.slice(0, 5).map((t, i) => (
              <li key={`${i}-${t.slice(0, 24)}`} className="flex items-center gap-2 text-sm text-forward-300">
                <span className="text-brand-green">✓</span> {t}
              </li>
            ))}
          </ul>
        )}

        {review.carryForward && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-forward-400">
              Tomorrow starts with
            </p>
            <p className="mt-1 font-medium text-white">{review.carryForward}</p>
          </div>
        )}

        <Button variant="ghost" size="sm" className="mt-4 text-forward-300 hover:text-white" onClick={() => load(true)}>
          Refresh review
        </Button>
      </div>
    </section>
  );
}
