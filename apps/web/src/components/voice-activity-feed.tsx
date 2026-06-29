"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mic, Sparkles } from "lucide-react";
import type { VoiceCapturePayload, VoicePracticePayload } from "@forward/shared";
import { VOICE_PRACTICE_MODE_LABELS } from "@forward/shared";

function formatWhen(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const SOURCE_LABELS: Record<string, string> = {
  capture: "Quick capture",
  brain_dump: "Brain dump",
  ambient_capture: "Ambient",
  night_reflection: "Night reflection",
  morning_reflection: "Morning check-in",
};

export function VoiceActivityFeed() {
  const [captures, setCaptures] = useState<VoiceCapturePayload[]>([]);
  const [practice, setPractice] = useState<VoicePracticePayload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/voice-capture").then((r) => r.json()),
      fetch("/api/voice-practice").then((r) => r.json()),
    ])
      .then(([capData, pracData]) => {
        setCaptures((capData.captures ?? []).slice(0, 6));
        setPractice((pracData.sessions ?? []).slice(0, 4));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="h-32 animate-pulse rounded-xl bg-forward-100" />;
  }

  if (captures.length === 0 && practice.length === 0) return null;

  return (
    <section className="rounded-2xl border border-forward-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Mic className="h-4 w-4 text-brand-purple" />
        <h2 className="text-lg font-semibold text-forward-900">Voice activity</h2>
      </div>
      <p className="mt-1 text-sm text-forward-500">
        Everything you&apos;ve said — captures, reflections, and practice reps.
      </p>

      <ul className="mt-4 space-y-2">
        {captures.map((cap) => (
          <li
            key={cap.id}
            className="flex items-start justify-between gap-3 rounded-lg bg-forward-50 px-3 py-2.5 text-sm"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-purple">
                {SOURCE_LABELS[cap.source] ?? cap.source}
              </p>
              <p className="mt-0.5 truncate text-forward-800">
                {cap.summary ?? cap.transcript.slice(0, 100)}
              </p>
              {cap.applied.length > 0 && (
                <p className="mt-1 text-xs text-forward-500">
                  {cap.applied.length} item{cap.applied.length === 1 ? "" : "s"} organized
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs text-forward-400">{formatWhen(cap.createdAt)}</span>
          </li>
        ))}

        {practice.map((session) => (
          <li
            key={session.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-brand-purple/10 bg-brand-purple/5 px-3 py-2.5 text-sm"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-brand-purple">
                <Sparkles className="h-3 w-3" />
                Practice · {VOICE_PRACTICE_MODE_LABELS[session.mode]}
              </p>
              <p className="mt-0.5 truncate text-forward-800">{session.coachNote}</p>
            </div>
            <span className="shrink-0 font-semibold text-brand-purple">{session.scores.overall}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium">
        <Link href="/career" className="text-accent hover:underline">
          Career practice →
        </Link>
        <Link href="/relationships" className="text-accent hover:underline">
          Social practice →
        </Link>
        <Link href="/dashboard" className="text-accent hover:underline">
          Leadership practice →
        </Link>
      </div>
    </section>
  );
}
