"use client";

import { useState } from "react";
import type { FamilyMapState, FamilyPlaceCategory, FamilyPlaceView } from "@forward/shared";
import { MapPin, Trash2 } from "lucide-react";
import { Button } from "@/components/button";

const PLACE_PRESETS: Array<{ name: string; category: FamilyPlaceCategory }> = [
  { name: "Home", category: "home" },
  { name: "Work", category: "work" },
  { name: "School", category: "school" },
  { name: "Costco", category: "shop" },
  { name: "Grocery", category: "shop" },
  { name: "Gym", category: "sports" },
  { name: "Soccer", category: "sports" },
  { name: "Mosque", category: "other" },
];

const CATEGORY_LABELS: Record<FamilyPlaceCategory, string> = {
  home: "Home",
  work: "Work",
  school: "School",
  shop: "Shop",
  sports: "Sports",
  other: "Other",
};

type DraftCoords = { lat: number; lng: number; label: string } | null;

export function PlacesPanel({
  places,
  busy,
  draftFromMember,
  onClearDraft,
  onSaved,
  onError,
}: {
  places: FamilyPlaceView[];
  busy: boolean;
  draftFromMember: DraftCoords;
  onClearDraft: () => void;
  onSaved: (state: FamilyMapState) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("Home");
  const [category, setCategory] = useState<FamilyPlaceCategory>("home");
  const [saving, setSaving] = useState(false);

  function pickPreset(preset: (typeof PLACE_PRESETS)[number]) {
    setName(preset.name);
    setCategory(preset.category);
  }

  async function savePlace(coords: { lat: number; lng: number }) {
    const trimmed = name.trim();
    if (!trimmed) {
      onError("Give the place a name.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/family/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          lat: coords.lat,
          lng: coords.lng,
          category,
          radiusM: category === "home" ? 100 : category === "shop" ? 160 : 120,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        onError(data?.error ?? "Could not save place.");
        return;
      }
      onSaved((await res.json()) as FamilyMapState);
      onClearDraft();
    } catch {
      onError("Could not save place.");
    } finally {
      setSaving(false);
    }
  }

  async function saveHere() {
    if (draftFromMember) {
      await savePlace({ lat: draftFromMember.lat, lng: draftFromMember.lng });
      return;
    }
    if (!navigator.geolocation) {
      onError("Geolocation unavailable.");
      return;
    }
    setSaving(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void savePlace({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }).finally(() => setSaving(false));
      },
      () => {
        setSaving(false);
        onError("Allow location to save a place here.");
      },
      { enableHighAccuracy: true, timeout: 20_000 }
    );
  }

  async function removePlace(place: FamilyPlaceView) {
    if (!window.confirm(`Remove “${place.name}” from saved places?`)) return;
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
    } finally {
      setSaving(false);
    }
  }

  const disabled = busy || saving;

  return (
    <section className="rounded-2xl border border-forward-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-forward-900">Saved places</h3>
          <p className="mt-0.5 text-xs text-forward-500">
            Name Home, Work, Costco — the map learns arrivals from these.
          </p>
        </div>
        <MapPin className="mt-0.5 h-4 w-4 text-forward-400" />
      </div>

      {draftFromMember ? (
        <div className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-950">
          Saving at <span className="font-semibold">{draftFromMember.label}</span>’s spot. Name it
          below, then Save.
          <button
            type="button"
            className="ml-2 font-semibold underline"
            onClick={onClearDraft}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {PLACE_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => pickPreset(preset)}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
              name === preset.name
                ? "border-forward-900 bg-forward-900 text-white"
                : "border-forward-200 bg-forward-50 text-forward-700"
            }`}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-forward-200 px-3 py-2 text-sm"
          placeholder="Place name"
          maxLength={80}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as FamilyPlaceCategory)}
          className="rounded-lg border border-forward-200 px-3 py-2 text-sm"
        >
          {(Object.keys(CATEGORY_LABELS) as FamilyPlaceCategory[]).map((key) => (
            <option key={key} value={key}>
              {CATEGORY_LABELS[key]}
            </option>
          ))}
        </select>
        <Button type="button" disabled={disabled} onClick={() => void saveHere()}>
          {draftFromMember ? "Save spot" : "Save here"}
        </Button>
      </div>

      {places.length > 0 ? (
        <ul className="mt-4 divide-y divide-forward-100 rounded-xl border border-forward-100">
          {places.map((place) => (
            <li key={place.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-forward-900">
                  {place.name}{" "}
                  <span className="text-xs font-normal text-forward-500">
                    · {CATEGORY_LABELS[place.category]}
                  </span>
                </p>
                <p className="truncate text-xs text-forward-500">
                  {place.visitCount} visits
                  {place.membersHeadingThere
                    ? ` · ${place.membersHeadingThere} heading there`
                    : ""}
                  {place.insight ? ` · ${place.insight}` : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void removePlace(place)}
                className="rounded-lg p-2 text-forward-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove ${place.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-forward-500">
          No saved places yet. Tap a preset and Save here — or name a spot from someone’s pin.
        </p>
      )}
    </section>
  );
}
