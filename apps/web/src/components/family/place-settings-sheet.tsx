"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { FamilyMapState, FamilyPlaceCategory, FamilyPlaceView } from "@forward/shared";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/button";
import {
  CATEGORY_EMOJI,
  CATEGORY_LABELS,
  PLACE_ICON_PRESETS,
} from "@/components/family/save-pin-sheet";

/** Focused sheet: rename, icon, geofence radius + alerts. Nothing household-wide. */
export function PlaceSettingsSheet({
  place,
  busy,
  onClose,
  onSaved,
  onError,
}: {
  place: FamilyPlaceView;
  busy: boolean;
  onClose: () => void;
  onSaved: (state: FamilyMapState) => void;
  onError: (msg: string) => void;
}) {
  const [portalReady, setPortalReady] = useState(false);
  const [name, setName] = useState(place.name);
  const [category, setCategory] = useState<FamilyPlaceCategory>(place.category);
  const [radiusM, setRadiusM] = useState(Math.round(place.radiusM));
  const [notifyOnEnter, setNotifyOnEnter] = useState(place.notifyOnEnter !== false);
  const [notifyOnLeave, setNotifyOnLeave] = useState(place.notifyOnLeave !== false);
  const [saving, setSaving] = useState(false);

  useEffect(() => setPortalReady(true), []);
  useEffect(() => {
    setName(place.name);
    setCategory(place.category);
    setRadiusM(Math.round(place.radiusM));
    setNotifyOnEnter(place.notifyOnEnter !== false);
    setNotifyOnLeave(place.notifyOnLeave !== false);
  }, [place]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      onError("Give this place a name.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/family/places", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: place.id,
          name: trimmed,
          category,
          radiusM,
          notifyOnEnter,
          notifyOnLeave,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        onError(data?.error ?? "Could not update place.");
        return;
      }
      onSaved((await res.json()) as FamilyMapState);
      onClose();
    } catch {
      onError("Could not update place.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove “${place.name}” and its geofence?`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/family/places", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: place.id }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        onError(data?.error ?? "Could not remove place.");
        return;
      }
      onSaved((await res.json()) as FamilyMapState);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!portalReady) return null;

  const disabled = busy || saving;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[min(85vh,640px)] overflow-y-auto rounded-t-3xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-forward-100 bg-white px-4 py-3">
          <div>
            <p className="font-display text-base font-semibold text-forward-900">
              {CATEGORY_EMOJI[category]} {place.name}
            </p>
            <p className="text-xs text-forward-500">Place &amp; geofence settings</p>
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
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-forward-500">
              Icon
            </p>
            <div className="flex flex-wrap gap-2">
              {PLACE_ICON_PRESETS.map((preset) => (
                <button
                  key={preset.category}
                  type="button"
                  disabled={disabled}
                  onClick={() => setCategory(preset.category)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    category === preset.category
                      ? "border-forward-900 bg-forward-900 text-white"
                      : "border-forward-200 bg-forward-50 text-forward-700"
                  }`}
                >
                  <span aria-hidden>{preset.emoji}</span>
                  {CATEGORY_LABELS[preset.category]}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wide text-forward-500">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-forward-200 px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-forward-900"
              maxLength={80}
            />
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wide text-forward-500">
            Geofence radius · {radiusM} m
            <input
              type="range"
              min={50}
              max={500}
              step={10}
              value={radiusM}
              onChange={(e) => setRadiusM(Number(e.target.value))}
              className="mt-2 w-full"
              disabled={disabled}
            />
            <span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-forward-500">
              Larger circle = earlier arrive / leave alerts around this spot.
            </span>
          </label>

          <div className="space-y-2 rounded-xl border border-forward-100 bg-forward-50 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-forward-500">
              Geofence alerts
            </p>
            <label className="flex items-center justify-between gap-3 text-sm text-forward-800">
              <span>Notify when someone arrives</span>
              <input
                type="checkbox"
                checked={notifyOnEnter}
                onChange={(e) => setNotifyOnEnter(e.target.checked)}
                disabled={disabled}
                className="h-4 w-4"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-forward-800">
              <span>Notify when someone leaves</span>
              <input
                type="checkbox"
                checked={notifyOnLeave}
                onChange={(e) => setNotifyOnLeave(e.target.checked)}
                disabled={disabled}
                className="h-4 w-4"
              />
            </label>
            <p className="text-[11px] text-forward-500">
              Leave alerts also power “hasn’t left yet” when someone stays past their usual time.
            </p>
          </div>

          {(place.visitCount > 0 || place.insight) && (
            <p className="text-xs text-forward-500">
              {place.visitCount} visits
              {place.averageVisitMinutes
                ? ` · avg ${place.averageVisitMinutes} min`
                : ""}
              {place.insight ? ` · ${place.insight}` : ""}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="flex-1"
              disabled={disabled}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={disabled}
              onClick={() => void remove()}
              className="inline-flex items-center gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
