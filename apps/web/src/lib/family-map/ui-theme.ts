/**
 * KINZO soft-UI design system — menus, sheets, lists, badges, and cards.
 *
 * Visual rules (from the KINZO style board):
 * 1. Rounded — friendly soft shapes
 * 2. Vibrant — meaningful saturated category colors
 * 3. Glowing — soft colored outer glows / shadows
 * 4. Consistent — uniform icon weights
 * 5. Layered — glass over map, cards over glass
 * 6. Modern — breathable whitespace, minimal chrome
 *
 * Apply across ALL KINZO surfaces: dock, sheets, submenus, intel, driving, alerts.
 */

/** Semantic palette (boards + map overlays share these hexes). */
export const KINZO_UI = {
  people: "#3B82F6",
  peopleDeep: "#1D4ED8",
  places: "#F59E0B",
  placesDeep: "#D97706",
  intel: "#8B5CF6",
  intelDeep: "#6D28D9",
  driving: "#EF4444",
  drivingDeep: "#B91C1C",
  weather: "#0EA5E9",
  traffic: "#EF4444",
  construction: "#F97316",
  hazard: "#EAB308",
  safety: "#10B981",
  home: "#10B981",
  work: "#14B8A6",
  attention: "#EF4444",
  onTheWay: "#EAB308",
  ink: "#0F172A",
  muted: "#64748B",
  glass: "rgba(255,255,255,0.88)",
  glassSolid: "#FFFFFF",
} as const;

export type KinzoFeatureTone = "people" | "places" | "intel" | "driving";

export const KINZO_FEATURE: Record<
  KinzoFeatureTone,
  { hex: string; deep: string; gradient: string; glow: string; label: string }
> = {
  people: {
    hex: KINZO_UI.people,
    deep: KINZO_UI.peopleDeep,
    gradient: "linear-gradient(145deg, #60A5FA 0%, #3B82F6 48%, #2563EB 100%)",
    glow: "0 10px 24px -8px rgba(59,130,246,0.55)",
    label: "People",
  },
  places: {
    hex: KINZO_UI.places,
    deep: KINZO_UI.placesDeep,
    gradient: "linear-gradient(145deg, #FCD34D 0%, #F59E0B 52%, #EA580C 100%)",
    glow: "0 10px 24px -8px rgba(245,158,11,0.5)",
    label: "Places",
  },
  intel: {
    hex: KINZO_UI.intel,
    deep: KINZO_UI.intelDeep,
    gradient: "linear-gradient(145deg, #C084FC 0%, #8B5CF6 48%, #6D28D9 100%)",
    glow: "0 10px 24px -8px rgba(139,92,246,0.55)",
    label: "Family Intelligence",
  },
  driving: {
    hex: KINZO_UI.driving,
    deep: KINZO_UI.drivingDeep,
    gradient: "linear-gradient(145deg, #FB7185 0%, #EF4444 48%, #B91C1C 100%)",
    glow: "0 10px 24px -8px rgba(239,68,68,0.55)",
    label: "Driving Report",
  },
};

/** Soft glass sheet / card / row tokens (Tailwind class strings). */
export const KINZO_SHEET =
  "kinzo-sheet relative overflow-hidden rounded-t-[1.75rem] bg-white/92 shadow-[0_-16px_48px_-20px_rgba(15,23,42,0.35)] ring-1 ring-white/80 backdrop-blur-xl";

export const KINZO_SHEET_SOLID =
  "kinzo-sheet relative overflow-hidden rounded-t-[1.75rem] bg-white shadow-[0_-16px_48px_-20px_rgba(15,23,42,0.35)] ring-1 ring-forward-100/80";

export const FAMILY_BUBBLE_CARD =
  "kinzo-card relative overflow-hidden rounded-[1.35rem] bg-white/95 p-4 shadow-[0_12px_32px_-18px_rgba(15,23,42,0.28)] ring-1 ring-forward-100/70";

export const FAMILY_BUBBLE_CARD_PADDED =
  "kinzo-card relative overflow-hidden rounded-[1.35rem] bg-white/95 px-5 py-5 shadow-[0_12px_32px_-18px_rgba(15,23,42,0.28)] ring-1 ring-forward-100/70";

export const FAMILY_BUBBLE_TILE =
  "rounded-2xl bg-forward-50/90 px-3 py-2.5 ring-1 ring-forward-100/70";

export const FAMILY_BUBBLE_PILL_ACTIVE =
  "rounded-full bg-forward-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm";

export const FAMILY_BUBBLE_PILL =
  "rounded-full bg-forward-100/90 px-2.5 py-1 text-[11px] font-semibold text-forward-700 transition hover:bg-forward-200";

export const FAMILY_BUBBLE_ROW =
  "kinzo-row flex w-full items-center gap-3 rounded-2xl bg-forward-50/60 px-3 py-2.5 text-left ring-1 ring-forward-100/60 transition hover:bg-white hover:shadow-[0_8px_20px_-14px_rgba(15,23,42,0.35)]";

export const KINZO_SECTION =
  "kinzo-card relative overflow-hidden rounded-[1.35rem] bg-white/95 p-4 shadow-[0_10px_28px_-18px_rgba(15,23,42,0.22)] ring-1 ring-forward-100/80";

export const KINZO_SECTION_MUTED =
  "kinzo-card relative overflow-hidden rounded-[1.35rem] bg-forward-50/80 p-4 shadow-sm ring-1 ring-forward-100/80";

export const KINZO_ICON_BTN =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/92 text-forward-700 shadow-[0_8px_20px_-12px_rgba(15,23,42,0.4)] ring-1 ring-white/80 backdrop-blur-md transition hover:bg-white";

export const KINZO_CHROME_PILL =
  "inline-flex items-center rounded-full bg-white/92 px-3 py-1.5 text-[11px] font-semibold text-forward-800 shadow-[0_8px_20px_-12px_rgba(15,23,42,0.35)] ring-1 ring-white/80 backdrop-blur-md";

/** Intelligence bubble (toast / condition card). */
export const KINZO_INTEL_BUBBLE =
  "kinzo-intel-bubble flex max-w-full items-center gap-2.5 rounded-2xl bg-white/95 px-3 py-2.5 text-left shadow-[0_12px_28px_-14px_rgba(15,23,42,0.3)] ring-1 ring-forward-100/80";

export type CountSeverity = "calm" | "watch" | "alert";

export function countSeverity(n: number): CountSeverity {
  if (n <= 0) return "calm";
  if (n <= 3) return "watch";
  return "alert";
}

export type KinzoStatusKind =
  | "home"
  | "place"
  | "driving"
  | "onTheWay"
  | "work"
  | "attention"
  | "idle";

export type KinzoStatusMeta = {
  kind: KinzoStatusKind;
  label: string;
  hex: string;
  softBg: string;
  softText: string;
};

/**
 * Map a family member's live presence into the KINZO status badge language.
 */
export function kinzoStatusForMember(m: {
  presence?: string | null;
  placeName?: string | null;
  placeCategory?: string | null;
  needsAttention?: boolean | null;
}): KinzoStatusMeta {
  if (m.needsAttention) {
    return {
      kind: "attention",
      label: "Needs attention",
      hex: KINZO_UI.attention,
      softBg: "bg-red-50",
      softText: "text-red-700",
    };
  }
  const presence = (m.presence ?? "").toLowerCase();
  if (presence === "driving") {
    return {
      kind: "driving",
      label: "Driving",
      hex: KINZO_UI.people,
      softBg: "bg-sky-50",
      softText: "text-sky-800",
    };
  }
  if (presence === "moving") {
    return {
      kind: "onTheWay",
      label: "On the way",
      hex: KINZO_UI.onTheWay,
      softBg: "bg-amber-50",
      softText: "text-amber-900",
    };
  }
  const cat = (m.placeCategory ?? "").toLowerCase();
  const name = (m.placeName ?? "").toLowerCase();
  if (cat === "home" || name === "home" || /\bhome\b/.test(name)) {
    return {
      kind: "home",
      label: "At Home",
      hex: KINZO_UI.home,
      softBg: "bg-emerald-50",
      softText: "text-emerald-800",
    };
  }
  if (cat === "work" || /\bwork\b|\boffice\b/.test(name)) {
    return {
      kind: "work",
      label: "At Work",
      hex: KINZO_UI.work,
      softBg: "bg-teal-50",
      softText: "text-teal-800",
    };
  }
  if (m.placeName) {
    return {
      kind: "place",
      label: m.placeName.length > 16 ? `${m.placeName.slice(0, 14)}…` : m.placeName,
      hex: KINZO_UI.intel,
      softBg: "bg-violet-50",
      softText: "text-violet-800",
    };
  }
  return {
    kind: "idle",
    label: "Nearby",
    hex: KINZO_UI.muted,
    softBg: "bg-forward-50",
    softText: "text-forward-600",
  };
}

export function kinzoStatusBadgeClass(meta: KinzoStatusMeta): string {
  return `kinzo-status-badge inline-flex max-w-[9.5rem] items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold leading-none ${meta.softBg} ${meta.softText}`;
}
