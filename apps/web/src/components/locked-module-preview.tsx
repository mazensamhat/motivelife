"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { buttonClassName } from "@/components/button";

/**
 * Blurred AI-module teaser with a lock — shows what upgrading unlocks.
 * Never use on the live Family Map (map stays the free hero).
 */
export function LockedModulePreview({
  title,
  body,
  note,
  cta,
  onUnlock,
  children,
  className = "",
}: {
  title: string;
  body: string;
  note?: string | null;
  cta?: string | null;
  onUnlock?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-forward-200 bg-white ${className}`}
    >
      {/* Keep content readable through blur — users should see what they’re missing. */}
      <div
        className="pointer-events-none select-none blur-[3px] opacity-90 saturate-90"
        aria-hidden
      >
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-forward-950/10 via-forward-950/25 to-forward-950/40 px-4 py-6">
        <div className="w-full max-w-xs rounded-2xl border border-white/25 bg-forward-950/88 px-4 py-3.5 text-center text-white shadow-xl backdrop-blur-sm">
          <span className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
            <Lock className="h-4 w-4" aria-hidden />
          </span>
          <p className="mt-2.5 font-display text-base font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-snug text-forward-200">{body}</p>
          {note ? <p className="mt-1 text-xs text-forward-400">{note}</p> : null}
          {cta && onUnlock ? (
            <button
              type="button"
              onClick={onUnlock}
              className={buttonClassName({
                size: "sm",
                className: "mt-3 w-full",
              })}
            >
              {cta}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
