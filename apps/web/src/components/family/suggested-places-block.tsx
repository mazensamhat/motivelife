"use client";

import { useState } from "react";
import type { FamilyMapState, FamilyPlaceCategory, FamilySuggestedPlace } from "@forward/shared";
import { MapPin, Sparkles } from "lucide-react";

const CATEGORIES: Array<{ id: FamilyPlaceCategory; label: string }> = [
  { id: "work", label: "Work" },
  { id: "school", label: "School" },
  { id: "home", label: "Family" },
  { id: "other", label: "Other" },
];

/**
 * KINZO noticed frequent unsaved stops — one-tap save into Places.
 */
export function SuggestedPlacesBlock({
  suggestions,
  onSaved,
}: {
  suggestions: FamilySuggestedPlace[];
  onSaved?: (state: FamilyMapState) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  const visible = suggestions.filter((s) => !dismissed.has(s.id));
  if (!visible.length) return null;

  async function save(s: FamilySuggestedPlace, category: FamilyPlaceCategory) {
    setBusyId(s.id);
    setError(null);
    try {
      const name =
        s.label && !/^frequent place$/i.test(s.label)
          ? s.label.slice(0, 80)
          : category === "work"
            ? "Work"
            : category === "school"
              ? "School"
              : category === "home"
                ? "Family place"
                : "Saved place";
      const res = await fetch("/api/family/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          lat: s.lat,
          lng: s.lng,
          category,
          radiusM: 120,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Couldn’t save that place.");
        return;
      }
      const next = (await res.json()) as FamilyMapState;
      setDismissed((prev) => new Set(prev).add(s.id));
      onSaved?.(next);
    } catch {
      setError("Couldn’t save that place.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mb-3 space-y-2">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-700">
        <span className="inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Kinzo noticed
        </span>
      </p>
      {visible.map((s) => (
        <div
          key={s.id}
          className="rounded-2xl bg-violet-50/90 px-3 py-2.5 ring-1 ring-violet-100"
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 ring-1 ring-violet-100">
              <MapPin className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-forward-900">{s.label}</p>
              <p className="mt-0.5 text-[11px] text-forward-600">
                {s.visitCount} visits
                {s.memberCount > 1 ? ` · ${s.memberCount} people` : ""}
                {s.usualWindowLabel ? ` · ${s.usualWindowLabel}` : ""}
              </p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-forward-400">
                Save as
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={busyId === s.id}
                    onClick={() => void save(s, c.id)}
                    className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-violet-800 ring-1 ring-violet-100 disabled:opacity-50"
                  >
                    {c.label}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={busyId === s.id}
                  onClick={() =>
                    setDismissed((prev) => new Set(prev).add(s.id))
                  }
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-forward-500"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
      {error ? <p className="px-1 text-[11px] text-amber-800">{error}</p> : null}
    </div>
  );
}
