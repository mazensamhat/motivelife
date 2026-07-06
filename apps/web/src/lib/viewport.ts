/** Tailwind-aligned viewport tiers for adaptive layouts. */
export type ViewportTier = "mobile" | "tablet" | "desktop";

export const VIEWPORT_BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
} as const;

export function viewportFromWidth(width: number): ViewportTier {
  if (width >= VIEWPORT_BREAKPOINTS.desktop) return "desktop";
  if (width >= VIEWPORT_BREAKPOINTS.tablet) return "tablet";
  return "mobile";
}

export function viewportLabel(tier: ViewportTier): string {
  switch (tier) {
    case "mobile":
      return "Phone";
    case "tablet":
      return "Tablet";
    case "desktop":
      return "Web";
  }
}
