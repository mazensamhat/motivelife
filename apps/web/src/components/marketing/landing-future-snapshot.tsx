"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonClassName } from "@/components/button";

type Answers = {
  region: string;
  age: string;
  income: string;
  housing: "rent" | "own" | "";
  goal: string;
};

const GOALS = [
  "Retire earlier",
  "Buy a home",
  "Grow wealth",
  "Change careers",
  "Improve health",
  "Pay off debt",
];

function buildSnapshot(a: Answers) {
  const incomeNum = Number(String(a.income).replace(/[^0-9.]/g, "")) || 0;
  const ageNum = Number(a.age) || 35;
  const housingPressure = a.housing === "rent" ? "elevated" : "moderate";
  const retireAge = Math.min(68, Math.max(58, Math.round(64 - (incomeNum > 120000 ? 2 : 0) + (ageNum > 45 ? 1 : 0))));
  const investBump =
    incomeNum >= 100000 ? 250 : incomeNum >= 60000 ? 200 : 150;
  const savingsStrength =
    incomeNum >= 90000 && a.housing === "own"
      ? "stronger than many people in your demographic"
      : "building — with room to strengthen versus peers";

  return {
    retireAge,
    housingPressure,
    investBump,
    savingsStrength,
    confidence: 42,
    regionLabel: a.region.trim() || "your region",
    goal: a.goal || "your goal",
  };
}

/** Interactive “holy moment” — 5 questions → Future Snapshot in under a minute */
export function LandingFutureSnapshot() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    region: "",
    age: "",
    income: "",
    housing: "",
    goal: "",
  });

  const snapshot = useMemo(() => (step >= 5 ? buildSnapshot(answers) : null), [step, answers]);

  const questions = [
    {
      key: "region" as const,
      label: "What province or state do you live in?",
      input: (
        <input
          className="mt-4 w-full rounded-xl border border-forward-200 bg-white px-4 py-3 text-base text-forward-900 outline-none ring-brand-cyan/40 focus:ring-2"
          placeholder="e.g. Ontario"
          value={answers.region}
          onChange={(e) => setAnswers((s) => ({ ...s, region: e.target.value }))}
          autoFocus
        />
      ),
      canContinue: answers.region.trim().length > 1,
    },
    {
      key: "age" as const,
      label: "How old are you?",
      input: (
        <input
          type="number"
          min={18}
          max={90}
          className="mt-4 w-full rounded-xl border border-forward-200 bg-white px-4 py-3 text-base text-forward-900 outline-none ring-brand-cyan/40 focus:ring-2"
          placeholder="e.g. 34"
          value={answers.age}
          onChange={(e) => setAnswers((s) => ({ ...s, age: e.target.value }))}
        />
      ),
      canContinue: Number(answers.age) >= 18 && Number(answers.age) <= 90,
    },
    {
      key: "income" as const,
      label: "What's your annual income?",
      input: (
        <input
          className="mt-4 w-full rounded-xl border border-forward-200 bg-white px-4 py-3 text-base text-forward-900 outline-none ring-brand-cyan/40 focus:ring-2"
          placeholder="e.g. 95000"
          value={answers.income}
          onChange={(e) => setAnswers((s) => ({ ...s, income: e.target.value }))}
        />
      ),
      canContinue: Number(String(answers.income).replace(/[^0-9.]/g, "")) > 0,
    },
    {
      key: "housing" as const,
      label: "Do you rent or own?",
      input: (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {(["rent", "own"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAnswers((s) => ({ ...s, housing: v }))}
              className={`rounded-xl border px-4 py-4 text-sm font-semibold capitalize transition ${
                answers.housing === v
                  ? "border-brand-cyan bg-brand-cyan/10 text-forward-900"
                  : "border-forward-200 bg-white text-forward-700 hover:border-forward-300"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      ),
      canContinue: answers.housing === "rent" || answers.housing === "own",
    },
    {
      key: "goal" as const,
      label: "What's your biggest goal?",
      input: (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {GOALS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setAnswers((s) => ({ ...s, goal: g }))}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                answers.goal === g
                  ? "border-brand-cyan bg-brand-cyan/10 text-forward-900"
                  : "border-forward-200 bg-white text-forward-700 hover:border-forward-300"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      ),
      canContinue: Boolean(answers.goal),
    },
  ];

  const current = questions[step];

  return (
    <section id="future-snapshot" className="scroll-mt-24 border-y border-forward-200 bg-forward-50 py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-brand-blue">
          Try it in under a minute
        </p>
        <h2 className="mt-3 text-center font-display text-3xl font-semibold tracking-tight text-forward-900 sm:text-4xl">
          Get a sample Future Snapshot
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-base text-forward-600">
          Five questions. Seconds later, a preview of what it feels like when an AI begins
          understanding your future.
        </p>

        <div className="mt-10 rounded-3xl border border-forward-200 bg-white p-6 shadow-sm sm:p-8">
          {step < 5 && current ? (
            <>
              <div className="mb-6 flex gap-1.5">
                {questions.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full ${i <= step ? "bg-brand-cyan" : "bg-forward-100"}`}
                  />
                ))}
              </div>
              <p className="text-sm font-medium text-forward-500">Question {step + 1} of 5</p>
              <h3 className="mt-2 font-display text-2xl font-medium text-forward-900">{current.label}</h3>
              {current.input}
              <div className="mt-8 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!current.canContinue}
                  onClick={() => setStep((s) => s + 1)}
                  className={buttonClassName({
                    size: "lg",
                    className: "disabled:cursor-not-allowed disabled:opacity-40",
                  })}
                >
                  {step === 4 ? "Generate snapshot" : "Continue"}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </button>
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className={buttonClassName({ size: "lg", variant: "ghost" })}
                  >
                    Back
                  </button>
                ) : null}
              </div>
            </>
          ) : snapshot ? (
            <div className="landing-fade-up">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-cyan">
                Future Snapshot
              </p>
              <p className="mt-2 text-sm text-forward-500">
                Based on people with a similar profile in {snapshot.regionLabel} · Goal: {snapshot.goal}
              </p>
              <ul className="mt-6 space-y-4 text-sm leading-relaxed text-forward-800">
                <li>
                  You&apos;re likely on track to retire around age{" "}
                  <strong>{snapshot.retireAge}</strong> under your current assumptions.
                </li>
                <li>
                  {snapshot.housingPressure === "elevated"
                    ? "Housing is consuming more of your income than recommended."
                    : "Housing costs look manageable relative to recommended income share — stay intentional as rates and lifestyle shift."}
                </li>
                <li>
                  Increasing your monthly investing by{" "}
                  <strong>CA${snapshot.investBump}</strong> could significantly improve your
                  retirement outlook over time.
                </li>
                <li>
                  Your current savings rate appears <strong>{snapshot.savingsStrength}</strong>.
                </li>
              </ul>
              <div className="mt-6 rounded-2xl border border-dashed border-brand-cyan/40 bg-brand-cyan/5 px-4 py-3">
                <p className="text-sm font-semibold text-forward-900">
                  Prediction Confidence: {snapshot.confidence}%
                </p>
                <p className="mt-1 text-xs text-forward-600">
                  Connect more of your life to improve accuracy.
                </p>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className={buttonClassName({ size: "lg" })}>
                  Build My Digital Twin
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setStep(0);
                    setAnswers({ region: "", age: "", income: "", housing: "", goal: "" });
                  }}
                  className={buttonClassName({ size: "lg", variant: "ghost" })}
                >
                  Try again
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
