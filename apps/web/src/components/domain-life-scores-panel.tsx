"use client";

import type { DomainScoreMap } from "@forward/shared";
import { Card } from "./card";
import { cn } from "@/lib/utils";

const DOMAINS: { key: "career" | "money" | "health" | "learning" | "relationships" | "mindset"; label: string }[] = [
  { key: "career", label: "Career" },
  { key: "money", label: "Money" },
  { key: "health", label: "Health" },
  { key: "learning", label: "Learning" },
  { key: "relationships", label: "Relationships" },
  { key: "mindset", label: "Mindset" },
];

function barColor(score: number) {
  if (score >= 80) return "#00ff87";
  if (score >= 65) return "#00c6ff";
  if (score >= 50) return "#0072ff";
  return "#7a8fb0";
}

export function DomainLifeScoresPanel({ scores }: { scores: DomainScoreMap }) {
  const delta = scores.overallDelta;
  const deltaLabel = delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "—";

  return (
    <Card className="overflow-hidden border-forward-200 p-0">
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
              delta > 0 ? "text-brand-green" : delta < 0 ? "text-red-400" : "text-forward-400"
            )}
          >
            {deltaLabel}
          </p>
        </div>
        <p className="mt-2 text-xs text-forward-400">Alive across your life — not a credit score.</p>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        {DOMAINS.map(({ key, label }) => {
          const value = scores[key];
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-forward-700">{label}</span>
                <span className="font-bold tabular-nums text-forward-900">{value}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-forward-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${value}%`, backgroundColor: barColor(value) }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
