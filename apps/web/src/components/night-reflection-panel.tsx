"use client";

import { useState } from "react";
import { Moon, Sparkles } from "lucide-react";
import type { VoiceCapturePayload } from "@forward/shared";
import { ReflectionHoldButton, type ReflectionCompleteResult } from "./reflection-hold-button";
import { Button } from "./button";

function ReflectionResults({
  capture,
  coachNote,
}: {
  capture: VoiceCapturePayload;
  coachNote: string | null;
}) {
  const reflection = capture.reflection;

  return (
    <div className="mt-6 space-y-4 border-t border-white/10 pt-6">
      {coachNote && <p className="text-sm italic text-indigo-200">&ldquo;{coachNote}&rdquo;</p>}

      {reflection && reflection.wins.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green">Wins</p>
          <ul className="mt-2 space-y-1">
            {reflection.wins.map((w) => (
              <li key={w} className="text-sm text-forward-200">
                ✓ {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {reflection && reflection.problems.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Problems</p>
          <ul className="mt-2 space-y-1">
            {reflection.problems.map((p) => (
              <li key={p} className="text-sm text-forward-300">
                · {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {capture.mood && (
        <p className="text-xs text-forward-400">
          Mood logged: <span className="capitalize text-forward-200">{capture.mood}</span>
        </p>
      )}

      {capture.applied.length > 0 && (
        <ul className="space-y-1.5">
          {capture.applied.slice(0, 6).map((a, i) => (
            <li key={`${a.label}-${i}`} className="text-xs text-forward-400">
              → {a.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NightReflectionPanel() {
  const [done, setDone] = useState(false);
  const [capture, setCapture] = useState<VoiceCapturePayload | null>(null);
  const [coachNote, setCoachNote] = useState<string | null>(null);

  function handleComplete(data: ReflectionCompleteResult) {
    setCapture({
      ...data.capture,
      reflection: data.reflection ?? data.capture.reflection ?? null,
    });
    setCoachNote(data.coachNote);
    setDone(true);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-950 via-forward-900 to-forward-950 text-white shadow-xl">
      <div className="border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-indigo-300" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
            Night reflection
          </p>
          <Sparkles className="h-3.5 w-3.5 text-brand-purple" />
        </div>
        <h3 className="mt-2 text-lg font-semibold">What happened today?</h3>
        <p className="mt-1 text-sm text-forward-400">
          Talk for 90 seconds. Wins, problems, mood, tasks — MotiveLife organizes everything.
        </p>
      </div>

      <div className="px-6 py-8">
        {!done ? (
          <ReflectionHoldButton source="night_reflection" onComplete={handleComplete} />
        ) : (
          <>
            <p className="text-center text-sm font-medium text-brand-green">Captured — rest well.</p>
            {capture && <ReflectionResults capture={capture} coachNote={coachNote} />}
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 text-forward-300 hover:text-white"
              onClick={() => {
                setDone(false);
                setCapture(null);
              }}
            >
              Record again
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

export function isEveningHours() {
  return new Date().getHours() >= 17;
}
