"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type {
  FamilyMapState,
  FamilyPlaceCategory,
  FamilyPlaceShape,
  FamilyPlaceView,
} from "@forward/shared";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import { Button } from "@/components/button";
import {
  CATEGORY_EMOJI,
  CATEGORY_LABELS,
  PLACE_ICON_PRESETS,
} from "@/components/family/save-pin-sheet";
import type { EditableGeofenceDraft } from "@/components/family/editable-geofence";

export type PlaceSheetMode = "menu" | "rename" | "icon" | "alerts" | "resize";

/**
 * Cascading place sheet for phones:
 * - Root menu lists actions (rename, icon, resize, alerts, remove)
 * - Sub-screens are focused; resize is map-first (tiny OK bar only)
 */
export function PlaceSettingsSheet({
  place,
  draft,
  mode,
  busy,
  onClose,
  onModeChange,
  onDraftChange,
  onSaved,
  onError,
}: {
  place: FamilyPlaceView;
  draft: EditableGeofenceDraft;
  mode: PlaceSheetMode;
  busy: boolean;
  onClose: () => void;
  onModeChange: (mode: PlaceSheetMode) => void;
  onDraftChange: (next: EditableGeofenceDraft) => void;
  onSaved: (state: FamilyMapState) => void;
  onError: (msg: string) => void;
}) {
  const [portalReady, setPortalReady] = useState(false);
  const [name, setName] = useState(place.name);
  const [category, setCategory] = useState<FamilyPlaceCategory>(place.category);
  const [notifyOnEnter, setNotifyOnEnter] = useState(place.notifyOnEnter !== false);
  const [notifyOnLeave, setNotifyOnLeave] = useState(place.notifyOnLeave !== false);
  const [saving, setSaving] = useState(false);

  useEffect(() => setPortalReady(true), []);
  useEffect(() => {
    setName(place.name);
    setCategory(place.category);
    setNotifyOnEnter(place.notifyOnEnter !== false);
    setNotifyOnLeave(place.notifyOnLeave !== false);
  }, [place.id, place.name, place.category, place.notifyOnEnter, place.notifyOnLeave]);

  async function patch(body: Record<string, unknown>, closeAfter = false) {
    setSaving(true);
    try {
      const res = await fetch("/api/family/places", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: place.id, ...body }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        onError(data?.error ?? "Could not update place.");
        return false;
      }
      onSaved((await res.json()) as FamilyMapState);
      if (closeAfter) onClose();
      else onModeChange("menu");
      return true;
    } catch {
      onError("Could not update place.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveResize() {
    await patch({
      shape: draft.shape,
      radiusM: draft.radiusM,
      lat: draft.lat,
      lng: draft.lng,
    });
  }

  async function saveRename() {
    const trimmed = name.trim();
    if (!trimmed) {
      onError("Give this place a name.");
      return;
    }
    await patch({ name: trimmed });
  }

  async function saveIcon() {
    await patch({ category });
  }

  async function saveAlerts() {
    await patch({ notifyOnEnter, notifyOnLeave });
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
  const shape: FamilyPlaceShape = draft.shape === "square" ? "square" : "circle";
  const titleEmoji = CATEGORY_EMOJI[category] ?? "📍";

  // Resize mode: tiny bottom bar only — map stays clear for drag/resize.
  if (mode === "resize") {
    return createPortal(
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex flex-col justify-end">
        <div className="pointer-events-auto mx-auto mb-[max(0.75rem,env(safe-area-inset-bottom))] w-[min(100%-1.5rem,28rem)] rounded-2xl bg-forward-900 px-3 py-2.5 text-white shadow-2xl">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-white/15 p-2"
              aria-label="Back"
              disabled={disabled}
              onClick={() => onModeChange("menu")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">
                Resize {place.name}
              </p>
              <p className="truncate text-[10px] text-white/70">
                Drag pin to move · white handle to resize · {draft.radiusM}m
              </p>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void saveResize()}
              className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-forward-900"
            >
              {saving ? "…" : "OK"}
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            {(
              [
                ["circle", "Circle"],
                ["square", "Square"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => onDraftChange({ ...draft, shape: id })}
                className={`flex-1 rounded-xl px-2 py-1.5 text-xs font-semibold ${
                  shape === id ? "bg-white text-forward-900" : "bg-white/15 text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex flex-col justify-end">
      <div className="pointer-events-auto relative mx-auto w-full max-w-lg rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-forward-100 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {mode !== "menu" ? (
              <button
                type="button"
                className="rounded-full bg-forward-100 p-2 text-forward-700"
                aria-label="Back"
                onClick={() => onModeChange("menu")}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : null}
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold text-forward-900">
                {titleEmoji} {place.name}
              </p>
              <p className="text-xs text-forward-500">
                {mode === "menu"
                  ? "Choose what to change"
                  : mode === "rename"
                    ? "Rename this place"
                    : mode === "icon"
                      ? "Pick an icon"
                      : "Arrival & leave alerts"}
              </p>
            </div>
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

        <div className="max-h-[min(42vh,360px)] space-y-3 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {mode === "menu" ? (
            <ul className="divide-y divide-forward-100 overflow-hidden rounded-2xl border border-forward-100">
              {(
                [
                  ["rename", "Rename"],
                  ["icon", "Change icon"],
                  ["resize", "Resize geofence"],
                  ["alerts", "Arrival & leave alerts"],
                ] as const
              ).map(([id, label]) => (
                <li key={id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onModeChange(id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold text-forward-900 hover:bg-forward-50"
                  >
                    {label}
                    <ChevronRight className="h-4 w-4 text-forward-400" />
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void remove()}
                  className="flex w-full items-center gap-2 px-4 py-3.5 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove place
                </button>
              </li>
            </ul>
          ) : null}

          {mode === "rename" ? (
            <>
              <label className="block text-xs font-semibold uppercase tracking-wide text-forward-500">
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-forward-200 px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-forward-900"
                  maxLength={80}
                  autoFocus
                />
              </label>
              <Button type="button" className="w-full" disabled={disabled} onClick={() => void saveRename()}>
                {saving ? "Saving…" : "OK"}
              </Button>
            </>
          ) : null}

          {mode === "icon" ? (
            <>
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
              <Button type="button" className="w-full" disabled={disabled} onClick={() => void saveIcon()}>
                {saving ? "Saving…" : "OK"}
              </Button>
            </>
          ) : null}

          {mode === "alerts" ? (
            <>
              <div className="space-y-2 rounded-xl border border-forward-100 bg-forward-50 px-3 py-3">
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
              </div>
              <Button type="button" className="w-full" disabled={disabled} onClick={() => void saveAlerts()}>
                {saving ? "Saving…" : "OK"}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
