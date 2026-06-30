"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Play, Sparkles } from "lucide-react";
import { DEMO_VIDEO_PATH } from "@/lib/marketing-copy";
import { cn } from "@/lib/utils";

const VIDEO_SRC =
  typeof process.env.NEXT_PUBLIC_DEMO_VIDEO_URL === "string" &&
  process.env.NEXT_PUBLIC_DEMO_VIDEO_URL.length > 0
    ? process.env.NEXT_PUBLIC_DEMO_VIDEO_URL
    : DEMO_VIDEO_PATH;

export function LandingDemoVideo({ className }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

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

    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("error", onError);
    video.load();

    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("error", onError);
    };
  }, []);

  const showPlaceholder = failed || !ready;

  return (
    <div
      className={cn(
        "landing-product-frame relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-white/10 bg-forward-900/90 shadow-2xl sm:aspect-video",
        className
      )}
    >
      <video
        ref={videoRef}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
          showPlaceholder ? "pointer-events-none opacity-0" : "opacity-100"
        )}
        src={VIDEO_SRC}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="MotiveLife product demo"
      />

      <div
        className={cn(
          "absolute inset-0 flex flex-col transition-opacity duration-500",
          showPlaceholder ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        aria-hidden={!showPlaceholder}
      >
        <div className="absolute inset-0 landing-hero-glow opacity-60" />
        <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="relative mb-6">
            <span className="absolute inset-0 animate-ping rounded-full bg-brand-purple/30" />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full brand-gradient shadow-lg">
              <Mic className="h-9 w-9 text-white" />
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-cyan">
            Product demo
          </p>
          <p className="mt-3 max-w-xs text-lg font-semibold leading-snug text-white">
            Speak → AI organizes → briefing → Life Score → done
          </p>
          <p className="mt-3 max-w-sm text-sm text-forward-300">
            45-second walkthrough video slots here. Add{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-forward-200">
              public/marketing/product-demo.mp4
            </code>{" "}
            or set{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-forward-200">
              NEXT_PUBLIC_DEMO_VIDEO_URL
            </code>
            .
          </p>
        </div>

        <div className="relative border-t border-white/10 bg-forward-950/70 px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-xs text-forward-400">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-brand-cyan" />
              AI-generated demo ready to embed
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 font-medium text-forward-200">
              <Play className="h-3 w-3" />
              Autoplay · muted
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
