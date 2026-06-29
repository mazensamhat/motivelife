"use client";

import { useEffect, useState } from "react";
import { Button } from "./button";
import { Card, CardTitle } from "./card";
import { readApiError, readApiJson } from "@/lib/fetch-api";

interface ReviewData {
  summary: string | null;
  letterParagraphs?: string[];
  tasksCompleted: number;
  wins: string[];
  focusAreas: string[];
  goalsSummary: string | null;
}

export function WeeklyReviewPanel() {
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(refresh = false) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/weekly-review${refresh ? "?refresh=true" : ""}`);
      const data = await readApiJson<{ review?: ReviewData }>(res);
      if (!res.ok || !data?.review) {
        setError(await readApiError(res));
        return;
      }
      setReview(data.review);
    } catch {
      setError("Could not load weekly review.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="h-32 animate-pulse rounded-xl bg-forward-100" />;

  if (error) {
    return (
      <Card>
        <p className="text-sm text-red-600">{error}</p>
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => load(true)}>
          Try again
        </Button>
      </Card>
    );
  }

  if (!review) return null;

  return (
    <Card className="border-brand-blue/30 bg-gradient-to-br from-forward-50 to-white">
      <CardTitle>Sunday Weekly Letter</CardTitle>
      <div className="mt-4 space-y-3 font-serif text-forward-800">
        {(review.letterParagraphs?.length
          ? review.letterParagraphs
          : review.summary?.split("\n\n").filter(Boolean) ?? []
        ).map((para, i) => (
          <p
            key={i}
            className={
              para.startsWith("—")
                ? "text-right text-sm italic text-forward-500"
                : para === "However…"
                  ? "font-medium text-forward-900"
                  : "leading-relaxed"
            }
          >
            {para}
          </p>
        ))}
      </div>
      <p className="mt-2 text-sm text-forward-500">{review.goalsSummary}</p>

      {review.wins.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wide text-forward-400">Wins</p>
          <ul className="mt-2 space-y-1">
            {review.wins.map((w, i) => (
              <li key={i} className="text-sm text-forward-800">
                ✓ {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.focusAreas.length > 0 && (
        <div className="mt-6 rounded-lg border border-forward-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-forward-400">
            Focus next week
          </p>
          <ol className="mt-2 space-y-1">
            {review.focusAreas.map((f, i) => (
              <li key={i} className="text-sm font-medium text-forward-900">
                {i + 1}. {f}
              </li>
            ))}
          </ol>
        </div>
      )}

      <Button variant="ghost" size="sm" className="mt-4" onClick={() => load(true)}>
        Refresh review
      </Button>
    </Card>
  );
}
