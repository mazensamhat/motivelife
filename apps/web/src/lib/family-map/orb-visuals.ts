/**
 * Compact Route Orb visuals — animated weather glyphs + green/yellow/red
 * traffic & air chips. Prefer icons over wordy titles on the map.
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
      return `<span class="orb-glyph orb-glyph--traffic" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="22" height="22">
          <rect x="5" y="14" width="6" height="10" rx="1.2" fill="#fff"/>
          <rect x="13" y="9" width="6" height="15" rx="1.2" fill="#fff"/>
          <rect x="21" y="4" width="6" height="20" rx="1.2" fill="#fff"/>
        </svg>
      </span>`;
    case "air":
      return `<span class="orb-glyph orb-glyph--air" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round">
          <path d="M5 12h12a3.5 3.5 0 1 0 0-7H12"/>
          <path d="M5 20h16a3.5 3.5 0 1 0 0-7h-2"/>
          <path d="M5 7h3"/>
        </svg>
      </span>`;
    case "construction":
      return `<span class="orb-glyph" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round">
          <path d="M12 28h8M13 28V14L9 6h14l-4 8v14"/><path d="M10 14h12"/>
        </svg>
      </span>`;
    case "accident":
      return `<span class="orb-glyph" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.2">
          <circle cx="11" cy="18" r="4"/><circle cx="21" cy="18" r="4"/>
          <path d="M7 18h3M18 18h3M14 10l2.5 5L19 10"/>
        </svg>
      </span>`;
    case "closure":
      return `<span class="orb-glyph" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.4">
          <circle cx="16" cy="16" r="10"/><path d="M9 9l14 14"/>
        </svg>
      </span>`;
    case "hazard":
      return `<span class="orb-glyph" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round">
          <path d="M16 5 28 26H4L16 5z"/><path d="M16 13v6M16 22.5h.01"/>
        </svg>
      </span>`;
    case "police":
      return `<span class="orb-glyph" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.2">
          <path d="M16 5 26 10v6c0 6-4.2 9.5-10 11-5.8-1.5-10-5-10-11v-6L16 5z"/>
        </svg>
      </span>`;
    default:
      return `<span class="orb-glyph" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="20" height="20" fill="#fff">
          <path d="M16 5l2.8 8.2H28l-7.4 5.2 2.8 8.2L16 21.4 8.6 26.4l2.8-8.2L4 13.2h9.2L16 5z"/>
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

/** Weather / air / traffic are icon+badge only; road alerts keep a short caption. */
export function isCompactConditionOrb(event: FamilyDriveEvent): boolean {
  return event.kind === "weather" || event.kind === "traffic" || event.kind === "air";
}
