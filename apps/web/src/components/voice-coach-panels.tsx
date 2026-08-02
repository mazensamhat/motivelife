"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Brain, Mic } from "lucide-react";
import type { LifeMemoryHighlight } from "@forward/shared";
import { ReflectionHoldButton } from "./reflection-hold-button";
import { VoiceCaptureSheet } from "./voice-capture-sheet";
import type { VoiceCapturePayload } from "@forward/shared";

export function TalkToCoachPanel({ onCaptured }: { onCaptured?: () => void }) {
  const [capture, setCapture] = useState<VoiceCapturePayload | null>(null);
  const [coachNote, setCoachNote] = useState<string | null>(null);

  return (
    <>
      <section
        id="voice-coach"
        className="overflow-hidden rounded-2xl border border-brand-purple/20 bg-gradient-to-br from-violet-50/50 via-white to-forward-50 shadow-sm"
      >
        <div className="px-5 py-6 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-purple">
                Talk to your Life Coach
              </p>
              <p className="mt-2 text-lg font-semibold text-forward-900">Tap · Speak · Stop</p>
              <p className="mt-2 text-sm leading-relaxed text-forward-600">
                Say what&apos;s on your mind — tasks, worries, wins. Your coach organizes it into memory,
                missions, and next steps.
              </p>
            </div>
            <div className="hidden rounded-2xl bg-brand-purple/15 p-3 sm:block">
              <Mic className="h-6 w-6 text-brand-purple" />
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center rounded-xl border border-forward-100 bg-forward-50 py-6">
            <ReflectionHoldButton
              source="capture"
              size="lg"
              onComplete={(result) => {
                setCapture(result.capture);
                setCoachNote(result.coachNote);
                onCaptured?.();
              }}
            />
            <p className="mt-3 text-xs text-forward-400">
              Works on iPhone, iPad, and desktop — tap to talk, tap again to stop
            </p>
          </div>
        </div>
      </section>

      <VoiceCaptureSheet
        capture={capture}
        coachNote={coachNote}
        onClose={() => {
          setCapture(null);
          setCoachNote(null);
        }}
      />
    </>
  );
}

export function LifeMemoryHookPanel({ highlights }: { highlights: LifeMemoryHighlight[] }) {
  const count = highlights.length;

  return (
    <section className="rounded-2xl border border-forward-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">Life Memory</p>
          <p className="mt-1 text-base font-semibold text-forward-900">
            {count > 0
              ? `Your AI remembered ${count} thing${count === 1 ? "" : "s"} this week`
              : "Start your Life Memory story"}
          </p>
          <p className="mt-1 text-sm text-forward-500">
            {count > 0
              ? "Achievements, lessons, and voice moments — yours forever."
              : "Talk to your coach once today and MotiveLife will remember what matters."}
          </p>
        </div>
        <Brain className="h-8 w-8 shrink-0 text-brand-purple" />
      </div>

      {count > 0 ? (
        <ul className="mt-4 space-y-2">
          {highlights.map((item) => (
            <li
              key={item.id}
              className="briefing-insight-enter rounded-xl border border-forward-100 bg-forward-50/80 px-4 py-3"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-purple">
                {item.source === "voice" ? "Voice memory" : "Remembered"}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-forward-800">{item.text}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <Link
        href="/memory"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline"
      >
        Open Life Memory
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
