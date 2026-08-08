/**
 * Bubbly Route Orb visuals — animated glyphs for weather + road events.
 * Icons on the map; tap opens the detail card.
 */

import type {
  FamilyAirQuality,
  FamilyDriveEvent,
  FamilyDriveEventVisual,
} from "@forward/shared";

export function weatherVisualFromCode(code: number): FamilyDriveEventVisual {
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 51 && code <= 55) return "drizzle";
  if (code === 45 || code === 48) return "fog";
  if (code === 3) return "cloud";
  if (code === 2) return "partly_cloudy";
  return "sun";
}

export function trafficTone(
  severity: FamilyDriveEvent["severity"],
  speedKmh: number | null
): "green" | "yellow" | "red" {
  if (severity === "warning" || (speedKmh != null && speedKmh > 0 && speedKmh < 18)) {
    return "red";
  }
  if (severity === "watch") return "yellow";
  return "green";
}

export function airTone(
  aq: Pick<FamilyAirQuality, "level" | "severity">
): "green" | "yellow" | "red" {
  if (
    aq.level === "unhealthy" ||
    aq.level === "very_unhealthy" ||
    aq.level === "hazardous" ||
    aq.severity === "warning"
  ) {
    return "red";
  }
  if (aq.level === "moderate" || aq.level === "unhealthy_sensitive") {
    return "yellow";
  }
  return "green";
}

export function toneColor(tone: "green" | "yellow" | "red"): string {
  if (tone === "red") return "#ef4444";
  if (tone === "yellow") return "#eab308";
  return "#22c55e";
}

export function weatherOrbColor(visual: FamilyDriveEventVisual): string {
  switch (visual) {
    case "sun":
      return "#f59e0b";
    case "partly_cloudy":
      return "#38bdf8";
    case "cloud":
    case "fog":
      return "#94a3b8";
    case "drizzle":
    case "rain":
      return "#0ea5e9";
    case "snow":
      return "#7dd3fc";
    case "storm":
      return "#6366f1";
    default:
      return "#38bdf8";
  }
}

/** Inline SVG + CSS animation class for Leaflet DivIcon HTML. */
export function animatedOrbGlyph(visual: FamilyDriveEventVisual): string {
  switch (visual) {
    case "sun":
      return `<span class="orb-glyph orb-glyph--sun" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="26" height="26">
          <circle class="orb-sun-core" cx="16" cy="16" r="6" fill="#fff"/>
          <g class="orb-sun-rays" stroke="#fff" stroke-width="2" stroke-linecap="round">
            <path d="M16 3v4M16 25v4M3 16h4M25 16h4M6.5 6.5l2.8 2.8M22.7 22.7l2.8 2.8M6.5 25.5l2.8-2.8M22.7 9.3l2.8-2.8"/>
          </g>
        </svg>
      </span>`;
    case "partly_cloudy":
      return `<span class="orb-glyph orb-glyph--partly" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="26" height="26">
          <circle class="orb-sun-core" cx="11" cy="12" r="5" fill="#fff"/>
          <path class="orb-cloud" d="M10 22a5 5 0 1 1 1.4-9.8A6.2 6.2 0 0 1 24 15a4.2 4.2 0 0 1-.1 8.2H10z" fill="#fff"/>
        </svg>
      </span>`;
    case "cloud":
    case "fog":
      return `<span class="orb-glyph orb-glyph--cloud" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="26" height="26">
          <path class="orb-cloud" d="M8 22a5.5 5.5 0 1 1 1.5-10.8A7 7 0 0 1 24 14.5a4.5 4.5 0 0 1 0 9H8z" fill="#fff"/>
          ${
            visual === "fog"
              ? `<g class="orb-fog" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".85">
                  <path d="M7 26h12M11 28.5h10"/>
                </g>`
              : ""
          }
        </svg>
      </span>`;
    case "drizzle":
    case "rain":
      return `<span class="orb-glyph orb-glyph--rain" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="26" height="26">
          <path class="orb-cloud" d="M8 16a5 5 0 1 1 1.3-9.8A6.5 6.5 0 0 1 23 9.5a4 4 0 0 1 0 8H8z" fill="#fff"/>
          <g class="orb-drops" stroke="#fff" stroke-width="1.8" stroke-linecap="round">
            <path d="M10 20v4M15 19v5M20 20v4"/>
          </g>
        </svg>
      </span>`;
    case "snow":
      return `<span class="orb-glyph orb-glyph--snow" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="26" height="26">
          <path class="orb-cloud" d="M8 15a5 5 0 1 1 1.3-9.8A6.5 6.5 0 0 1 23 8.5a4 4 0 0 1 0 8H8z" fill="#fff"/>
          <g class="orb-flakes" fill="#fff">
            <circle cx="11" cy="22" r="1.4"/>
            <circle cx="16" cy="24" r="1.4"/>
            <circle cx="21" cy="21.5" r="1.4"/>
          </g>
        </svg>
      </span>`;
    case "storm":
      return `<span class="orb-glyph orb-glyph--storm" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="26" height="26">
          <path class="orb-cloud" d="M8 14a5 5 0 1 1 1.3-9.8A6.5 6.5 0 0 1 23 7.5a4 4 0 0 1 0 8H8z" fill="#fff"/>
          <path class="orb-bolt" d="M15 15 11 22h4l-1.5 6L21 18h-4l2-3z" fill="#fde047"/>
        </svg>
      </span>`;
    case "traffic":
      // Red car — matches Family Intelligence mockup
      return `<span class="orb-glyph orb-glyph--traffic" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="24" height="24">
          <path fill="#fff" d="M7 14.5 9.2 9.8A3 3 0 0 1 12 8h8a3 3 0 0 1 2.8 1.8L25 14.5V22a1.5 1.5 0 0 1-1.5 1.5h-1a2.5 2.5 0 0 1-5 0h-4a2.5 2.5 0 0 1-5 0h-1A1.5 1.5 0 0 1 7 22v-7.5z"/>
          <circle cx="11.5" cy="23.5" r="2.2" fill="#fff" opacity=".95"/>
          <circle cx="20.5" cy="23.5" r="2.2" fill="#fff" opacity=".95"/>
          <path fill="#fff" opacity=".55" d="M11 10.2h10l1.4 3.2H9.6L11 10.2z"/>
        </svg>
      </span>`;
    case "air":
      return `<span class="orb-glyph orb-glyph--air" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round">
          <path class="orb-air-wave" d="M5 12h12a3.5 3.5 0 1 0 0-7H12"/>
          <path class="orb-air-wave" d="M5 20h16a3.5 3.5 0 1 0 0-7h-2"/>
          <path d="M5 7h3"/>
        </svg>
      </span>`;
    case "construction":
      // Orange traffic cone
      return `<span class="orb-glyph orb-glyph--construction" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="24" height="24">
          <path fill="#fff" d="M8 26h16l-1.2-3H9.2L8 26z"/>
          <path fill="#fff" d="M12.2 8h7.6L22.8 23H9.2L12.2 8z"/>
          <path class="orb-cone-stripe" fill="currentColor" d="M11.2 15h9.6l.7 3H10.5l.7-3z" style="color:rgb(255 255 255 / 0.35)"/>
          <path fill="#fff" opacity=".9" d="M13.4 9.2h5.2l.5 2.2h-6.2l.5-2.2z"/>
          <rect x="14.5" y="5" width="3" height="3.2" rx="1" fill="#fff"/>
        </svg>
      </span>`;
    case "accident":
      // Purple crash / colliding cars
      return `<span class="orb-glyph orb-glyph--accident" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="24" height="24">
          <g class="orb-crash-burst" fill="#fff">
            <path d="M16 4v4M16 24v4M4 16h4M24 16h4M7.5 7.5l2.5 2.5M22 22l2.5 2.5M7.5 24.5 10 22M22 10l2.5-2.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
          </g>
          <path fill="#fff" d="M5 17.5 6.8 13.8A2 2 0 0 1 8.6 12.5h5.2a2 2 0 0 1 1.8 1.3L17 17.5V22a1 1 0 0 1-1 1h-.8a1.8 1.8 0 0 1-3.4 0H9.2a1.8 1.8 0 0 1-3.4 0H5a1 1 0 0 1-1-1v-4.5z"/>
          <path fill="#fff" d="M15 14.5 16.8 10.8A2 2 0 0 1 18.6 9.5h5.2a2 2 0 0 1 1.8 1.3L27 14.5V19a1 1 0 0 1-1 1h-.8a1.8 1.8 0 0 1-3.4 0h-2.6a1.8 1.8 0 0 1-3.4 0H15a1 1 0 0 1-1-1v-4.5z"/>
        </svg>
      </span>`;
    case "closure":
      // Red no-entry / closed road
      return `<span class="orb-glyph orb-glyph--closure" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="24" height="24">
          <circle cx="16" cy="16" r="11" fill="none" stroke="#fff" stroke-width="2.6"/>
          <rect class="orb-closure-bar" x="8" y="14.2" width="16" height="3.6" rx="1.8" fill="#fff"/>
        </svg>
      </span>`;
    case "hazard":
      // Yellow warning triangle
      return `<span class="orb-glyph orb-glyph--hazard" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="24" height="24">
          <path fill="#fff" d="M16 5.5 28 26.5H4L16 5.5z"/>
          <path class="orb-hazard-bang" fill="#ca8a04" d="M15 13h2v7h-2zm0 9h2v2h-2z"/>
        </svg>
      </span>`;
    case "police":
      // Blue shield
      return `<span class="orb-glyph orb-glyph--police" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="24" height="24">
          <path class="orb-shield" fill="#fff" d="M16 4.5 26.5 9.5v6.2c0 6.4-4.5 10.2-10.5 11.8C9.9 25.9 5.5 22.1 5.5 15.7V9.5L16 4.5z"/>
          <path fill="currentColor" d="M16 10.2 20.5 12v3.2c0 3.2-2 5.1-4.5 5.9-2.5-.8-4.5-2.7-4.5-5.9V12L16 10.2z" style="color:rgb(59 130 246 / 0.55)"/>
        </svg>
      </span>`;
    default:
      // Pink event / other star
      return `<span class="orb-glyph orb-glyph--other" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="22" height="22">
          <path class="orb-star" fill="#fff" d="M16 5l2.9 8.4H28l-7.5 5.3 2.9 8.3L16 21.8 8.6 27l2.9-8.3L4 13.4h9.1L16 5z"/>
        </svg>
      </span>`;
  }
}

export function resolveVisual(event: FamilyDriveEvent): FamilyDriveEventVisual {
  if (event.visual) return event.visual;
  if (event.kind === "weather") return "cloud";
  if (event.kind === "traffic") return "traffic";
  if (event.kind === "air") return "air";
  if (event.kind === "construction") return "construction";
  if (event.kind === "accident") return "accident";
  if (event.kind === "closure") return "closure";
  if (event.kind === "hazard") return "hazard";
  if (event.kind === "police") return "police";
  return "other";
}

/**
 * All orbs are bubbly icon chips on the map.
 * Weather / air / traffic keep a value badge; road alerts may show distance.
 */
export function isCompactConditionOrb(_event: FamilyDriveEvent): boolean {
  return true;
}

/** Optional distance caption for road alerts when we have km ahead. */
export function orbDistanceBadge(event: FamilyDriveEvent): string | null {
  if (event.badge?.trim()) return event.badge.trim();
  if (event.distanceAheadKm != null && event.distanceAheadKm > 0) {
    const km = event.distanceAheadKm;
    return km >= 10 ? `${Math.round(km)}` : km.toFixed(1);
  }
  return null;
}
