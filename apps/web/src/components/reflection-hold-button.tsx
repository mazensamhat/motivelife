"use client";

import { useRef, useState } from "react";
import { Mic } from "lucide-react";
import type { ReflectionExtraction, VoiceCapturePayload, VoiceCaptureSource } from "@forward/shared";
import { cn } from "@/lib/utils";
import { useSpeechCapture } from "@/hooks/use-speech-capture";

export type ReflectionCompleteResult = {
  capture: VoiceCapturePayload;
  coachNote: string | null;
  reflection?: ReflectionExtraction | null;
};

export function ReflectionHoldButton({
  source,
  onComplete,
  disabled,
  size = "lg",
}: {
  source: VoiceCaptureSource;
  onComplete: (result: ReflectionCompleteResult) => void;
  disabled?: boolean;
  size?: "lg" | "md";
}) {
  const { supported, listening, transcript, start, stop, transcribing, error, statusText, engine } =
    useSpeechCapture();
  const [processing, setProcessing] = useState(false);
  const [textFallback, setTextFallback] = useState("");
  const holdingRef = useRef(false);
  const finishingRef = useRef(false);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3 || processing) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/voice-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: trimmed, source }),
      });
      const data = (await res.json()) as ReflectionCompleteResult;
      if (res.ok) onComplete(data);
    } finally {
      setProcessing(false);
    }
  }

  async function handleRelease() {
    if (!holdingRef.current || finishingRef.current) return;
    holdingRef.current = false;
    finishingRef.current = true;
    try {
      const text = await stop();
      await submit(text);
    } finally {
      finishingRef.current = false;
    }
  }

  const dim = size === "lg" ? "h-16 w-16" : "h-12 w-12";
  const icon = size === "lg" ? "h-7 w-7" : "h-5 w-5";
  const busy = processing || transcribing;

  return (
    <div className="flex flex-col items-center gap-3">
      {(listening || busy) && (
        <p className="max-w-sm text-center text-sm text-forward-600">
          {processing
            ? "Organizing your words…"
            : transcribing
              ? "Transcribing…"
              : transcript || statusText || "Speak naturally — up to 90 seconds"}
        </p>
      )}
      {error && !listening && !busy ? (
        <p className="max-w-sm text-center text-xs text-red-600">{error}</p>
      ) : null}
      <button
        type="button"
        aria-label="Hold to speak"
        disabled={!supported || busy || disabled}
        className={cn(
          "flex items-center justify-center rounded-full shadow-lg transition-all",
          "brand-gradient text-white",
          dim,
          listening && "scale-105 ring-4 ring-brand-purple/30",
          (!supported || busy || disabled) && "opacity-50"
        )}
        onPointerDown={(e) => {
          if (!supported || busy || disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          holdingRef.current = true;
          void start();
        }}
        onPointerUp={() => void handleRelease()}
        onPointerCancel={() => void handleRelease()}
        onLostPointerCapture={() => void handleRelease()}
      >
        <Mic className={cn(icon, listening && "animate-pulse")} />
      </button>
      <p className="text-xs text-forward-400">
        {supported
          ? engine === "media"
            ? "Hold · Talk · Release (works on iPad)"
            : "Hold · Talk · Release"
          : "Voice mic unavailable — type below"}
      </p>
      {!supported ? (
        <div className="mt-2 w-full max-w-sm">
          <textarea
            value={textFallback}
            onChange={(e) => setTextFallback(e.target.value)}
            rows={3}
            placeholder="Type your reflection…"
            className="w-full resize-none rounded-xl border border-forward-200 px-3 py-2 text-sm outline-none focus:border-brand-purple"
          />
          <button
            type="button"
            disabled={textFallback.trim().length < 3 || processing}
            onClick={() => void submit(textFallback)}
            className="mt-2 w-full rounded-lg brand-gradient px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Send reflection
          </button>
        </div>
      ) : null}
    </div>
  );
}
