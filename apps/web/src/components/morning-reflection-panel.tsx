"use client";

import { useEffect, useState } from "react";
import { Sun } from "lucide-react";
import type { MorningReflectionContext, VoiceCapturePayload } from "@forward/shared";
import { ReflectionHoldButton, type ReflectionCompleteResult } from "./reflection-hold-button";
import { Button } from "./button";

export function MorningReflectionPanel() {
  const [ctx, setCtx] = useState<MorningReflectionContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [capture, setCapture] = useState<VoiceCapturePayload | null>(null);
  const [coachNote, setCoachNote] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reflection/context")
      .then((r) => r.json())
      .then((data) => setCtx(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-32 animate-pulse rounded-2xl bg-forward-100" />;
  if (!ctx || ctx.morningDoneToday) return null;

  function handleComplete(data: ReflectionCompleteResult) {
    setCapture(data.capture);
    setCoachNote(data.coachNote);
    setDone(true);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-white to-forward-50 shadow-md">
      <div className="border-b border-amber-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-amber-500" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
            Morning reflection
          </p>
        </div>
        <h3 className="mt-2 text-lg font-semibold text-forward-900">{ctx.prompt}</h3>
        {ctx.yesterdayMood && (
          <p className="mt-1 text-sm text-forward-500">
            Yesterday&apos;s mood: <span className="capitalize font-medium">{ctx.yesterdayMood}</span>
          </p>
        )}
      </div>

      <div className="px-6 py-8">
        {!done ? (
          <ReflectionHoldButton source="morning_reflection" onComplete={handleComplete} />
        ) : (
          <div className="text-center">
            <p className="text-sm font-medium text-forward-800">Morning check-in captured.</p>
            {coachNote && (
              <p className="mt-2 text-sm italic text-forward-600">&ldquo;{coachNote}&rdquo;</p>
            )}
            {capture?.mood && (
              <p className="mt-2 text-xs text-forward-500">
                Today: <span className="capitalize">{capture.mood}</span>
              </p>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="mt-4"
              onClick={() => {
                setDone(false);
                setCapture(null);
              }}
            >
              Check in again
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export function isMorningHours() {
  return new Date().getHours() < 12;
}
