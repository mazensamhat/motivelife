"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, Mic, Radio } from "lucide-react";
import type { VoiceCapturePayload, VoiceCaptureSource } from "@forward/shared";
import { cn } from "@/lib/utils";
import { useSpeechCapture } from "@/hooks/use-speech-capture";
import { useSegmentedSpeechCapture } from "@/hooks/use-segmented-speech-capture";

type CaptureMode = "quick" | "brain_dump" | "ambient";

const MODE_LABELS: Record<
  CaptureMode,
  { title: string; hint: string; source: VoiceCaptureSource; toggle?: boolean }
> = {
  quick: {
    title: "Quick capture",
    hint: "Hold · Talk · Release",
    source: "capture",
  },
  brain_dump: {
    title: "Brain dump",
    hint: "Up to 5 min · drive-time thoughts",
    source: "brain_dump",
  },
  ambient: {
    title: "Ambient",
    hint: "Tap to start/stop · auto-segments on pauses",
    source: "ambient_capture",
    toggle: true,
  },
};

export function VoiceCaptureFab({
  onCaptured,
}: {
  onCaptured: (result: { capture: VoiceCapturePayload; coachNote: string | null }) => void;
}) {
  const [mode, setMode] = useState<CaptureMode>("quick");
  const [menuOpen, setMenuOpen] = useState(false);
  const speech = useSpeechCapture();
  const ambient = useSegmentedSpeechCapture();
  const active = mode === "ambient" ? ambient : speech;

  const [processing, setProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const holdingRef = useRef(false);
  const transcriptRef = useRef("");
  const segmentsRef = useRef<string[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const { supported, listening, transcript, start, stop } = active;
  const segments = mode === "ambient" ? ambient.segments : [];

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  async function submitCapture(text: string, segs?: string[]) {
    const trimmed = text.trim();
    if (trimmed.length < 3 || processing) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/voice-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: trimmed,
          source: MODE_LABELS[mode].source,
          segments: segs?.length ? segs : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) onCaptured(data);
    } finally {
      setProcessing(false);
      setElapsed(0);
    }
  }

  function stopTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function finishCapture() {
    stop();
    stopTimer();
    startedAtRef.current = null;
    window.setTimeout(() => {
      submitCapture(
        transcriptRef.current,
        mode === "ambient" ? segmentsRef.current : undefined
      );
    }, 400);
  }

  function handleRelease() {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    finishCapture();
  }

  function startHoldCapture() {
    startedAtRef.current = Date.now();
    setElapsed(0);
    if (mode === "brain_dump") {
      stopTimer();
      timerRef.current = window.setInterval(() => {
        if (!startedAtRef.current) return;
        const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(secs);
        if (secs >= 300) handleRelease();
      }, 1000);
    }
    start();
  }

  function toggleAmbient() {
    if (processing) return;
    setMenuOpen(false);
    if (listening) {
      finishCapture();
    } else {
      startedAtRef.current = Date.now();
      stopTimer();
      timerRef.current = window.setInterval(() => {
        if (!startedAtRef.current) return;
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 1000);
      start();
    }
  }

  const modeMeta = MODE_LABELS[mode];
  const isToggle = modeMeta.toggle === true;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {(listening || processing) && (
        <div className="pointer-events-auto max-w-xs rounded-2xl border border-forward-200 bg-white px-4 py-3 shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-purple">
            {processing ? "Organizing…" : modeMeta.title}
          </p>
          <p className="mt-1 text-sm text-forward-700">
            {processing
              ? mode === "ambient"
                ? `Sorting ${segmentsRef.current.length || "your"} segments…`
                : mode === "brain_dump"
                  ? "Batch sorting your threads…"
                  : "Capture · Organize · Remember · Coach"
              : transcript ||
                (mode === "ambient"
                  ? "Talk naturally — pauses create segments"
                  : mode === "brain_dump"
                    ? "Stream everything on your mind…"
                    : "Speak naturally…")}
          </p>
          {(mode === "brain_dump" || mode === "ambient") && listening && (
            <p className="mt-1 text-xs text-forward-400">
              {mode === "brain_dump"
                ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")} / 5:00`
                : `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")} · ${segments.length} segment${segments.length === 1 ? "" : "s"}`}
            </p>
          )}
          {mode === "ambient" && listening && segments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {segments.slice(-3).map((seg, i) => (
                <span
                  key={`${i}-${seg.slice(0, 12)}`}
                  className="rounded-full bg-brand-purple/10 px-2 py-0.5 text-[10px] text-brand-purple"
                >
                  {seg.slice(0, 28)}…
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {menuOpen && !listening && !processing && (
        <div className="pointer-events-auto mb-1 overflow-hidden rounded-xl border border-forward-200 bg-white shadow-lg">
          {(Object.keys(MODE_LABELS) as CaptureMode[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMode(key);
                setMenuOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-forward-50",
                mode === key && "bg-brand-purple/5 font-medium text-brand-purple"
              )}
            >
              {key === "brain_dump" ? (
                <Brain className="h-4 w-4 shrink-0" />
              ) : key === "ambient" ? (
                <Radio className="h-4 w-4 shrink-0" />
              ) : (
                <Mic className="h-4 w-4 shrink-0" />
              )}
              <span>
                {MODE_LABELS[key].title}
                <span className="block text-xs font-normal text-forward-400">
                  {MODE_LABELS[key].hint}
                </span>
              </span>
            </button>
          ))}
          <div className="border-t border-forward-100 px-4 py-2 text-[10px] text-forward-400">
            Voice commands: &ldquo;Start resume challenge&rdquo; · &ldquo;Start connection challenge&rdquo;
          </div>
        </div>
      )}

      <div className="pointer-events-auto flex items-center gap-2">
        {!listening && !processing && (
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-full border border-forward-200 bg-white px-3 py-1.5 text-xs font-medium text-forward-600 shadow-sm hover:bg-forward-50"
          >
            {modeMeta.title}
          </button>
        )}
        <button
          type="button"
          aria-label={
            isToggle
              ? listening
                ? "Stop ambient capture"
                : "Start ambient capture"
              : listening
                ? "Release to capture"
                : "Hold to capture voice"
          }
          disabled={!supported || processing}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all",
            "brand-gradient text-white hover:scale-105 active:scale-95",
            listening && "scale-105 ring-4 ring-brand-purple/30",
            (!supported || processing) && "opacity-60 hover:scale-100"
          )}
          onClick={isToggle ? toggleAmbient : undefined}
          onPointerDown={
            isToggle
              ? undefined
              : (e) => {
                  if (!supported || processing) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  holdingRef.current = true;
                  setMenuOpen(false);
                  startHoldCapture();
                }
          }
          onPointerUp={isToggle ? undefined : handleRelease}
          onPointerCancel={isToggle ? undefined : handleRelease}
          onLostPointerCapture={isToggle ? undefined : handleRelease}
        >
          {mode === "brain_dump" ? (
            <Brain className={cn("h-6 w-6", listening && "animate-pulse")} />
          ) : mode === "ambient" ? (
            <Radio className={cn("h-6 w-6", listening && "animate-pulse")} />
          ) : (
            <Mic className={cn("h-6 w-6", listening && "animate-pulse")} />
          )}
        </button>
      </div>

      {!supported && (
        <p className="pointer-events-auto rounded-lg bg-forward-900/90 px-3 py-2 text-xs text-white">
          Voice capture works best in Chrome or Edge.
        </p>
      )}
    </div>
  );
}
