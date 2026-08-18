/**
 * Android IME (and some Fold keyboards) shrink the WebView height without
 * changing width. Leaflet invalidateSize + dock height math on that path
 * is what makes "name a place" hitch.
 */
export function isKeyboardOnlyViewportChange(
  prev: { w: number; h: number },
  next: { w: number; h: number }
) {
  const widthStable = Math.abs(next.w - prev.w) < 12;
  const heightDelta = Math.abs(next.h - prev.h);
  return widthStable && heightDelta >= 72;
}

export function viewportSize() {
  return {
    w: typeof window !== "undefined" ? window.innerWidth || 0 : 0,
    h: typeof window !== "undefined" ? window.innerHeight || 0 : 0,
  };
}
