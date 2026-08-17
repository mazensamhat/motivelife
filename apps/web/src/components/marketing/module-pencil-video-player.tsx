"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import type { ModulePencilVideo } from "@/lib/module-pencil-videos";
import { cn } from "@/lib/utils";

type Props = {
  video: ModulePencilVideo;
  className?: string;
  /** Soft paper frame for pencil aesthetic */
  paper?: boolean;
};

export function ModulePencilVideoPlayer({ video, className, paper = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

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

    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("error", onError);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.load();

    return () => {
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("error", onError);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [video.videoSrc]);

  const play = useCallback(async () => {
    const el = videoRef.current;
    if (!el) return;
    if (ended) {
      el.currentTime = 0;
      setEnded(false);
    }
    el.muted = false;
    try {
      await el.play();
    } catch {
      // Autoplay policies may still block; native controls remain.
    }
  }, [ended]);

  const showPlayOverlay = ready && !failed && (!playing || ended);

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.35)]",
        paper
          ? "rounded-sm border border-[#cfc6b6] bg-[#f5efe4]"
          : "rounded-2xl border border-white/15 bg-forward-950",
        className
      )}
    >
      <video
        ref={videoRef}
        className={cn(
          "absolute inset-0 h-full w-full object-contain transition-opacity duration-300",
          paper ? "bg-[#f5efe4]" : "bg-forward-950",
          failed ? "opacity-0" : "opacity-100"
        )}
        src={video.videoSrc}
        poster={video.posterSrc}
        controls={playing && !ended}
        playsInline
        preload="metadata"
        aria-label={`${video.label} product video`}
      />

      {showPlayOverlay ? (
        <button
          type="button"
          onClick={() => void play()}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/25 text-white transition hover:bg-black/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#2a2a2c]"
          aria-label={ended ? `Replay ${video.label}` : `Play ${video.label}`}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2a2a2c] text-[#f5efe4] shadow-lg transition hover:scale-105 sm:h-20 sm:w-20">
            <Play className="ml-1 h-7 w-7 fill-current sm:h-9 sm:w-9" aria-hidden />
          </span>
          <span className="rounded-full bg-[#2a2a2c]/85 px-4 py-1.5 text-sm font-semibold tracking-wide text-[#f5efe4] backdrop-blur-sm">
            {ended ? "Watch again" : "Play video"}
          </span>
        </button>
      ) : null}

      {failed ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-[#f5efe4] px-6 text-center">
          <p className="text-lg font-semibold text-[#2a2a2c]">Video unavailable</p>
          <p className="max-w-sm text-sm text-[#5a5852]">Refresh the page, or try again in a moment.</p>
        </div>
      ) : null}
    </div>
  );
}
