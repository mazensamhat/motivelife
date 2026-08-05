/**
 * Visual-only map prefs for saved places.
 * Places stay saved for geofences / ETA either way.
 */
export type PlaceLabelsMode = "off" | "ghost" | "on";

const PLACE_LABELS_KEY = "motivelife.familyPlaceLabelsMode";
const PLACE_FENCES_KEY = "motivelife.familyPlaceFencesOn";

export function readPlaceLabelsMode(): PlaceLabelsMode {
  if (typeof window === "undefined") return "ghost";
  try {
    const raw = window.localStorage.getItem(PLACE_LABELS_KEY);
    if (raw === "off" || raw === "ghost" || raw === "on") return raw;
  } catch {
    // ignore
  }
  // Default ghost — remembered, but not map clutter.
  return "ghost";
}

export function writePlaceLabelsMode(mode: PlaceLabelsMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PLACE_LABELS_KEY, mode);
  } catch {
    // ignore
  }
}

/** Geofence rings on the live map — off by default. */
export function readPlaceFencesPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PLACE_FENCES_KEY) === "1";
  } catch {
    return false;
  }
}

export function writePlaceFencesPreference(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(PLACE_FENCES_KEY, "1");
    else window.localStorage.removeItem(PLACE_FENCES_KEY);
  } catch {
    // ignore
  }
}
