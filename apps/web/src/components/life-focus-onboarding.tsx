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
import { DIGITAL_TWIN_PRODUCT_LINE, twinAccuracyForStep } from "@/lib/digital-twin";

function TwinAccuracyMeter({ step, totalSteps }: { step: number; totalSteps: number }) {
  const accuracy = twinAccuracyForStep(step, totalSteps);
  return (
    <div className="mt-4 rounded-xl border border-brand-cyan/30 bg-brand-cyan/5 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-cyan">
          Prediction accuracy
        </p>
        <p className="text-sm font-bold tabular-nums text-forward-900">{accuracy}%</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-brand-cyan transition-[width] duration-500"
          style={{ width: `${accuracy}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-forward-600">
        As your Digital Twin learns more about you, predictions get sharper.
      </p>
    </div>
  );
}

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
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-cyan">
          {DIGITAL_TWIN_PRODUCT_LINE}
        </p>
        <CardHeading className="mt-2">What future are you trying to create?</CardHeading>
        <p className="mt-2 text-sm text-forward-600">
          You&apos;re not filling out a form — you&apos;re teaching your Digital Twin where life should go first.
          Pick one priority. You can deepen the Twin anytime under My Life.
        </p>
        <TwinAccuracyMeter step={1} totalSteps={3} />
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
          Continue building my Twin
        </Button>
      </Card>
    );
  }

  return (
    <Card className="border-brand-cyan/30 bg-gradient-to-br from-white to-forward-50">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-cyan">
        {DIGITAL_TWIN_PRODUCT_LINE}
      </p>
      <CardHeading className="mt-2">Anything else shaping that future?</CardHeading>
      <p className="mt-2 text-sm text-forward-600">
        Your Twin&apos;s primary focus is <strong>{primaryOption?.label}</strong>. Add secondary signals if
        you want — or skip and raise confidence later with calendar, money, and health.
      </p>
      <TwinAccuracyMeter step={2} totalSteps={3} />
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
          {saving ? "Awakening your Twin…" : "Open Life Momentum"}
        </Button>
        <Button variant="ghost" onClick={save} disabled={saving}>
          Skip extras
        </Button>
      </div>
    </Card>
  );
}
