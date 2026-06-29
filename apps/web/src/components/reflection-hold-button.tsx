"use client";

import { useEffect, useRef, useState } from "react";
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
  const { supported, listening, transcript, start, stop } = useSpeechCapture();
  const [processing, setProcessing] = useState(false);
  const holdingRef = useRef(false);
  const transcriptRef = useRef("");

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

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

  function handleRelease() {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    stop();
    window.setTimeout(() => submit(transcriptRef.current), 400);
  }

  const dim = size === "lg" ? "h-16 w-16" : "h-12 w-12";
  const icon = size === "lg" ? "h-7 w-7" : "h-5 w-5";

  return (
    <div className="flex flex-col items-center gap-3">
      {(listening || processing) && (
        <p className="max-w-sm text-center text-sm text-forward-600">
          {processing ? "Organizing your words…" : transcript || "Speak naturally — up to 90 seconds"}
        </p>
      )}
      <button
        type="button"
        aria-label="Hold to speak"
        disabled={!supported || processing || disabled}
        className={cn(
          "flex items-center justify-center rounded-full shadow-lg transition-all",
          "brand-gradient text-white",
          dim,
          listening && "scale-105 ring-4 ring-brand-purple/30",
          (!supported || processing || disabled) && "opacity-50"
        )}
        onPointerDown={(e) => {
          if (!supported || processing || disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          holdingRef.current = true;
          start();
        }}
        onPointerUp={handleRelease}
        onPointerCancel={handleRelease}
        onLostPointerCapture={handleRelease}
      >
        <Mic className={cn(icon, listening && "animate-pulse")} />
      </button>
      <p className="text-xs text-forward-400">Hold · Talk · Release</p>
    </div>
  );
}
