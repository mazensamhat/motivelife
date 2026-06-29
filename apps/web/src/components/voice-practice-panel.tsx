"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, RefreshCw } from "lucide-react";
import type { VoicePracticeDomain, VoicePracticeMode, VoicePracticePayload } from "@forward/shared";
import {
  VOICE_PRACTICE_DOMAIN_META,
  VOICE_PRACTICE_MODE_LABELS,
  VOICE_PRACTICE_MODES_BY_DOMAIN,
  pickPracticePrompt,
} from "@forward/shared";
import { cn } from "@/lib/utils";
import { useSpeechCapture } from "@/hooks/use-speech-capture";

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-forward-500">
        <span>{label}</span>
        <span className="font-medium text-forward-800">{value}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-forward-100">
        <div
          className="h-full rounded-full bg-brand-purple transition-all"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

export function VoicePracticePanel({ domain = "career" }: { domain?: VoicePracticeDomain }) {
  const meta = VOICE_PRACTICE_DOMAIN_META[domain];
  const modes = VOICE_PRACTICE_MODES_BY_DOMAIN[domain];
  const [mode, setMode] = useState<VoicePracticeMode>(meta.defaultMode);
  const [prompt, setPrompt] = useState(() => pickPracticePrompt(meta.defaultMode, 0));
  const [result, setResult] = useState<VoicePracticePayload | null>(null);
  const [history, setHistory] = useState<VoicePracticePayload[]>([]);
  const [processing, setProcessing] = useState(false);
  const { supported, listening, transcript, start, stop } = useSpeechCapture();
  const holdingRef = useRef(false);
  const transcriptRef = useRef("");
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    fetch(`/api/voice-practice?domain=${domain}`)
      .then((r) => r.json())
      .then((data) => setHistory(data.sessions ?? []))
      .catch(() => setHistory([]));
  }, [domain, result]);

  useEffect(() => {
    setMode(meta.defaultMode);
    setPrompt(pickPracticePrompt(meta.defaultMode, 0));
    setResult(null);
  }, [domain, meta.defaultMode]);

  function shufflePrompt() {
    setPrompt(pickPracticePrompt(mode, Date.now()));
    setResult(null);
  }

  useEffect(() => {
    setPrompt(pickPracticePrompt(mode, 0));
    setResult(null);
  }, [mode]);

  async function submitPractice(text: string, durationSeconds: number) {
    const trimmed = text.trim();
    if (trimmed.length < 10 || processing) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/voice-practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: trimmed, mode, durationSeconds, prompt }),
      });
      const data = await res.json();
      if (res.ok) setResult(data.session);
    } finally {
      setProcessing(false);
    }
  }

  function handleRelease() {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    stop();
    const durationSeconds = startedAtRef.current
      ? Math.max(3, Math.round((Date.now() - startedAtRef.current) / 1000))
      : 30;
    startedAtRef.current = null;
    window.setTimeout(() => submitPractice(transcriptRef.current, durationSeconds), 400);
  }

  return (
    <section className="rounded-2xl border border-forward-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-purple">
            Voice practice
          </p>
          <h2 className="mt-1 text-lg font-semibold text-forward-900">{meta.title}</h2>
          <p className="mt-1 text-sm text-forward-500">{meta.description}</p>
        </div>
        <button
          type="button"
          onClick={shufflePrompt}
          className="inline-flex items-center gap-1 rounded-lg border border-forward-200 px-3 py-1.5 text-xs font-medium text-forward-600 hover:bg-forward-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          New prompt
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              mode === m
                ? "bg-brand-purple text-white"
                : "bg-forward-100 text-forward-600 hover:bg-forward-200"
            )}
          >
            {VOICE_PRACTICE_MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-brand-purple/20 bg-brand-purple/5 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-purple">Your prompt</p>
        <p className="mt-1 text-sm font-medium text-forward-800">{prompt}</p>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        {(listening || processing) && (
          <p className="max-w-md text-center text-sm text-forward-600">
            {processing ? "Scoring your delivery…" : transcript || "Answer out loud — hold until done"}
          </p>
        )}
        <button
          type="button"
          aria-label="Hold to practice"
          disabled={!supported || processing}
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all",
            "brand-gradient text-white",
            listening && "scale-105 ring-4 ring-brand-purple/30",
            (!supported || processing) && "opacity-50"
          )}
          onPointerDown={(e) => {
            if (!supported || processing) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            holdingRef.current = true;
            startedAtRef.current = Date.now();
            setResult(null);
            start();
          }}
          onPointerUp={handleRelease}
          onPointerCancel={handleRelease}
          onLostPointerCapture={handleRelease}
        >
          <Mic className={cn("h-7 w-7", listening && "animate-pulse")} />
        </button>
        <p className="text-xs text-forward-400">Hold · Answer · Release</p>
      </div>

      {result && (
        <div className="mt-8 space-y-4 border-t border-forward-100 pt-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-forward-400">Overall score</p>
              <p className="text-3xl font-bold text-brand-purple">{result.scores.overall}</p>
            </div>
            <p className="max-w-xs text-right text-sm text-forward-600">{result.coachNote}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ScoreBar label="Confidence" value={result.scores.confidence} />
            <ScoreBar label="Clarity" value={result.scores.clarity} />
            <ScoreBar label={domain === "relationships" ? "Warmth / energy" : domain === "leadership" ? "Steady presence" : "Energy"} value={result.scores.energy} />
            <div className="rounded-lg bg-forward-50 px-3 py-2 text-xs text-forward-600">
              <p>
                <span className="font-medium text-forward-800">{result.scores.wordsPerMinute}</span>{" "}
                words/min ·{" "}
                <span className="font-medium text-forward-800">{result.scores.fillerWords}</span>{" "}
                fillers ({result.scores.fillerRate}/100 words)
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {result.tips.map((tip) => (
              <li
                key={tip.text}
                className="rounded-lg border border-forward-100 bg-forward-50 px-3 py-2 text-sm text-forward-700"
              >
                {tip.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-8 border-t border-forward-100 pt-6">
          <p className="text-xs font-bold uppercase tracking-widest text-forward-400">Recent reps</p>
          <ul className="mt-3 space-y-2">
            {history.slice(0, 4).map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between rounded-lg bg-forward-50 px-3 py-2 text-sm"
              >
                <span className="text-forward-700">
                  {VOICE_PRACTICE_MODE_LABELS[session.mode]} ·{" "}
                  <span className="text-forward-500">{session.prompt.slice(0, 48)}…</span>
                </span>
                <span className="font-semibold text-brand-purple">{session.scores.overall}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
