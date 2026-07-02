"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

export type CreativeKind = "image" | "animation" | "video_5" | "video_30";

type Step = { id: string; label: string; startsAtSec: number };

const ESTIMATED_SEC: Record<CreativeKind, number> = {
  image: 60,
  animation: 90,
  video_5: 180,
  video_30: 300,
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
        { id: "image", label: "Generating still frame", startsAtSec: 0 },
        { id: "script", label: "Writing narration script", startsAtSec: 35 },
        { id: "voice", label: "Recording AI voiceover", startsAtSec: 50 },
        { id: "video", label: "Rendering video clip (Replicate)", startsAtSec: 75 },
        { id: "mux", label: "Merging narrated MP4", startsAtSec: 120 },
        { id: "save", label: "Uploading — preview will appear below", startsAtSec: 150 },
      ];
    case "video_30":
      return [
        { id: "image", label: "Generating still frame", startsAtSec: 0 },
        { id: "script", label: "Writing narration script", startsAtSec: 40 },
        { id: "voice", label: "Recording AI voiceover", startsAtSec: 60 },
        { id: "anim", label: "Building 30s animation", startsAtSec: 90 },
        { id: "mux", label: "Merging narrated MP4", startsAtSec: 180 },
        { id: "save", label: "Uploading — preview will appear below", startsAtSec: 240 },
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
    case "video_30":
      return "30s narrated video";
  }
}

function activeStepIndex(steps: Step[], elapsedSec: number): number {
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
}: {
  kind: CreativeKind;
  channel: string | null;
  startedAt: number;
}) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const steps = stepsForKind(kind);
  const maxSec = ESTIMATED_SEC[kind];
  const activeIdx = activeStepIndex(steps, elapsedSec);
  const progressPct = Math.min(96, Math.round((elapsedSec / maxSec) * 100));

  useEffect(() => {
    const tick = () => setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-cyan-500/40 bg-gradient-to-br from-cyan-950/40 to-forward-950/80">
      <div className="border-b border-cyan-500/20 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-cyan-100">
            Generating {kindLabel(kind)}
            {channel ? ` · ${channel}` : ""}
          </p>
          <p className="text-xs text-cyan-300/80">
            {formatElapsed(elapsedSec)} elapsed · usually up to {Math.ceil(maxSec / 60)} min
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-forward-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400 transition-[width] duration-1000 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-forward-500">Keep this tab open until the preview appears.</p>
      </div>

      <div className="grid gap-3 p-3 sm:grid-cols-2">
        <ul className="space-y-2 text-xs">
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

        <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-forward-700 bg-black/30 px-4 py-6 text-center">
          <Loader2 size={28} className="mb-3 animate-spin text-cyan-400/80" />
          <p className="text-sm text-forward-300">
            {kind === "video_5" || kind === "video_30"
              ? "Your narrated MP4 will show here when ready"
              : "Your creative will show here when ready"}
          </p>
          <p className="mt-1 text-xs text-forward-500">Step {activeIdx + 1} of {steps.length}</p>
        </div>
      </div>
    </div>
  );
}
