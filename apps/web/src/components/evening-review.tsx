"use client";

import { useEffect, useState } from "react";
import { readApiError, readApiJson } from "@/lib/fetch-api";
import { Button } from "./button";
import { Card, CardTitle } from "./card";

interface ReviewData {
  summary: string | null;
  completedCount: number;
  completedTasks: string[];
  highlight: string | null;
  carryForward: string | null;
}

export function EveningReview() {
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
        setReview(null);
        return;
      }
      setReview(data.review);
    } catch {
      setError("Could not load review.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <div className="h-32 animate-pulse rounded-xl bg-forward-100" />;
  }

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
    <Card className="border-forward-300 bg-gradient-to-br from-forward-50 to-white">
      <CardTitle>Evening Review</CardTitle>
      <p className="mt-2 text-forward-700">{review.summary}</p>

      {review.highlight && (
        <p className="mt-4 text-sm font-medium text-forward-800">{review.highlight}</p>
      )}

      {review.completedTasks.length > 0 && (
        <ul className="mt-4 space-y-1">
          {review.completedTasks.map((t, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-forward-600">
              <span className="text-success">✓</span> {t}
            </li>
          ))}
        </ul>
      )}

      {review.carryForward && (
        <div className="mt-6 rounded-lg border border-forward-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-forward-400">
            Tomorrow starts with
          </p>
          <p className="mt-1 font-medium text-forward-900">{review.carryForward}</p>
        </div>
      )}

      <Button variant="ghost" size="sm" className="mt-4" onClick={() => load(true)}>
        Refresh review
      </Button>
    </Card>
  );
}
