"use client";

import { useCallback, useEffect, useState } from "react";
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
import type { HistoryRange } from "@/lib/family-map/history";
import type { PlaceIntelStats } from "@/lib/family-map/place-intel";

export type PlaceSheetMode = "menu" | "rename" | "icon" | "alerts" | "resize";

const RANGE_CHIPS: Array<{ id: HistoryRange; label: string }> = [
  { id: "day", label: "Today" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
  { id: "all", label: "All" },
];

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
  const [localError, setLocalError] = useState<string | null>(null);
  const [range, setRange] = useState<HistoryRange>("month");
  const [stats, setStats] = useState<PlaceIntelStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => setPortalReady(true), []);
  useEffect(() => {
    setName(place.name);
    setCategory(place.category);
    setNotifyOnEnter(place.notifyOnEnter !== false);
    setNotifyOnLeave(place.notifyOnLeave !== false);
    setLocalError(null);
    setRange("month");
    setStats(null);
    setStatsError(null);
  }, [place.id, place.name, place.category, place.notifyOnEnter, place.notifyOnLeave]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const tz = new Date().getTimezoneOffset();
      const res = await fetch(
        `/api/family/places/${encodeURIComponent(place.id)}/stats?range=${encodeURIComponent(range)}&tzOffsetMinutes=${tz}`
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          code?: string;
        } | null;
        if (res.status === 402 || data?.code === "PREMIUM_REQUIRED") {
          setStats(null);
          setStatsError(null);
          return;
        }
        setStatsError(data?.error ?? "Could not load place visits.");
        setStats(null);
        return;
      }
      const data = (await res.json()) as { stats: PlaceIntelStats };
      setStats(data.stats);
    } catch {
      setStatsError("Could not load place visits.");
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [place.id, range]);

  useEffect(() => {
    if (mode !== "menu") return;
    void loadStats();
  }, [mode, loadStats]);

  function fail(msg: string) {
    setLocalError(msg);
    onError(msg);
  }

  /**
   * Persist place edits. OK always dismisses back to the map (closeAfter default),
   * so rename / resize / alerts don’t leave you stuck in a sub-sheet.
   */
  async function patch(body: Record<string, unknown>, closeAfter = true) {
    setSaving(true);
    setLocalError(null);
    try {
      const res = await fetch("/api/family/places", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: place.id, ...body }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        fail(data?.error ?? "Could not update place.");
        return false;
      }
      const next = (await res.json()) as FamilyMapState;
      try {
        onSaved(next);
      } catch {
        // Still dismiss — a parent state hiccup must not trap the sheet open.
      }
      if (closeAfter) onClose();
      else onModeChange("menu");
      return true;
    } catch {
      fail("Could not update place.");
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
      fail("Give this place a name.");
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
              onClick={() => {
                setLocalError(null);
                onModeChange("menu");
              }}
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
          {localError ? (
            <p className="mt-2 text-[11px] font-medium text-rose-200">{localError}</p>
          ) : null}
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
                onClick={() => {
                  setLocalError(null);
                  onModeChange("menu");
                }}
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
                  ? "Place intelligence & settings"
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

        <div className="max-h-[min(62vh,520px)] space-y-3 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {localError ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800 ring-1 ring-rose-100">
              {localError}
            </p>
          ) : null}
          {mode === "menu" ? (
            <>
              <PlaceIntelBlock
                place={place}
                range={range}
                onRangeChange={setRange}
                stats={stats}
                loading={statsLoading}
                error={statsError}
              />
              <ul className="divide-y divide-forward-100 overflow-hidden rounded-[1.25rem] bg-forward-50/60 ring-1 ring-forward-100">
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
            </>
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
              <div className="space-y-2 rounded-2xl bg-forward-50 px-3 py-3 ring-1 ring-forward-100">
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

function PlaceIntelBlock({
  place,
  range,
  onRangeChange,
  stats,
  loading,
  error,
}: {
  place: FamilyPlaceView;
  range: HistoryRange;
  onRangeChange: (r: HistoryRange) => void;
  stats: PlaceIntelStats | null;
  loading: boolean;
  error: string | null;
}) {
  const visitCount = stats?.visitCount ?? place.visitCount;
  const avgStay = stats?.averageDwellMinutes ?? place.averageVisitMinutes;
  const topVisitor = stats?.topVisitorName ?? place.mostCommonVisitorName;
  const lastVisit = stats?.lastVisitedAt ?? place.lastVisitedAt;

  return (
    <div className="space-y-2.5 rounded-[1.25rem] bg-sky-50/80 px-3 py-3 ring-1 ring-sky-100">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-800">
          Place intelligence
        </p>
        {place.insight ? (
          <p className="truncate text-[10px] font-medium text-sky-700">{place.insight}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {RANGE_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => onRangeChange(chip.id)}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              range === chip.id
                ? "bg-forward-900 text-white"
                : "bg-white text-forward-700 ring-1 ring-forward-100 hover:bg-forward-50"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <IntelChip label="Visits" value={visitCount > 0 ? String(visitCount) : "—"} />
        <IntelChip
          label="Avg stay"
          value={avgStay > 0 ? `${avgStay} min` : "—"}
        />
        <IntelChip
          label="Top visitor"
          value={
            topVisitor
              ? stats?.topVisitorCount
                ? `${topVisitor} (${stats.topVisitorCount})`
                : topVisitor
              : "—"
          }
        />
        <IntelChip
          label="Busiest day"
          value={
            stats?.busiestDayName
              ? `${stats.busiestDayName}${
                  stats.busiestDayCount ? ` (${stats.busiestDayCount})` : ""
                }`
              : "—"
          }
        />
      </div>

      {lastVisit ? (
        <p className="text-[11px] text-forward-600">
          Last visit{" "}
          {new Date(lastVisit).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      ) : (
        <p className="text-[11px] text-forward-500">No visits in this range yet.</p>
      )}

      {loading ? (
        <p className="text-[11px] text-forward-500">Loading visits…</p>
      ) : null}
      {error ? <p className="text-[11px] text-amber-800">{error}</p> : null}

      {stats && stats.visitorBreakdown.length > 0 ? (
        <ul className="space-y-1">
          {stats.visitorBreakdown.slice(0, 4).map((v) => (
            <li
              key={v.memberId}
              className="flex items-center gap-2 rounded-xl bg-white/80 px-2.5 py-1.5 text-xs text-forward-800"
            >
              <span
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: v.color }}
              >
                {v.displayName.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {v.displayName}
              </span>
              <span className="shrink-0 text-forward-500">
                {v.visitCount}×
                {v.totalDwellMinutes > 0 ? ` · ${v.totalDwellMinutes}m` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {stats && stats.visits.length > 0 ? (
        <ul className="max-h-36 space-y-1 overflow-y-auto border-t border-sky-100/80 pt-2">
          {stats.visits.slice(0, 12).map((v) => (
            <li key={v.id} className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="min-w-0 truncate font-medium text-forward-800">
                {v.memberName}
                {v.isActive ? " · there now" : ""}
              </span>
              <span className="shrink-0 text-forward-500">
                {new Date(v.arrivedAt).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {v.dwellMinutes > 0 ? ` · ${v.dwellMinutes}m` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function IntelChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/90 px-2.5 py-2 ring-1 ring-white">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-forward-400">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-forward-900">{value}</p>
    </div>
  );
}
