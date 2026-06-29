"use client";

import { useEffect, useState } from "react";
import type { CoachingLoopPayload, CoachingModule, ModuleImprovementStack } from "@forward/shared";
import { ModuleImprovementStackView } from "./module-improvement-stack";
import { CoachingLoopBanner } from "./coaching-loop-banner";
import { PremiumGate } from "./premium-gate";

const START_ACTION: Record<CoachingModule, string> = {
  money: "start_money_challenge",
  career: "start_career_challenge",
  health: "start_health_challenge",
  learning: "start_learning_challenge",
  relationships: "start_relationships_challenge",
};

export function ModuleImprovementPanel({ module }: { module: CoachingModule }) {
  const [stack, setStack] = useState<ModuleImprovementStack | null>(null);
  const [loops, setLoops] = useState<CoachingLoopPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  async function load() {
    const res = await fetch("/api/coaching-loops");
    const data = await res.json();
    setStack(data[module] ?? null);
    setLoops((data.loops ?? []).filter((l: CoachingLoopPayload) => l.module === module));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [module]);

  async function startChallenge() {
    setStarting(true);
    await fetch("/api/coaching-loops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: START_ACTION[module] }),
    });
    setStarting(false);
    load();
  }

  async function completeDay(loopId: string, day: number) {
    await fetch(`/api/coaching-loops/${loopId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day }),
    });
    load();
  }

  if (loading) return <div className="h-48 animate-pulse rounded-2xl bg-forward-100" />;
  if (!stack) return null;

  const moduleLoop = loops.find((l) => !l.goalId) ?? loops[0];
  if (moduleLoop && stack.improve && !stack.improve.loopId) {
    stack.improve.loopId = moduleLoop.id;
  }

  const goalLoops = loops.filter((l) => l.goalId);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
          Adaptive improvement
        </p>
        <h2 className="mt-1 text-lg font-semibold text-forward-900">Track → Understand → Improve</h2>
        <p className="mt-1 text-sm text-forward-500">
          People don&apos;t pay to track. They pay to improve.
        </p>
      </div>

      {goalLoops.map((loop) => (
        <CoachingLoopBanner key={loop.id} loop={loop} />
      ))}

      {moduleLoop && !goalLoops.includes(moduleLoop) && <CoachingLoopBanner loop={moduleLoop} />}

      <PremiumGate feature="Track → Understand → Improve coaching">
        <ModuleImprovementStackView
          stack={stack}
          onStartChallenge={stack.improve?.loopId ? undefined : startChallenge}
          onCompleteDay={completeDay}
          starting={starting}
        />
      </PremiumGate>
    </div>
  );
}
