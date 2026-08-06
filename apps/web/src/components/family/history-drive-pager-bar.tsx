"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Solid pager under the map while a history drive is open.
 * Not an overlay on Leaflet — always visible and tappable.
 * In expanded map mode, parent may pin this to the bottom of the fullscreen shell.
 */
export function HistoryDrivePagerBar({
  fromLabel,
  toLabel,
  whenLabel,
  index,
  total,
  canPrev,
  canNext,
  busy,
  onPrev,
  onNext,
  onClear,
  className,
}: {
  fromLabel: string;
  toLabel: string;
  whenLabel: string;
  index: number;
  total: number;
  canPrev: boolean;
  canNext: boolean;
  busy?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClear: () => void;
  className?: string;
}) {
  const position =
    total > 0 && index >= 0 ? `${index + 1} of ${total}` : total > 0 ? `— of ${total}` : "Loading drives…";

  return (
    <div
      className={
        className ??
        "mx-2 rounded-[1.25rem] bg-forward-900 px-2 py-2 text-white shadow-[0_12px_28px_-16px_rgba(10,25,48,0.55)] max-[380px]:mx-1.5 sm:mx-3"
      }
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={!canPrev || busy}
          aria-label="Newer drive"
          title="Newer drive"
          onClick={onPrev}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-forward-900 disabled:opacity-35"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[11px] font-semibold text-white/75">{whenLabel}</p>
          <p className="truncate text-sm font-semibold">
            {fromLabel} → {toLabel}
          </p>
          <p className="truncate text-[11px] text-white/70">{position}</p>
        </div>

        <button
          type="button"
          disabled={!canNext || busy}
          aria-label="Older drive"
          title="Older drive"
          onClick={onNext}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-forward-900 disabled:opacity-35"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        <button
          type="button"
          aria-label="Clear route"
          title="Clear route"
          onClick={onClear}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
