/**
 * How saved-place name chips appear on the live map.
 * Places stay saved for geofences / ETA either way — this is visual only.
 */
export type PlaceLabelsMode = "off" | "ghost" | "on";

const PLACE_LABELS_KEY = "motivelife.familyPlaceLabelsMode";

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

export function cyclePlaceLabelsMode(mode: PlaceLabelsMode): PlaceLabelsMode {
  if (mode === "off") return "ghost";
  if (mode === "ghost") return "on";
  return "off";
}

export function placeLabelsModeLabel(mode: PlaceLabelsMode): string {
  if (mode === "off") return "Hidden";
  if (mode === "ghost") return "Faded";
  return "Shown";
}
