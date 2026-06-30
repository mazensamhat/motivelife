"use client";

import { useState } from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Your Daily Operating System",
    body: "Today is your command center — briefing, Life Engine, and your score in one place.",
    target: "[data-tour='today-hero']",
  },
  {
    title: "Life Engine",
    body: "One small win every day builds your streak. This is how MotiveLife keeps you moving forward.",
    target: "[data-tour='life-engine']",
  },
  {
    title: "My Life Circle",
    body: "Invite friends and family, see their progress, and cheer each other on.",
    target: "[data-tour='life-circle']",
  },
  {
    title: "Settings & invites",
    body: "Add a profile photo, manage your circle, and copy your referral link to earn bonus AI.",
    target: "[data-tour='settings-link']",
  },
];

export function DashboardTour({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  function finish() {
    fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dashboardTourSeen: true }),
    }).finally(onDone);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-forward-200 bg-white p-6 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-cyan">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-forward-900">{current.title}</h2>
        <p className="mt-2 text-sm text-forward-600">{current.body}</p>
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-sm text-forward-500 hover:text-forward-700"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-6 rounded-full",
                  i === step ? "bg-brand-cyan" : "bg-forward-200"
                )}
              />
            ))}
          </div>
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep((s) => s + 1)}>
              Next
            </Button>
          ) : (
            <Button size="sm" onClick={finish}>
              Got it
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
