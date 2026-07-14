"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/button";

export type CreativeKind = "image" | "animation" | "video_5" | "video_15" | "video_30";

export type CreativeJobPhase = "running" | "success" | "warning" | "error";

type Step = { id: string; label: string; startsAtSec: number };

const ESTIMATED_SEC: Record<CreativeKind, number> = {
  image: 60,
  animation: 90,
  video_5: 180,
  video_15: 210,
  video_30: 240,
};

function stepsForKind(kind: CreativeKind): Step[] {
  switch (kind) {
    case "image":
      return [
        { id: "image", label: "Generating image with DALL·E", startsAtSec: 0 },
        { id: "save", label: "Optimizing and saving", startsAtSec: 35 },
      ];
    case "animation":
      return [
        { id: "image", label: "Generating still frame", startsAtSec: 0 },
        { id: "gif", label: "Building Ken Burns animation (GIF)", startsAtSec: 40 },
        { id: "save", label: "Saving creative", startsAtSec: 70 },
      ];
    case "video_5":
      return [
        { id: "image", label: "Still from product UI", startsAtSec: 0 },
        { id: "video", label: "Rendering motion MP4 (Replicate)", startsAtSec: 35 },
        { id: "voice", label: "Writing script + AI voiceover", startsAtSec: 110 },
        { id: "mux", label: "Muxing narration into MP4", startsAtSec: 140 },
        { id: "save", label: "Saving narrated video", startsAtSec: 165 },
      ];
    case "video_15":
      return [
        { id: "image", label: "Still from product UI", startsAtSec: 0 },
        { id: "extend", label: "Ken Burns extend to 15s", startsAtSec: 40 },
        { id: "voice", label: "Writing 15s script + voiceover", startsAtSec: 90 },
        { id: "mux", label: "Muxing narration into MP4", startsAtSec: 140 },
        { id: "save", label: "Saving narrated video", startsAtSec: 190 },
      ];
    case "video_30":
      return [
        { id: "image", label: "Still from product UI", startsAtSec: 0 },
        { id: "extend", label: "Ken Burns extend to 30s", startsAtSec: 40 },
        { id: "voice", label: "Writing 30s script + voiceover", startsAtSec: 100 },
        { id: "mux", label: "Muxing narration into MP4", startsAtSec: 160 },
        { id: "save", label: "Saving narrated video", startsAtSec: 210 },
      ];
  }
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `0:${s.toString().padStart(2, "0")}`;
}

function kindLabel(kind: CreativeKind): string {
  switch (kind) {
    case "image":
      return "Image";
    case "animation":
      return "5s animation";
    case "video_5":
      return "5s narrated video";
    case "video_15":
      return "15s narrated video";
    case "video_30":
      return "30s narrated video";
  }
}

function activeStepIndex(steps: Step[], elapsedSec: number, phase: CreativeJobPhase): number {
  if (phase === "success" || phase === "warning") return steps.length - 1;
  let idx = 0;
  for (let i = 0; i < steps.length; i++) {
    if (elapsedSec >= steps[i]!.startsAtSec) idx = i;
  }
  return idx;
}

export function MarketingCreativeProgress({
  kind,
  channel,
  startedAt,
  phase,
  resultMessage,
  sticky,
  onDismiss,
}: {
  kind: CreativeKind;
  channel: string | null;
  startedAt: number;
  phase: CreativeJobPhase;
  resultMessage?: string;
  sticky?: boolean;
  onDismiss?: () => void;
}) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const steps = stepsForKind(kind);
  const maxSec = ESTIMATED_SEC[kind];
  const isVideo = kind === "video_5" || kind === "video_15" || kind === "video_30";
  const activeIdx = activeStepIndex(steps, elapsedSec, phase);
  const progressPct =
    phase === "success" || phase === "warning"
      ? 100
      : phase === "error"
        ? Math.min(96, Math.round((elapsedSec / maxSec) * 100))
        : Math.min(96, Math.round((elapsedSec / maxSec) * 100));

  useEffect(() => {
    if (phase !== "running") return;
    const tick = () => setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt, phase]);

  const borderClass =
    phase === "success"
      ? "border-emerald-500/50 ring-1 ring-emerald-500/30"
      : phase === "warning" || phase === "error"
        ? "border-amber-500/50 ring-1 ring-amber-500/30"
        : "border-cyan-500/40 ring-1 ring-cyan-500/30";

  const bgClass =
    phase === "success"
      ? "bg-gradient-to-br from-emerald-950/50 to-forward-950/80"
      : phase === "warning" || phase === "error"
        ? "bg-gradient-to-br from-amber-950/40 to-forward-950/80"
        : "bg-gradient-to-br from-cyan-950/40 to-forward-950/80";

  return (
    <div
      className={`overflow-hidden rounded-xl ${borderClass} ${bgClass} ${
        sticky ? "shadow-lg shadow-cyan-950/40" : "mt-3"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {phase === "running" && (
                <Loader2 size={16} className="shrink-0 animate-spin text-cyan-400" />
              )}
              {phase === "success" && (
                <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              )}
              {phase === "warning" && (
                <AlertCircle size={16} className="shrink-0 text-amber-400" />
              )}
              {phase === "error" && (
                <AlertCircle size={16} className="shrink-0 text-amber-400" />
              )}
              <p className="text-sm font-semibold text-white">
                {phase === "running" && `Generating ${kindLabel(kind)}`}
                {phase === "success" && `${kindLabel(kind)} ready`}
                {phase === "warning" && `${kindLabel(kind)} — almost ready`}
                {phase === "error" && `${kindLabel(kind)} failed`}
                {channel ? ` · ${channel}` : ""}
              </p>
            </div>
            {phase === "running" && (
              <p className="mt-1 text-xs text-cyan-300/90">
                {formatElapsed(elapsedSec)} elapsed · up to {Math.ceil(maxSec / 60)} min — keep this tab
                open
              </p>
            )}
            {phase === "success" && (
              <p className="mt-1 text-xs text-emerald-300/90">
                {resultMessage ??
                  (isVideo
                    ? "Narrated MP4 is ready — preview below, then Publish or Share."
                    : "Creative saved — preview is below.")}
              </p>
            )}
            {phase === "warning" && (
              <p className="mt-1 text-xs text-amber-300/90">
                {resultMessage ??
                  "Visual + voiceover are ready; MP4 merge didn’t finish. Play voiceover below and retry."}
              </p>
            )}
            {phase === "error" && (
              <p className="mt-1 text-xs text-amber-300/90">
                {resultMessage ?? "Something went wrong. Try again or use Share to post manually."}
              </p>
            )}
          </div>
          {onDismiss && phase !== "running" && (
            <button
              type="button"
              onClick={onDismiss}
              className="shrink-0 rounded-md p-1 text-forward-400 hover:bg-forward-800 hover:text-white"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-forward-800/80">
          <div
            className={`h-full rounded-full transition-[width] duration-1000 ease-out ${
              phase === "success"
                ? "bg-emerald-400"
                : phase === "warning"
                  ? "bg-amber-400"
                  : phase === "error"
                    ? "bg-amber-400"
                    : "bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {phase === "running" && (
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <ul className="space-y-2.5 text-xs">
            {steps.map((step, i) => {
              const done = i < activeIdx;
              const active = i === activeIdx;
              return (
                <li
                  key={step.id}
                  className={`flex items-start gap-2 ${
                    active ? "text-cyan-100" : done ? "text-emerald-400/90" : "text-forward-500"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                  ) : active ? (
                    <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin text-cyan-400" />
                  ) : (
                    <Circle size={14} className="mt-0.5 shrink-0 text-forward-600" />
                  )}
                  <span className={active ? "font-medium" : undefined}>{step.label}</span>
                </li>
              );
            })}
          </ul>

          <div className="flex min-h-[150px] flex-col items-center justify-center rounded-lg border border-dashed border-cyan-500/30 bg-black/30 px-4 py-6 text-center">
            <div className="relative mb-4 flex h-14 w-14 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-cyan-500/20" />
              <Loader2 size={32} className="relative animate-spin text-cyan-400" />
            </div>
            <p className="text-sm font-medium text-forward-200">
              {isVideo ? "Building narrated video…" : "Building your creative…"}
            </p>
            <p className="mt-2 text-xs text-forward-500">
              Step {activeIdx + 1} of {steps.length}
            </p>
            <p className="mt-3 text-xs text-forward-600">
              Server is working — this panel stays until the video is ready.
            </p>
          </div>
        </div>
      )}

      {(phase === "success" || phase === "warning") && isVideo && onDismiss && (
        <div className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-3">
          <Button variant="secondary" onClick={onDismiss} className="text-xs">
            {phase === "warning" ? "Got it — show preview" : "Got it — show preview"}
          </Button>
        </div>
      )}
    </div>
  );
}
