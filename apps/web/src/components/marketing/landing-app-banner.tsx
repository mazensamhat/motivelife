"use client";

import { useEffect, useState } from "react";
import { Apple, Smartphone } from "lucide-react";
import { APP_COMING_SOON_SUBLINE } from "@/lib/marketing-copy";
import { isNativeShell } from "@/lib/native-shell";

/**
 * Web marketing banner. Hidden inside the native app shell so App Store
 * reviewers never see Android / Play “coming soon” chrome (Guideline 2.3.10).
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
      <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-1.5 sm:gap-2">
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-base font-bold tracking-tight text-white sm:text-lg md:text-xl">
          <span className="inline-flex items-center gap-1.5">
            <Apple className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
            iOS
          </span>
          <span className="text-forward-300">&</span>
          <span className="inline-flex items-center gap-1.5">
            <Smartphone className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
            Android
          </span>
          <span className="w-full text-brand-cyan sm:w-auto">— coming very soon</span>
        </p>
        <p className="max-w-2xl text-xs text-forward-100 sm:text-sm">{APP_COMING_SOON_SUBLINE}</p>
      </div>
    </div>
  );
}
