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
      <div
        className="pointer-events-none select-none blur-[2.5px] opacity-70 saturate-75"
        aria-hidden
      >
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-forward-950/35 px-4 py-6 backdrop-blur-[1px]">
        <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-forward-950/90 px-4 py-4 text-center text-white shadow-xl">
          <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <Lock className="h-4 w-4" aria-hidden />
          </span>
          <p className="mt-3 font-display text-base font-semibold">{title}</p>
          <p className="mt-1.5 text-sm leading-snug text-forward-200">{body}</p>
          {note ? <p className="mt-1 text-xs text-forward-400">{note}</p> : null}
          {cta && onUnlock ? (
            <button
              type="button"
              onClick={onUnlock}
              className={buttonClassName({
                size: "sm",
                className: "mt-4 w-full",
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
