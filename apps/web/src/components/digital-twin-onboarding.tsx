"use client";

import { useMemo, useState } from "react";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import {
  AGE_RANGE_OPTIONS,
  EMPLOYMENT_OPTIONS,
  FUTURE_GOAL_OPTIONS,
  LIFE_FOCUS_OPTIONS,
  ONBOARDING_PRIORITY_OPTIONS,
  RELATIONSHIP_OPTIONS,
  computeTwinCompleteness,
  emptyDigitalTwin,
  twinAccuracyForStep,
  type AgeRangeId,
  type DigitalTwinProfile,
  type EmploymentTypeId,
  type FutureGoalId,
  type LifeFocusId,
  type OnboardingPriorityId,
  type RelationshipStatusId,
  type TwinCareer,
  type TwinFinance,
  type TwinIdentity,
  type TwinLifestyle,
  type TwinPersonality,
  type TwinTimelineEvent,
  type WorkModeId,
} from "@forward/shared";
import { DIGITAL_TWIN_PRODUCT_LINE } from "@/lib/digital-twin";

type StepId =
  | "focus"
  | "identity"
  | "career"
  | "finance"
  | "futures"
  | "lifestyle"
  | "personality"
  | "timeline"
  | "connected";

const STEPS: { id: StepId; title: string; blurb: string }[] = [
  {
    id: "focus",
    title: "What are you trying to fix first?",
    blurb: "Your Twin starts with one priority — everything else compounds from here.",
  },
  {
    id: "identity",
    title: "Life Identity",
    blurb: "Taxes, healthcare, and cost of living all change by location and life stage.",
  },
  {
    id: "career",
    title: "Career Intelligence",
    blurb: "So your Twin can model trajectory, income stability, and burnout risk.",
  },
  {
    id: "finance",
    title: "Financial Intelligence",
    blurb: "A light snapshot — deepen anytime in Money.",
  },
  {
    id: "futures",
    title: "What future are you trying to create?",
    blurb: "Purpose unlocks better guidance than a blank goals list.",
  },
  {
    id: "lifestyle",
    title: "Lifestyle Intelligence",
    blurb: "Energy, habits, and health predictions start with your baseline.",
  },
  {
    id: "personality",
    title: "Personality Intelligence",
    blurb: "How you decide shapes how MotiveLife should coach you.",
  },
  {
    id: "timeline",
    title: "Life Timeline",
    blurb: "Major events explain behavioural changes over time.",
  },
  {
    id: "connected",
    title: "Connected Life",
    blurb: "Manual entry begins. Automation takes over as you connect.",
  },
];

function Accuracy({ stepIndex }: { stepIndex: number }) {
  const accuracy = twinAccuracyForStep(stepIndex + 1, STEPS.length);
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
    </div>
  );
}

function ChoiceGrid<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; emoji?: string }[];
  value: T | null | undefined;
  onChange: (id: T) => void;
}) {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
              active
                ? "border-brand-blue bg-brand-blue/5 font-medium text-forward-900 shadow-sm"
                : "border-forward-200 bg-white text-forward-700 hover:border-forward-300"
            }`}
          >
            {opt.emoji ? <span className="mr-2">{opt.emoji}</span> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function DigitalTwinOnboarding({ onComplete }: { onComplete?: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [primary, setPrimary] = useState<OnboardingPriorityId | null>(null);
  const [extra, setExtra] = useState<Set<LifeFocusId>>(new Set());
  const [identity, setIdentity] = useState<TwinIdentity>({});
  const [career, setCareer] = useState<TwinCareer>({});
  const [finance, setFinance] = useState<TwinFinance>({});
  const [futures, setFutures] = useState<Set<FutureGoalId>>(new Set());
  const [lifestyle, setLifestyle] = useState<TwinLifestyle>({});
  const [personality, setPersonality] = useState<TwinPersonality>({});
  const [timelineLabel, setTimelineLabel] = useState("");
  const [timelineYear, setTimelineYear] = useState("");
  const [timeline, setTimeline] = useState<TwinTimelineEvent[]>([]);
  const [connected, setConnected] = useState({
    wantsCalendar: true,
    wantsHealth: true,
    wantsBanking: false,
    acknowledgedAutomation: false,
  });

  const step = STEPS[stepIndex];
  const primaryOption = ONBOARDING_PRIORITY_OPTIONS.find((o) => o.id === primary);

  const draftTwin = useMemo(() => {
    const twin: DigitalTwinProfile = {
      ...emptyDigitalTwin(),
      identity,
      career,
      finance,
      futures: [...futures],
      lifestyle,
      personality,
      timeline,
      connected,
    };
    return twin;
  }, [identity, career, finance, futures, lifestyle, personality, timeline, connected]);

  const liveCompleteness = computeTwinCompleteness(draftTwin);

  function toggleExtra(id: LifeFocusId) {
    setExtra((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFuture(id: FutureGoalId) {
    setFutures((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function persist(complete: boolean) {
    if (!primaryOption) return;
    setSaving(true);
    const focuses = [...new Set([...primaryOption.focusIds, ...extra])];
    const twin: DigitalTwinProfile = {
      ...draftTwin,
      updatedAt: new Date().toISOString(),
      onboardingCompletedAt: complete ? new Date().toISOString() : undefined,
    };

    await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lifeFocuses: focuses,
        activeModules: primaryOption.modules,
        birthYear:
          identity.ageRange === "25_34"
            ? 1995
            : identity.ageRange === "35_44"
              ? 1985
              : identity.ageRange === "45_54"
                ? 1975
                : identity.ageRange === "55_64"
                  ? 1965
                  : identity.ageRange === "65_plus"
                    ? 1955
                    : identity.ageRange === "under_25"
                      ? 2003
                      : undefined,
      }),
    });

    await fetch("/api/digital-twin", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ twin, complete }),
    });

    setSaving(false);
    onComplete?.();
    window.location.reload();
  }

  function next() {
    if (stepIndex >= STEPS.length - 1) {
      void persist(true);
      return;
    }
    setStepIndex((i) => i + 1);
  }

  function skipToEnd() {
    void persist(true);
  }

  return (
    <Card className="border-brand-cyan/30 bg-gradient-to-br from-white to-forward-50">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-cyan">
        {DIGITAL_TWIN_PRODUCT_LINE}
      </p>
      <p className="mt-1 text-[11px] font-medium text-forward-400">
        Step {stepIndex + 1} of {STEPS.length} · Twin confidence ~{liveCompleteness.percent}%
      </p>
      <CardHeading className="mt-2">{step.title}</CardHeading>
      <p className="mt-2 text-sm text-forward-600">{step.blurb}</p>
      <Accuracy stepIndex={stepIndex} />

      {step.id === "focus" ? (
        <>
          <ChoiceGrid
            options={ONBOARDING_PRIORITY_OPTIONS.map((o) => ({
              id: o.id,
              label: o.label,
              emoji: o.emoji,
            }))}
            value={primary}
            onChange={setPrimary}
          />
          {primaryOption ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-forward-500">
                Optional secondary signals
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {LIFE_FOCUS_OPTIONS.filter((o) => !primaryOption.focusIds.includes(o.id))
                  .slice(0, 8)
                  .map((opt) => {
                    const active = extra.has(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleExtra(opt.id)}
                        className={`rounded-xl border px-3 py-2 text-left text-sm ${
                          active
                            ? "border-brand-blue bg-brand-blue/5 font-medium"
                            : "border-forward-200 bg-white"
                        }`}
                      >
                        {active ? "☑" : "☐"} {opt.label}
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {step.id === "identity" ? (
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-forward-500">
              Country
            </label>
            <input
              className="mt-1 w-full rounded-xl border border-forward-200 px-3 py-2 text-sm"
              value={identity.country ?? ""}
              onChange={(e) => setIdentity((s) => ({ ...s, country: e.target.value }))}
              placeholder="Canada"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-forward-500">
                Province / State
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-forward-200 px-3 py-2 text-sm"
                value={identity.region ?? ""}
                onChange={(e) => setIdentity((s) => ({ ...s, region: e.target.value }))}
                placeholder="Ontario"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-forward-500">
                City (optional)
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-forward-200 px-3 py-2 text-sm"
                value={identity.city ?? ""}
                onChange={(e) => setIdentity((s) => ({ ...s, city: e.target.value }))}
                placeholder="Toronto"
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-forward-500">Age range</p>
            <ChoiceGrid
              options={AGE_RANGE_OPTIONS}
              value={identity.ageRange}
              onChange={(id: AgeRangeId) => setIdentity((s) => ({ ...s, ageRange: id }))}
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-forward-500">
              Relationship status
            </p>
            <ChoiceGrid
              options={RELATIONSHIP_OPTIONS}
              value={identity.relationshipStatus}
              onChange={(id: RelationshipStatusId) =>
                setIdentity((s) => ({ ...s, relationshipStatus: id }))
              }
            />
          </div>
        </div>
      ) : null}

      {step.id === "career" ? (
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-forward-500">
              Occupation
            </label>
            <input
              className="mt-1 w-full rounded-xl border border-forward-200 px-3 py-2 text-sm"
              value={career.occupation ?? ""}
              onChange={(e) => setCareer((s) => ({ ...s, occupation: e.target.value }))}
              placeholder="Product manager"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-forward-500">
              Employment type
            </p>
            <ChoiceGrid
              options={EMPLOYMENT_OPTIONS}
              value={career.employmentType}
              onChange={(id: EmploymentTypeId) => setCareer((s) => ({ ...s, employmentType: id }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-forward-500">
                Typical hours / week
              </label>
              <input
                type="number"
                min={0}
                max={100}
                className="mt-1 w-full rounded-xl border border-forward-200 px-3 py-2 text-sm"
                value={career.typicalHours ?? ""}
                onChange={(e) =>
                  setCareer((s) => ({
                    ...s,
                    typicalHours: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-forward-500">
                Work mode
              </label>
              <select
                className="mt-1 w-full rounded-xl border border-forward-200 px-3 py-2 text-sm"
                value={career.workMode ?? ""}
                onChange={(e) =>
                  setCareer((s) => ({
                    ...s,
                    workMode: (e.target.value || undefined) as WorkModeId | undefined,
                  }))
                }
              >
                <option value="">Select</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="office">Office</option>
              </select>
            </div>
          </div>
        </div>
      ) : null}

      {step.id === "finance" ? (
        <div className="mt-4 space-y-3">
          {(
            [
              ["hasBudget", "I track a monthly budget"],
              ["hasEmergencyFund", "I have an emergency fund"],
              ["hasDebt", "I carry meaningful debt"],
              ["hasInvestments", "I invest regularly"],
            ] as const
          ).map(([key, label]) => {
            const val = finance[key];
            return (
              <div key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-forward-200 bg-white px-4 py-3">
                <span className="text-sm text-forward-800">{label}</span>
                <div className="flex gap-2">
                  {([true, false] as const).map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setFinance((s) => ({ ...s, [key]: v }))}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                        val === v
                          ? "bg-brand-blue text-white"
                          : "bg-forward-100 text-forward-600"
                      }`}
                    >
                      {v ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {step.id === "futures" ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {FUTURE_GOAL_OPTIONS.map((opt) => {
            const active = futures.has(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleFuture(opt.id)}
                className={`rounded-xl border px-4 py-3 text-left text-sm ${
                  active
                    ? "border-brand-blue bg-brand-blue/5 font-medium"
                    : "border-forward-200 bg-white"
                }`}
              >
                <span className="mr-2">{opt.emoji}</span>
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {step.id === "lifestyle" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-forward-500">
              Typical sleep (hours)
            </label>
            <input
              type="number"
              min={3}
              max={12}
              step={0.5}
              className="mt-1 w-full rounded-xl border border-forward-200 px-3 py-2 text-sm"
              value={lifestyle.sleepHours ?? ""}
              onChange={(e) =>
                setLifestyle((s) => ({
                  ...s,
                  sleepHours: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-forward-500">
              Stress (1–10)
            </label>
            <input
              type="number"
              min={1}
              max={10}
              className="mt-1 w-full rounded-xl border border-forward-200 px-3 py-2 text-sm"
              value={lifestyle.stressLevel ?? ""}
              onChange={(e) =>
                setLifestyle((s) => ({
                  ...s,
                  stressLevel: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-forward-500">
              Exercise days / week
            </label>
            <input
              type="number"
              min={0}
              max={7}
              className="mt-1 w-full rounded-xl border border-forward-200 px-3 py-2 text-sm"
              value={lifestyle.exerciseDaysPerWeek ?? ""}
              onChange={(e) =>
                setLifestyle((s) => ({
                  ...s,
                  exerciseDaysPerWeek: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />
          </div>
        </div>
      ) : null}

      {step.id === "personality" ? (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-forward-500">
              Risk tolerance
            </p>
            <ChoiceGrid
              options={[
                { id: "low", label: "Cautious" },
                { id: "medium", label: "Balanced" },
                { id: "high", label: "Aggressive" },
              ]}
              value={personality.riskTolerance}
              onChange={(id) => setPersonality((s) => ({ ...s, riskTolerance: id }))}
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-forward-500">
              Planning style
            </p>
            <ChoiceGrid
              options={[
                { id: "planner", label: "Planner" },
                { id: "flexible", label: "Flexible" },
                { id: "spontaneous", label: "Spontaneous" },
              ]}
              value={personality.planningStyle}
              onChange={(id) => setPersonality((s) => ({ ...s, planningStyle: id }))}
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-forward-500">
              Financial behaviour
            </p>
            <ChoiceGrid
              options={[
                { id: "saver", label: "Saver" },
                { id: "spender", label: "Spender" },
                { id: "investor", label: "Investor" },
                { id: "avoider", label: "Avoider" },
              ]}
              value={personality.financialBehaviour}
              onChange={(id) => setPersonality((s) => ({ ...s, financialBehaviour: id }))}
            />
          </div>
        </div>
      ) : null}

      {step.id === "timeline" ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 rounded-xl border border-forward-200 px-3 py-2 text-sm"
              placeholder="Major event (e.g. Promotion, Moved cities)"
              value={timelineLabel}
              onChange={(e) => setTimelineLabel(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-forward-200 px-3 py-2 text-sm sm:w-28"
              placeholder="Year"
              value={timelineYear}
              onChange={(e) => setTimelineYear(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (!timelineLabel.trim()) return;
                setTimeline((prev) => [
                  ...prev,
                  {
                    id: `e-${Date.now()}`,
                    label: timelineLabel.trim(),
                    year: timelineYear ? Number(timelineYear) : undefined,
                  },
                ]);
                setTimelineLabel("");
                setTimelineYear("");
              }}
            >
              Add
            </Button>
          </div>
          {timeline.length ? (
            <ul className="space-y-2">
              {timeline.map((e) => (
                <li
                  key={e.id}
                  className="rounded-xl border border-forward-100 bg-white px-3 py-2 text-sm text-forward-800"
                >
                  {e.year ? `${e.year} · ` : ""}
                  {e.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-forward-500">Optional — add one or more milestones, or skip.</p>
          )}
        </div>
      ) : null}

      {step.id === "connected" ? (
        <div className="mt-4 space-y-3">
          {(
            [
              ["wantsCalendar", "Connect calendar next"],
              ["wantsHealth", "Connect health / wearables"],
              ["wantsBanking", "Connect banking when available"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-3 rounded-xl border border-forward-200 bg-white px-4 py-3 text-sm"
            >
              <input
                type="checkbox"
                checked={connected[key]}
                onChange={(e) => setConnected((s) => ({ ...s, [key]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
          <label className="flex items-start gap-3 rounded-xl border border-brand-cyan/30 bg-brand-cyan/5 px-4 py-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={connected.acknowledgedAutomation}
              onChange={(e) =>
                setConnected((s) => ({ ...s, acknowledgedAutomation: e.target.checked }))
              }
            />
            <span>
              I understand MotiveLife will use what I share to improve Twin predictions — I can
              disconnect or delete data anytime.
            </span>
          </label>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button
          onClick={next}
          disabled={
            saving ||
            (step.id === "focus" && !primary) ||
            (step.id === "connected" && !connected.acknowledgedAutomation)
          }
        >
          {saving
            ? "Saving Twin…"
            : stepIndex >= STEPS.length - 1
              ? "Open Life Momentum"
              : "Continue"}
        </Button>
        {stepIndex > 0 ? (
          <Button variant="ghost" disabled={saving} onClick={() => setStepIndex((i) => i - 1)}>
            Back
          </Button>
        ) : null}
        {stepIndex > 0 && stepIndex < STEPS.length - 1 ? (
          <Button variant="ghost" disabled={saving || !primary} onClick={skipToEnd}>
            Finish later
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
