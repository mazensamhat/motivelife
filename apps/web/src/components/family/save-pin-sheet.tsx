"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { FamilyMapState, FamilyPlaceCategory } from "@forward/shared";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/button";
import { authFetch } from "@/lib/auth-fetch";

export const PLACE_ICON_PRESETS: Array<{
  name: string;
  category: FamilyPlaceCategory;
  emoji: string;
}> = [
  { name: "Home", category: "home", emoji: "🏠" },
  { name: "Work", category: "work", emoji: "💼" },
  { name: "School", category: "school", emoji: "🏫" },
  { name: "Shop", category: "shop", emoji: "🛒" },
  { name: "Gym", category: "sports", emoji: "🏋️" },
  { name: "Other", category: "other", emoji: "📍" },
];

export const CATEGORY_LABELS: Record<FamilyPlaceCategory, string> = {
  home: "Home",
  work: "Work",
  school: "School",
  shop: "Shop",
  sports: "Sports",
  other: "Other",
};

export const CATEGORY_EMOJI: Record<FamilyPlaceCategory, string> = {
  home: "🏠",
  work: "💼",
  school: "🏫",
  shop: "🛒",
  sports: "🏋️",
  other: "📍",
};

function defaultRadius(category: FamilyPlaceCategory) {
  if (category === "home") return 100;
  if (category === "shop") return 160;
  if (category === "work" || category === "school") return 140;
  return 120;
}

/** Focused sheet: drop a pin → name it and save. */
export function SavePinSheet({
  draft,
  busy,
  onClose,
  onSaved,
  onError,
}: {
  draft: { lat: number; lng: number; label: string };
  busy: boolean;
  onClose: () => void;
  onSaved: (state: FamilyMapState) => void;
  onError: (msg: string) => void;
}) {
  const [portalReady, setPortalReady] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<FamilyPlaceCategory>("other");
  const [shape, setShape] = useState<"circle" | "square">("circle");
  const [notifyOnEnter, setNotifyOnEnter] = useState(true);
  const [notifyOnLeave, setNotifyOnLeave] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => setPortalReady(true), []);

  function fail(msg: string) {
    setLocalError(msg);
    onError(msg);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      fail("Give this place a name.");
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      const res = await authFetch("/api/family/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          lat: draft.lat,
          lng: draft.lng,
          category,
          shape,
          radiusM: defaultRadius(category),
          notifyOnEnter,
          notifyOnLeave,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (res.status === 401) {
          fail("Session expired — open Mode of Life once, then try saving again.");
        } else {
          fail(data?.error ?? "Could not save place.");
        }
        return;
      }
      const next = (await res.json()) as FamilyMapState;
      try {
        onSaved(next);
      } catch {
        // Parent state update must not keep the sheet open after a successful save.
      }
      onClose();
    } catch {
      fail("Could not save place.");
    } finally {
      setSaving(false);
    }
  }

  if (!portalReady) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-forward-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-blue" />
            <p className="font-display text-base font-semibold text-forward-900">Save place</p>
          </div>
          <button
            type="button"
            className="rounded-full bg-forward-100 p-2 text-forward-700"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <p className="text-xs text-forward-500">
            Pin dropped
            {draft.label ? (
              <>
                {" "}
                near <span className="font-semibold text-forward-700">{draft.label}</span>
              </>
            ) : null}
            . Name it and choose an icon.
          </p>
          {localError ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800 ring-1 ring-rose-100">
              {localError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {PLACE_ICON_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  setName(preset.name === "Other" ? name || "" : preset.name);
                  setCategory(preset.category);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  category === preset.category
                    ? "border-forward-900 bg-forward-900 text-white"
                    : "border-forward-200 bg-forward-50 text-forward-700"
                }`}
              >
                <span aria-hidden>{preset.emoji}</span>
                {preset.name}
              </button>
            ))}
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-forward-200 px-3 py-2.5 text-sm"
            placeholder="Place name (e.g. Work)"
            maxLength={80}
            autoFocus
          />

          <div className="flex gap-2">
            {(
              [
                ["circle", "Circle"],
                ["square", "Box"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setShape(id)}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${
                  shape === id
                    ? "border-forward-900 bg-forward-900 text-white"
                    : "border-forward-200 bg-forward-50 text-forward-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-2 rounded-xl bg-forward-50 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-forward-500">
              Geofence alerts
            </p>
            <label className="flex items-center justify-between gap-3 text-sm text-forward-800">
              <span>Notify when someone arrives</span>
              <input
                type="checkbox"
                checked={notifyOnEnter}
                onChange={(e) => setNotifyOnEnter(e.target.checked)}
                className="h-4 w-4"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-forward-800">
              <span>Notify when someone leaves</span>
              <input
                type="checkbox"
                checked={notifyOnLeave}
                onChange={(e) => setNotifyOnLeave(e.target.checked)}
                className="h-4 w-4"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={busy || saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={busy || saving || !name.trim()}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save spot"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
