"use client";

import { useState } from "react";
import Link from "next/link";
import {
  generateTwinOpportunities,
  generateTwinPatterns,
  simulateTwinScenario,
  type DigitalTwinProfile,
  type KashuWhatIfResult,
  type TwinSimulationResult,
} from "@forward/shared";
import { cn } from "@/lib/utils";
import { readApiJson } from "@/lib/fetch-api";

function money(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

type TwinScenarioId = "move_province" | "invest_more" | "sleep_better" | "cut_hours";

function kashuRequestForScenario(id: TwinScenarioId): Record<string, unknown> | null {
  switch (id) {
    case "invest_more":
      return { spendToday: 400 };
    case "cut_hours":
      return { lowerIncomeBy: 800 };
    case "move_province":
      return {
        newMonthlyBill: { title: "Housing / cost-of-living delta", amount: 400, dueDay: 1 },
      };
    default:
      return null;
  }
}

function mergeKashu(
  local: TwinSimulationResult,
  kashu: KashuWhatIfResult | null
): TwinSimulationResult {
  if (!kashu) return local;
  return {
    ...local,
    summary: `${local.summary} Kashu: ${kashu.explanation}`,
    impacts: [
      ...local.impacts,
      {
        label: "Kashu Safe to Spend",
        effect: `${money(kashu.baseline.safeToSpend)} → ${money(kashu.scenario.safeToSpend)}`,
      },
      {
        label: "Kashu 30-day low",
        effect: `${money(kashu.baseline.projectedLow)} → ${money(kashu.scenario.projectedLow)}`,
      },
      { label: "Kashu verdict", effect: kashu.verdictLabel },
    ],
  };
}

export function TwinOpportunityEnginePanel({ twin }: { twin: DigitalTwinProfile | null }) {
  const items = generateTwinOpportunities(twin);
  return (
    <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
        Opportunity Engine™
      </p>
      <p className="mt-1 text-sm text-forward-600">
        Instead of only warnings — opportunities your Twin can see.
      </p>
      <ul className="mt-4 space-y-2">
        {items.map((item) => {
          const body = (
            <div className="rounded-xl border border-emerald-100 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-forward-900">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-forward-600">{item.detail}</p>
            </div>
          );
          return (
            <li key={item.id}>
              {item.href ? (
                <Link href={item.href} className="block transition hover:opacity-90">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function TwinPatternEnginePanel({ twin }: { twin: DigitalTwinProfile | null }) {
  const patterns = generateTwinPatterns(twin);
  return (
    <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/70 via-white to-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
        Invisible Pattern Detection™
      </p>
      <p className="mt-1 text-sm text-forward-600">
        Signal Engine watches correlations humans usually miss.
      </p>
      <ul className="mt-4 space-y-2">
        {patterns.map((p) => (
          <li key={p.id} className="rounded-xl border border-amber-100 bg-white px-4 py-3">
            <p className="text-sm font-semibold text-forward-900">{p.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-forward-600">{p.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const SCENARIOS = [
  { id: "move_province" as const, label: "Move cities" },
  { id: "invest_more" as const, label: "Invest more" },
  { id: "sleep_better" as const, label: "Sleep better" },
  { id: "cut_hours" as const, label: "Cut work hours" },
];

export function TwinFutureSimulatorPanel({ twin }: { twin: DigitalTwinProfile | null }) {
  const [result, setResult] = useState<TwinSimulationResult | null>(null);
  const [activeId, setActiveId] = useState<TwinScenarioId | null>(null);
  const [consultedKashu, setConsultedKashu] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(id: TwinScenarioId) {
    setActiveId(id);
    setBusy(true);
    const local = simulateTwinScenario(twin, id);
    const payload = kashuRequestForScenario(id);
    if (!payload) {
      setResult(local);
      setConsultedKashu(false);
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/kashu/what-if", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readApiJson<KashuWhatIfResult>(res);
      setResult(mergeKashu(local, res.ok && data ? data : null));
      setConsultedKashu(Boolean(res.ok && data));
    } catch {
      setResult(local);
      setConsultedKashu(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50/80 via-white to-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">
        Future Simulator™
      </p>
      <p className="mt-1 text-sm text-forward-600">
        Life effects stay here. Money effects come from Kashu — this simulator does not re-run
        cash-flow.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={busy}
            onClick={() => void run(s.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              activeId === s.id
                ? "border-sky-500 bg-sky-100 text-sky-900"
                : "border-sky-200 bg-white text-forward-700 hover:border-sky-400"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {result ? (
        <div className="mt-4 rounded-xl border border-sky-100 bg-white px-4 py-3">
          <p className="text-sm font-semibold text-forward-900">{result.scenario}</p>
          <p className="mt-1 text-xs leading-relaxed text-forward-600">{result.summary}</p>
          <ul className="mt-3 space-y-1.5">
            {result.impacts.map((impact) => (
              <li key={impact.label} className="flex justify-between gap-3 text-xs">
                <span className="text-forward-500">{impact.label}</span>
                <span className="font-medium text-forward-800">{impact.effect}</span>
              </li>
            ))}
          </ul>
          {consultedKashu ? (
            <Link href="/kashu" className="mt-3 inline-block text-xs font-semibold text-sky-800 hover:underline">
              Open Kashu for the money model →
            </Link>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-forward-500">
          {busy ? "Asking Kashu…" : "Pick a scenario to simulate against your Twin."}
        </p>
      )}
    </section>
  );
}

export function TwinEnginesStrip({ twin }: { twin: DigitalTwinProfile | null }) {
  return (
    <div className="space-y-4">
      <TwinOpportunityEnginePanel twin={twin} />
      <TwinFutureSimulatorPanel twin={twin} />
      <TwinPatternEnginePanel twin={twin} />
    </div>
  );
}
