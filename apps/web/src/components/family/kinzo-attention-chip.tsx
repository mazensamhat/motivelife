"use client";

import { useMemo } from "react";
import type { FamilyDriveImpact, FamilyMapState } from "@forward/shared";
import { Sparkles } from "lucide-react";
import { pickKinzoAttention } from "@/lib/family-map/kinzo-attention";

/**
 * Single map attention chip — KINZO picks one signal, never a stack of bubbles.
 */
export function KinzoAttentionChip({
  state,
  driveImpact,
  onOpen,
}: {
  state: FamilyMapState;
  driveImpact?: FamilyDriveImpact | null;
  onOpen?: (memberId: string | null) => void;
}) {
  const attention = useMemo(
    () => pickKinzoAttention(state, driveImpact),
    [state, driveImpact]
  );
  if (!attention) return null;

  const tone =
    attention.tone === "violet"
      ? {
          bg: "bg-violet-600/95",
          ring: "ring-violet-200/40",
          soft: "bg-violet-50 text-violet-800",
        }
      : attention.tone === "amber"
        ? {
            bg: "bg-amber-600/95",
            ring: "ring-amber-200/40",
            soft: "bg-amber-50 text-amber-900",
          }
        : attention.tone === "sky"
          ? {
              bg: "bg-sky-600/95",
              ring: "ring-sky-200/40",
              soft: "bg-sky-50 text-sky-900",
            }
          : {
              bg: "bg-emerald-600/95",
              ring: "ring-emerald-200/40",
              soft: "bg-emerald-50 text-emerald-900",
            };

  return (
    <button
      type="button"
      onClick={() => onOpen?.(attention.memberId)}
      className={`pointer-events-auto flex max-w-[min(92vw,22rem)] items-start gap-2.5 rounded-2xl px-3 py-2.5 text-left text-white shadow-[0_12px_28px_-12px_rgba(15,23,42,0.55)] ring-1 backdrop-blur-md ${tone.bg} ${tone.ring}`}
      aria-label={`KINZO: ${attention.title}`}
    >
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15">
        <Sparkles className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${tone.soft}`}
          >
            {attention.badge}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/70">
            Kinzo eye
          </span>
        </span>
        <span className="mt-0.5 block truncate text-sm font-semibold leading-snug">
          {attention.title}
        </span>
        {attention.detail ? (
          <span className="mt-0.5 block truncate text-[11px] text-white/80">
            {attention.detail}
          </span>
        ) : null}
      </span>
    </button>
  );
}
