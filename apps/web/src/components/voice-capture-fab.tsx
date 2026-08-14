"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Brain, GripVertical, Mic, Radio } from "lucide-react";
import type { VoiceCapturePayload, VoiceCaptureSource } from "@forward/shared";
import { cn } from "@/lib/utils";
import { useSpeechCapture } from "@/hooks/use-speech-capture";
import { useSegmentedSpeechCapture } from "@/hooks/use-segmented-speech-capture";
import { isNativeShell } from "@/lib/native-shell";

type CaptureMode = "quick" | "brain_dump" | "ambient";

const MODE_LABELS: Record<
  CaptureMode,
  { title: string; hint: string; source: VoiceCaptureSource }
> = {
  quick: {
    title: "Talk to VYRA AI",
    hint: "Tap to talk · Tap again to stop",
    source: "capture",
  },
  brain_dump: {
    title: "Brain dump",
    hint: "Up to 5 min · tap to start/stop",
    source: "brain_dump",
  },
  ambient: {
    title: "Ambient",
    hint: "Tap to start/stop · auto-segments on pauses",
    source: "ambient_capture",
  },
};

const FAB_POS_KEY = "motivelife.coachFabPos.v1";
const DRAG_THRESHOLD_PX = 8;
const FAB_SIZE = 56;

type FabPos = { left: number; top: number };

function readStoredPos(): FabPos | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FAB_POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FabPos>;
    if (
      typeof parsed.left === "number" &&
      typeof parsed.top === "number" &&
      Number.isFinite(parsed.left) &&
      Number.isFinite(parsed.top)
    ) {
      return { left: parsed.left, top: parsed.top };
    }
  } catch {
    // ignore
  }
  return null;
}

function defaultPos(): FabPos {
  if (typeof window === "undefined") return { left: 16, top: 16 };
  const navH = 64;
  const safeBottom =
    Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "env(safe-area-inset-bottom)"
      ) || "0"
    ) || 0;
  const left = Math.max(12, window.innerWidth - FAB_SIZE - 16);
  const top = Math.max(
    12,
    window.innerHeight - FAB_SIZE - navH - safeBottom - 20
  );
  return { left, top };
}

function clampPos(pos: FabPos): FabPos {
  if (typeof window === "undefined") return pos;
  const margin = 8;
  const navReserve = 56;
  const safeBottom = 0;
  const maxLeft = Math.max(margin, window.innerWidth - FAB_SIZE - margin);
  const maxTop = Math.max(
    margin,
    window.innerHeight - FAB_SIZE - navReserve - safeBottom - margin
  );
  return {
    left: Math.min(maxLeft, Math.max(margin, pos.left)),
    top: Math.min(maxTop, Math.max(margin, pos.top)),
  };
}

export function VoiceCaptureFab({
  onCaptured,
}: {
  onCaptured: (result: {
    capture: VoiceCapturePayload;
    coachNote: string | null;
  }) => void;
}) {
  const [mode, setMode] = useState<CaptureMode>("quick");
  const [menuOpen, setMenuOpen] = useState(false);
  const [textFallbackOpen, setTextFallbackOpen] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [inNativeShell, setInNativeShell] = useState(false);
  const [pos, setPos] = useState<FabPos>(() => defaultPos());
  const [dragging, setDragging] = useState(false);
  const speech = useSpeechCapture();
  const ambient = useSegmentedSpeechCapture();
  const active = mode === "ambient" ? ambient : speech;

  const [processing, setProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const transcriptRef = useRef("");
  const segmentsRef = useRef<string[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const finishingRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
    moved: boolean;
  } | null>(null);
  const skipClickRef = useRef(false);

  const { supported, listening, transcript, start, stop } = active;
  const transcribing =
    "transcribing" in active ? Boolean(active.transcribing) : false;
  const captureError = "error" in active ? active.error : null;
  const segments = mode === "ambient" ? ambient.segments : [];
  const statusText =
    "statusText" in speech && mode !== "ambient" ? speech.statusText : "";

  useEffect(() => {
    setInNativeShell(isNativeShell());
    const stored = readStoredPos();
    setPos(clampPos(stored ?? defaultPos()));
  }, []);

  useEffect(() => {
    function onResize() {
      setPos((p) => clampPos(p));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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

  const persistPos = useCallback((next: FabPos) => {
    const clamped = clampPos(next);
    setPos(clamped);
    try {
      window.localStorage.setItem(FAB_POS_KEY, JSON.stringify(clamped));
    } catch {
      // ignore
    }
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
      if (res.ok) {
        onCaptured(data);
        setTextFallbackOpen(false);
        setTextDraft("");
      }
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

  async function finishCapture() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    stopTimer();
    startedAtRef.current = null;
    try {
      const text = await stop();
      const segs =
        mode === "ambient"
          ? segmentsRef.current.length > 0
            ? segmentsRef.current
            : text.trim().length > 8
              ? [text.trim()]
              : undefined
          : undefined;
      await submitCapture(text || transcriptRef.current, segs);
    } finally {
      finishingRef.current = false;
    }
  }

  function startTimedCapture() {
    startedAtRef.current = Date.now();
    setElapsed(0);
    stopTimer();
    timerRef.current = window.setInterval(() => {
      if (!startedAtRef.current) return;
      const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsed(secs);
      if (mode === "brain_dump" && secs >= 300) {
        void finishCapture();
      }
    }, 1000);
    void start();
  }

  function toggleCapture() {
    if (processing || transcribing) return;
    setMenuOpen(false);
    if (listening || finishingRef.current) {
      void finishCapture();
      return;
    }
    if (mode === "brain_dump" || mode === "ambient") {
      startTimedCapture();
      return;
    }
    void start();
  }

  function openTextFallback() {
    setMenuOpen(false);
    setTextFallbackOpen(true);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    // Don't start a drag from interactive controls other than the mic cluster handle/mic.
    const target = e.target as HTMLElement;
    if (target.closest("[data-fab-no-drag]")) return;

    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: pos.left,
      originTop: pos.top,
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    if (!drag.moved) {
      drag.moved = true;
      setDragging(true);
      setMenuOpen(false);
    }
    e.preventDefault();
    setPos(
      clampPos({
        left: drag.originLeft + dx,
        top: drag.originTop + dy,
      })
    );
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (drag.moved) {
      skipClickRef.current = true;
      // Compute final from the pointer event — `pos` state can be one frame stale.
      persistPos(
        clampPos({
          left: drag.originLeft + (e.clientX - drag.startX),
          top: drag.originTop + (e.clientY - drag.startY),
        })
      );
      window.setTimeout(() => {
        skipClickRef.current = false;
      }, 0);
    }
    setDragging(false);
  }

  const modeMeta = MODE_LABELS[mode];
  const panelAbove = pos.top > (typeof window !== "undefined" ? window.innerHeight * 0.45 : 300);

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-50 flex flex-col items-end gap-2",
        dragging && "select-none"
      )}
      style={{
        left: pos.left,
        top: pos.top,
        width: FAB_SIZE,
      }}
    >
      {/* Floating panels — open above or below the mic so cover screens stay usable */}
      <div
        className={cn(
          "pointer-events-none absolute right-0 flex w-max max-w-[min(100vw-1rem,20rem)] flex-col items-end gap-2",
          panelAbove ? "bottom-full mb-2" : "top-full mt-2"
        )}
      >
        {(listening || processing || transcribing) && (
          <div className="pointer-events-auto max-w-xs rounded-2xl border border-forward-200 bg-white px-4 py-3 shadow-lg">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-purple">
              {processing
                ? "Organizing…"
                : transcribing
                  ? "Transcribing…"
                  : modeMeta.title}
            </p>
            <p className="mt-1 text-sm text-forward-700">
              {processing
                ? mode === "ambient"
                  ? `Sorting ${segmentsRef.current.length || "your"} segments…`
                  : mode === "brain_dump"
                    ? "Batch sorting your threads…"
                    : "Capture · Organize · Remember · Coach"
                : transcribing
                  ? "Turning your voice into text…"
                  : transcript ||
                    statusText ||
                    (mode === "ambient"
                      ? "Talk naturally — tap again when done"
                      : mode === "brain_dump"
                        ? "Stream everything on your mind… tap to stop"
                        : "Listening — tap the mic when you’re done")}
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

        {textFallbackOpen && !processing && (
          <div
            data-fab-no-drag
            className="pointer-events-auto w-[min(100vw-2rem,20rem)] rounded-2xl border border-forward-200 bg-white p-4 shadow-lg"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-purple">
              Message VYRA AI
            </p>
            <p className="mt-1 text-xs text-forward-500">
              {inNativeShell
                ? "Microphone isn’t available right now — type instead."
                : "Voice isn’t supported in this browser — type instead."}
            </p>
            <textarea
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              rows={4}
              placeholder="What’s on your mind?"
              className="mt-3 w-full resize-none rounded-xl border border-forward-200 px-3 py-2 text-sm text-forward-900 outline-none focus:border-brand-purple"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setTextFallbackOpen(false);
                  setTextDraft("");
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-forward-600 hover:bg-forward-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={textDraft.trim().length < 3 || processing}
                onClick={() => submitCapture(textDraft)}
                className="rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {menuOpen &&
          !listening &&
          !processing &&
          !transcribing &&
          !textFallbackOpen && (
            <div
              data-fab-no-drag
              className="pointer-events-auto mb-1 overflow-hidden rounded-xl border border-forward-200 bg-white shadow-lg"
            >
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
                    mode === key &&
                      "bg-brand-purple/5 font-medium text-brand-purple"
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
                Drag the mic to move it · position is saved on this phone
              </div>
            </div>
          )}

        {!supported && !textFallbackOpen && (
          <p className="pointer-events-auto rounded-lg bg-forward-900/90 px-3 py-2 text-xs text-white">
            Tap the mic to type to VYRA AI.
          </p>
        )}
        {captureError && supported && !listening && !processing && !transcribing ? (
          <p className="pointer-events-auto max-w-xs rounded-lg bg-forward-900/90 px-3 py-2 text-xs text-white">
            {captureError}
          </p>
        ) : null}
      </div>

      <div
        className="pointer-events-auto relative flex items-center justify-end"
        style={{ width: FAB_SIZE, height: FAB_SIZE }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {!listening && !processing && !transcribing && !textFallbackOpen && (
          <button
            type="button"
            data-fab-no-drag
            onClick={() => setMenuOpen((o) => !o)}
            className="absolute right-[calc(100%+0.4rem)] top-1/2 hidden -translate-y-1/2 rounded-full border border-forward-200 bg-white px-3 py-1.5 text-xs font-medium text-forward-600 shadow-sm hover:bg-forward-50 min-[380px]:inline-flex"
            title={modeMeta.title}
          >
            {modeMeta.title}
          </button>
        )}
        <button
          type="button"
          aria-label={
            !supported
              ? "Type a message to VYRA AI"
              : listening
                ? "Stop recording"
                : "Start recording. Drag to move."
          }
          disabled={processing || transcribing}
          className={cn(
            "relative flex h-14 w-14 touch-none items-center justify-center rounded-full shadow-lg transition-transform",
            "brand-gradient text-white active:scale-95",
            listening && "scale-105 ring-4 ring-brand-purple/30",
            (processing || transcribing) && "opacity-60",
            dragging && "scale-110 cursor-grabbing ring-2 ring-white/80"
          )}
          onClick={() => {
            if (skipClickRef.current) return;
            if (!supported) openTextFallback();
            else toggleCapture();
          }}
          onContextMenu={(e) => {
            // Long-press / right-click opens mode menu instead of OS menu.
            e.preventDefault();
            if (!listening && !processing && !transcribing) {
              setMenuOpen(true);
            }
          }}
        >
          <span className="pointer-events-none absolute -left-0.5 top-1/2 -translate-y-1/2 text-white/70">
            <GripVertical className="h-3.5 w-3.5" aria-hidden />
          </span>
          {mode === "brain_dump" ? (
            <Brain className={cn("h-6 w-6", listening && "animate-pulse")} />
          ) : mode === "ambient" ? (
            <Radio className={cn("h-6 w-6", listening && "animate-pulse")} />
          ) : (
            <Mic className={cn("h-6 w-6", listening && "animate-pulse")} />
          )}
        </button>
      </div>
    </div>
  );
}
