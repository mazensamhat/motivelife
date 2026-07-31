"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { DEMO_VIDEO_PATH } from "@/lib/marketing-copy";
import { cn } from "@/lib/utils";

const VIDEO_SRC =
  typeof process.env.NEXT_PUBLIC_DEMO_VIDEO_URL === "string" &&
  process.env.NEXT_PUBLIC_DEMO_VIDEO_URL.length > 0
    ? process.env.NEXT_PUBLIC_DEMO_VIDEO_URL
    : DEMO_VIDEO_PATH;

const POSTER_SRC = "/marketing/product-demo-poster.jpg";

export function LandingDemoVideo({ className }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function onCanPlay() {
      setReady(true);
      setFailed(false);
    }
    function onError() {
      setReady(false);
      setFailed(true);
    }
    function onPlay() {
      setPlaying(true);
      setEnded(false);
    }
    function onPause() {
      setPlaying(false);
    }
    function onEnded() {
      setPlaying(false);
      setEnded(true);
    }

    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("error", onError);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.load();

    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("error", onError);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, []);

  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (ended) {
      video.currentTime = 0;
      setEnded(false);
    }
    video.muted = false;
    try {
      await video.play();
    } catch {
      // Browser may still block unmuted autoplay; controls remain available.
    }
  }, [ended]);

  const showPlayOverlay = ready && !failed && (!playing || ended);

  return (
    <div
      className={cn(
        "landing-product-frame relative aspect-video w-full overflow-hidden rounded-2xl border border-white/15 bg-forward-950 shadow-[0_24px_80px_rgba(0,0,0,0.45)]",
        className
      )}
    >
      <video
        ref={videoRef}
        className={cn(
          "absolute inset-0 h-full w-full bg-forward-950 object-contain transition-opacity duration-300",
          failed ? "opacity-0" : "opacity-100"
        )}
        src={VIDEO_SRC}
        poster={POSTER_SRC}
        controls={playing && !ended}
        playsInline
        preload="metadata"
        aria-label="MotiveLife product demo — click play to watch with sound"
      />

      {showPlayOverlay ? (
        <button
          type="button"
          onClick={() => void play()}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-forward-950/35 text-white transition hover:bg-forward-950/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-brand-cyan"
          aria-label={ended ? "Replay product demo" : "Play product demo"}
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-cyan text-forward-950 shadow-[0_12px_40px_rgba(0,198,255,0.45)] transition scale-100 hover:scale-105 sm:h-24 sm:w-24">
            <Play className="ml-1 h-9 w-9 fill-current sm:h-11 sm:w-11" aria-hidden />
          </span>
          <span className="rounded-full bg-black/55 px-4 py-1.5 text-sm font-semibold tracking-wide text-white backdrop-blur-sm">
            {ended ? "Watch again" : "Play demo · 45 sec · with sound"}
          </span>
        </button>
      ) : null}

      {failed ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-forward-950 px-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <Play className="ml-1 h-7 w-7 text-white" aria-hidden />
          </span>
          <p className="text-lg font-semibold text-white">Demo video unavailable</p>
          <p className="max-w-sm text-sm text-forward-300">
            Refresh the page, or try again in a moment.
          </p>
        </div>
      ) : null}
    </div>
  );
}
