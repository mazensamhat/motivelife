"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Analyzing your life…",
  "Reading your calendar…",
  "Checking your progress…",
  "Preparing today's briefing…",
];

export function DashboardLoadingSequence({ userName }: { userName?: string | null }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStep((s) => (s < STEPS.length - 1 ? s + 1 : s));
    }, 700);
    return () => window.clearInterval(id);
  }, []);

  const firstName = userName?.split(" ")[0];
  const evening = new Date().getHours() >= 17;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-8 flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-brand-cyan/20" />
        <div className="relative h-16 w-16 animate-spin rounded-full border-2 border-forward-200 border-t-brand-cyan" />
      </div>
      <p className="text-sm font-medium text-brand-cyan">{STEPS[step]}</p>
      <p className="mt-6 text-2xl font-semibold text-forward-900">
        {step >= STEPS.length - 1 ? (
          <>
            {firstName ? (
              evening ? `Good evening, ${firstName}.` : `Good to see you, ${firstName}.`
            ) : (
              evening ? "Good evening." : "Almost ready."
            )}
            <span className="mt-2 block text-base font-normal text-forward-500">Today matters.</span>
          </>
        ) : (
          <span className="text-base text-forward-400">Your chief of staff is getting ready…</span>
        )}
      </p>
    </div>
  );
}
