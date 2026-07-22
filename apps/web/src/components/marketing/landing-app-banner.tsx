"use client";

import { useEffect, useState } from "react";
import { Apple, Smartphone } from "lucide-react";
import {
  APP_COMING_SOON_HEADLINE,
  APP_COMING_SOON_SUBLINE,
  IOS_COMING_SOON_LABEL,
  PLAY_STORE_CTA,
} from "@/lib/marketing-copy";
import { PLAY_STORE_URL } from "@/lib/motive-family";
import { isNativeShell } from "@/lib/native-shell";

/**
 * Web marketing banner. Hidden inside the native app shell so App Store
 * reviewers never see Android / Play chrome (Guideline 2.3.10).
 */
export function LandingAppBanner() {
  const [mode, setMode] = useState<"pending" | "web" | "hidden">("pending");

  useEffect(() => {
    setMode(isNativeShell() ? "hidden" : "web");
  }, []);

  if (mode === "pending" || mode === "hidden") return null;

  return (
    <div
      className="relative z-[60] border-b border-brand-cyan/30 bg-gradient-to-r from-brand-purple via-forward-900 to-brand-cyan/80 px-4 py-3.5 text-center sm:py-4"
      role="status"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12),transparent_70%)]" />
      <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-2.5 sm:gap-3">
        <p className="text-base font-bold tracking-tight text-white sm:text-lg">
          {APP_COMING_SOON_HEADLINE}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-forward-950 shadow-sm transition hover:bg-forward-100"
          >
            <Smartphone className="h-4 w-4" aria-hidden />
            {PLAY_STORE_CTA}
          </a>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-forward-100">
            <Apple className="h-4 w-4" aria-hidden />
            {IOS_COMING_SOON_LABEL}
          </span>
        </div>
        <p className="max-w-2xl text-xs text-forward-100 sm:text-sm">{APP_COMING_SOON_SUBLINE}</p>
      </div>
    </div>
  );
}
