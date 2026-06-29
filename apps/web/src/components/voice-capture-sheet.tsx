"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { VoiceCapturePayload } from "@forward/shared";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function VoiceCaptureSheet({
  capture,
  coachNote,
  onClose,
}: {
  capture: (VoiceCapturePayload & { atCap?: boolean; aiOrganized?: boolean }) | null;
  coachNote: string | null;
  onClose: () => void;
}) {
  if (!capture) return null;

  const sourceLabel =
    capture.source === "brain_dump"
      ? "Brain dump organized"
      : capture.source === "ambient_capture"
        ? "Ambient capture organized"
        : capture.source === "night_reflection"
          ? "Night reflection captured"
          : capture.source === "morning_reflection"
            ? "Morning check-in captured"
            : "Captured";

  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-3xl border border-forward-200 bg-white p-5 shadow-2xl sm:left-auto sm:right-6 sm:bottom-24 sm:max-w-md sm:rounded-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-purple">{sourceLabel}</p>
          <h3 className="mt-1 text-lg font-semibold text-forward-900">Done — no typing needed</h3>
        </div>
        <button
          type="button"
          aria-label="Close"
          className="rounded-lg p-1 text-forward-400 hover:bg-forward-100"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {coachNote && <p className="mt-3 text-sm italic text-forward-700">&ldquo;{coachNote}&rdquo;</p>}

      {capture.atCap && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          AI organize limit reached this month — still captured and sorted with smart rules.
        </p>
      )}

      <p className="mt-3 text-sm text-forward-600">{capture.summary ?? capture.transcript}</p>

      {capture.mood && (
        <p className="mt-2 text-xs text-forward-500">
          Mood: <span className="font-medium capitalize">{capture.mood}</span>
        </p>
      )}

      {capture.applied.length > 0 && (
        <ul className="mt-4 space-y-2">
          {capture.applied.map((action, i) => (
            <li
              key={`${action.type}-${i}`}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm",
                action.type === "coaching"
                  ? "border border-brand-purple/20 bg-brand-purple/5"
                  : "bg-forward-50"
              )}
            >
              <span className="text-forward-800">
                {action.type === "coaching" && (
                  <span className="mr-1 text-[10px] font-bold uppercase text-brand-purple">Coach · </span>
                )}
                {action.label}
              </span>
              {action.href && (
                <Link href={action.href} className="shrink-0 text-xs font-medium text-accent hover:underline">
                  View
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1" onClick={onClose}>
          Keep going
        </Button>
        <Link href="/memory" className="flex-1">
          <Button size="sm" className="w-full">
            Open Memory
          </Button>
        </Link>
      </div>
    </div>
  );
}
