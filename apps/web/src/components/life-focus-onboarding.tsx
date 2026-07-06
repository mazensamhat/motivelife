"use client";

import { useState } from "react";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import {
  LIFE_FOCUS_OPTIONS,
  ONBOARDING_PRIORITY_OPTIONS,
  type LifeFocusId,
  type OnboardingPriorityId,
} from "@forward/shared";

export function LifeFocusOnboarding({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [primary, setPrimary] = useState<OnboardingPriorityId | null>(null);
  const [extra, setExtra] = useState<Set<LifeFocusId>>(new Set());
  const [saving, setSaving] = useState(false);

  const primaryOption = ONBOARDING_PRIORITY_OPTIONS.find((o) => o.id === primary);

  function toggleExtra(id: LifeFocusId) {
    setExtra((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!primaryOption) return;
    setSaving(true);
    const focuses = [...new Set([...primaryOption.focusIds, ...extra])];
    await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lifeFocuses: focuses,
        activeModules: primaryOption.modules,
      }),
    });
    setSaving(false);
    onComplete?.();
    window.location.reload();
  }

  if (step === 1) {
    return (
      <Card className="border-brand-cyan/30 bg-gradient-to-br from-white to-forward-50">
        <CardHeading>What are you trying to fix first?</CardHeading>
        <p className="mt-2 text-sm text-forward-600">
          MotiveLife starts simple — one priority today. You can add more areas anytime under My Life.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {ONBOARDING_PRIORITY_OPTIONS.map((opt) => {
            const active = primary === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPrimary(opt.id)}
                className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                  active
                    ? "border-brand-blue bg-brand-blue/5 font-medium text-forward-900 shadow-sm"
                    : "border-forward-200 bg-white text-forward-700 hover:border-forward-300"
                }`}
              >
                <span className="mr-2">{opt.emoji}</span>
                {opt.label}
              </button>
            );
          })}
        </div>
        <Button className="mt-6" disabled={!primary} onClick={() => setStep(2)}>
          Continue
        </Button>
      </Card>
    );
  }

  return (
    <Card className="border-brand-cyan/30 bg-gradient-to-br from-white to-forward-50">
      <CardHeading>Anything else? (optional)</CardHeading>
      <p className="mt-2 text-sm text-forward-600">
        Your main focus is <strong>{primaryOption?.label}</strong>. Add secondary goals if you want — or skip.
      </p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {LIFE_FOCUS_OPTIONS.filter((opt) => !primaryOption?.focusIds.includes(opt.id)).map((opt) => {
          const active = extra.has(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggleExtra(opt.id)}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                active
                  ? "border-brand-blue bg-brand-blue/5 font-medium text-forward-900 shadow-sm"
                  : "border-forward-200 bg-white text-forward-700 hover:border-forward-300"
              }`}
            >
              <span className="mr-2">{active ? "☑" : "☐"}</span>
              {opt.label}
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? "Building your day…" : "Start my Today view"}
        </Button>
        <Button variant="ghost" onClick={save} disabled={saving}>
          Skip extras
        </Button>
      </div>
    </Card>
  );
}
