"use client";

import { useMemo } from "react";
import type { FamilyDriveImpact, FamilyMapState } from "@forward/shared";
import { Sparkles } from "lucide-react";
import { pickKinzoAttention } from "@/lib/family-map/kinzo-attention";

/**
 * Compact map attention chip — one short pill, not a card over the map.
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
      ? "bg-violet-600/92 ring-violet-200/35"
      : attention.tone === "amber"
        ? "bg-amber-600/92 ring-amber-200/35"
        : attention.tone === "sky"
          ? "bg-sky-600/92 ring-sky-200/35"
          : "bg-emerald-600/92 ring-emerald-200/35";

  // Prefer the short badge on the map; fall back to a clipped title.
  const line =
    attention.badge.length <= 18
      ? attention.badge
      : attention.title.length > 28
        ? `${attention.title.slice(0, 27)}…`
        : attention.title;

  return (
    <button
      type="button"
      onClick={() => onOpen?.(attention.memberId)}
      title={[attention.title, attention.detail].filter(Boolean).join(" · ")}
      className={`pointer-events-auto inline-flex max-w-[min(72vw,16rem)] items-center gap-1.5 rounded-full px-2.5 py-1 text-left text-white shadow-[0_8px_18px_-10px_rgba(15,23,42,0.55)] ring-1 backdrop-blur-md ${tone}`}
      aria-label={`KINZO: ${attention.title}`}
    >
      <Sparkles className="h-3 w-3 shrink-0 opacity-90" strokeWidth={2.4} />
      <span className="truncate text-[11px] font-semibold leading-none tracking-wide">
        {line}
      </span>
    </button>
  );
}
