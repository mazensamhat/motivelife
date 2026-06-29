"use client";

import type { ModuleImprovementStack } from "@forward/shared";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { BarChart3, Lightbulb, Rocket } from "lucide-react";

export function ModuleImprovementStackView({
  stack,
  onStartChallenge,
  onCompleteDay,
  starting,
}: {
  stack: ModuleImprovementStack;
  onStartChallenge?: () => void;
  onCompleteDay?: (loopId: string, day: number) => void;
  starting?: boolean;
}) {
  const layers = [
    { key: "track", label: "Track", icon: BarChart3, data: stack.track, color: "border-forward-200 bg-forward-50" },
    {
      key: "understand",
      label: "Understand",
      icon: Lightbulb,
      data: stack.understand,
      color: "border-brand-blue/20 bg-brand-blue/5",
    },
    {
      key: "improve",
      label: "Improve",
      icon: Rocket,
      data: stack.improve,
      color: "border-brand-green/30 bg-brand-green/5",
    },
  ] as const;

  return (
    <div className="space-y-4">
      {layers.map(({ key, label, icon: Icon, data, color }) => {
        if (key === "improve" && !data) return null;
        const headline = data && "headline" in data ? data.headline : "";
        const detail = data && "detail" in data ? data.detail : "";

        return (
          <section key={key} className={cn("rounded-2xl border p-5 shadow-sm", color)}>
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-forward-600" />
              <p className="text-xs font-bold uppercase tracking-widest text-forward-500">{label}</p>
            </div>
            <h3 className="mt-2 text-base font-semibold text-forward-900">{headline}</h3>
            <p className="mt-1 text-sm text-forward-600">{detail}</p>

            {key === "track" && stack.track.metric && (
              <p className="mt-3 text-2xl font-semibold tabular-nums text-forward-900">{stack.track.metric}</p>
            )}

            {key === "improve" && stack.improve && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-forward-700">{stack.improve.challengeTitle}</p>
                {stack.improve.loopId ? (
                  stack.improve.days.map((d) => (
                    <div
                      key={d.day}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border px-3 py-2 text-sm",
                        d.done ? "border-brand-green/30 bg-white/80 opacity-70" : "border-forward-200 bg-white"
                      )}
                    >
                      <span className="mt-0.5 text-xs font-bold text-forward-400">D{d.day}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-forward-900">{d.title}</p>
                        <p className="text-xs text-forward-500">{d.action}</p>
                      </div>
                      {!d.done && stack.improve?.loopId && onCompleteDay && (
                        <button
                          type="button"
                          onClick={() => onCompleteDay(stack.improve!.loopId!, d.day)}
                          className="shrink-0 text-xs font-semibold text-brand-green hover:underline"
                        >
                          Done
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <>
                    <p className="text-xs text-forward-500">
                      Day 1: {stack.improve.days[0]?.action}
                    </p>
                    {onStartChallenge && (
                      <Button size="sm" onClick={onStartChallenge} disabled={starting}>
                        {starting ? "Starting…" : "Start 7-day challenge"}
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
