"use client";

import { useState } from "react";
import type { DomainScoreMap, ScoreChangeReason } from "@forward/shared";
import { Card } from "./card";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

const DOMAINS: {
  key: keyof DomainScoreMap["domainDeltas"];
  label: string;
  color: string;
}[] = [
  { key: "career", label: "Career", color: "#7C3AED" },
  { key: "money", label: "Money", color: "#10B981" },
  { key: "health", label: "Health", color: "#EF4444" },
  { key: "relationships", label: "Relationships", color: "#EC4899" },
  { key: "learning", label: "Learning", color: "#3B82F6" },
  { key: "mindset", label: "Mindset", color: "#F59E0B" },
];

function deltaSymbol(d: number) {
  if (d > 0) return "▲";
  if (d < 0) return "▼";
  return "►";
}

function Ring({
  score,
  delta,
  color,
  size = 52,
}: {
  score: number;
  delta: number;
  color: string;
  size?: number;
}) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-forward-100"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        className="transition-all duration-700"
      />
    </svg>
  );
}

export function LifeScoreRings({
  scores,
  reasons,
}: {
  scores: DomainScoreMap;
  reasons: ScoreChangeReason[];
}) {
  const [showWhy, setShowWhy] = useState(false);

  return (
    <>
      <Card className="overflow-hidden border-forward-200 p-0">
        <button
          type="button"
          onClick={() => setShowWhy(true)}
          className="w-full text-left transition-colors hover:bg-forward-50/50"
        >
          <div className="border-b border-forward-100 bg-forward-950 px-5 py-4 text-white">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-forward-400">
                  Motive Life Score™
                </p>
                <p className="mt-1 text-4xl font-bold tabular-nums">{scores.overall}</p>
              </div>
              <p
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  scores.overallDelta > 0
                    ? "text-brand-green"
                    : scores.overallDelta < 0
                      ? "text-red-400"
                      : "text-forward-400"
                )}
              >
                {scores.overallDelta > 0
                  ? `▲ +${scores.overallDelta}`
                  : scores.overallDelta < 0
                    ? `▼ ${scores.overallDelta}`
                    : "—"}
              </p>
            </div>
            <p className="mt-2 text-xs text-brand-cyan">Tap to see why your score changed →</p>
          </div>

          <div className="grid grid-cols-3 gap-4 p-5 sm:grid-cols-6">
            {DOMAINS.map(({ key, label, color }) => {
              const score = scores[key];
              const delta = scores.domainDeltas[key];
              return (
                <div key={key} className="flex flex-col items-center text-center">
                  <div className="relative">
                    <Ring score={score} delta={delta} color={color} />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums text-forward-900">
                      {score}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-forward-600">
                    {label}
                  </p>
                  <p
                    className={cn(
                      "text-xs font-bold tabular-nums",
                      delta > 0 ? "text-brand-green" : delta < 0 ? "text-red-500" : "text-forward-400"
                    )}
                  >
                    {deltaSymbol(delta)}
                  </p>
                </div>
              );
            })}
          </div>
        </button>
      </Card>

      {showWhy && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-forward-100 px-5 py-4">
              <h3 className="font-semibold text-forward-900">Why did my score change?</h3>
              <button
                type="button"
                onClick={() => setShowWhy(false)}
                className="rounded-lg p-2 text-forward-500 hover:bg-forward-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="space-y-4 p-5">
              {reasons.length === 0 ? (
                <li className="text-sm text-forward-600">
                  Your scores are steady — complete today&apos;s mission to move the needle.
                </li>
              ) : (
                reasons.map((r) => (
                  <li key={r.domain} className="rounded-xl border border-forward-100 bg-forward-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-forward-900">{r.label}</span>
                      <span
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          r.delta > 0 ? "text-brand-green" : r.delta < 0 ? "text-red-500" : "text-forward-400"
                        )}
                      >
                        {r.delta > 0 ? `+${r.delta}` : r.delta === 0 ? "—" : r.delta}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-forward-600">{r.reason}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
