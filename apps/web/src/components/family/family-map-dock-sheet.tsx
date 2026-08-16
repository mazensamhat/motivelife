"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { FamilyMapMemberView, FamilyMapState } from "@forward/shared";
import {
  BarChart3,
  Briefcase,
  Building2,
  Car,
  Clock,
  Footprints,
  Heart,
  Home,
  MapPin,
  Sparkles,
  Users,
  AlertTriangle,
} from "lucide-react";
import { memberPresenceSubtitle } from "@/lib/family-map/member-presence-label";
import {
  KINZO_FEATURE,
  KINZO_SHEET_SOLID,
  kinzoStatusBadgeClass,
  kinzoStatusForMember,
  type KinzoFeatureTone,
  type KinzoStatusKind,
} from "@/lib/family-map/ui-theme";

export type FamilyMapDockTab = "people" | "places" | "insights" | "driving";

function batteryTone(pct: number) {
  if (pct <= 20) return "bg-red-100 text-red-800";
  if (pct <= 35) return "bg-amber-100 text-amber-900";
  return "bg-emerald-100 text-emerald-800";
}

const TAB_TONE: Record<FamilyMapDockTab, KinzoFeatureTone> = {
  people: "people",
  places: "places",
  insights: "intel",
  driving: "driving",
};

const TABS: {
  id: FamilyMapDockTab;
  label: string;
  shortLabel: string;
  blurb: string;
  shortBlurb: string;
  Icon: typeof Users;
}[] = [
  {
    id: "people",
    label: "People",
    shortLabel: "People",
    blurb: "See everyone on the map.",
    shortBlurb: "Everyone on the map.",
    Icon: Users,
  },
  {
    id: "places",
    label: "Places",
    shortLabel: "Places",
    blurb: "Saved places & visits.",
    shortBlurb: "Saved places.",
    Icon: Home,
  },
  {
    id: "insights",
    label: "Family Intelligence",
    shortLabel: "Intel",
    blurb: "Insights that matter.",
    shortBlurb: "Insights.",
    Icon: Sparkles,
  },
  {
    id: "driving",
    label: "Driving Report",
    shortLabel: "Driving",
    blurb: "Safety, stats & weekly summary.",
    shortBlurb: "Safety & stats.",
    Icon: BarChart3,
  },
];

function StatusGlyph({ kind }: { kind: KinzoStatusKind }) {
  const cls = "h-2.5 w-2.5 shrink-0";
  if (kind === "home") return <Home className={cls} strokeWidth={2.5} />;
  if (kind === "work") return <Briefcase className={cls} strokeWidth={2.5} />;
  if (kind === "driving") return <Car className={cls} strokeWidth={2.5} />;
  if (kind === "onTheWay") return <Clock className={cls} strokeWidth={2.5} />;
  if (kind === "attention") return <AlertTriangle className={cls} strokeWidth={2.5} />;
  if (kind === "place") return <MapPin className={cls} strokeWidth={2.5} />;
  return <Footprints className={cls} strokeWidth={2.5} />;
}

const OPEN_MAX = 520;
const OPEN_RATIO = 0.55;
const OPEN_RATIO_COVER = 0.7;
/** Fallback peek until chrome is measured — never smaller than toolbar+tabs. */
const PEEK_FALLBACK = 248;
const PEEK_FALLBACK_COVER = 228;

function isCoverWidth() {
  if (typeof window === "undefined") return false;
  if (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("motivelife-cover-screen")
  ) {
    return true;
  }
  return window.innerWidth > 0 && window.innerWidth <= 420;
}

function openHeightPx() {
  if (typeof window === "undefined") return 420;
  const ratio = isCoverWidth() ? OPEN_RATIO_COVER : OPEN_RATIO;
  const max = isCoverWidth() ? Math.min(window.innerHeight * 0.78, 560) : OPEN_MAX;
  return Math.min(window.innerHeight * ratio, max);
}

function peekFallbackPx() {
  return isCoverWidth() ? PEEK_FALLBACK_COVER : PEEK_FALLBACK;
}

/**
 * KINZO bottom dock — snap open/peek only (no live height dragging).
 * Live height thrash + map invalidateSize made Fold unbearably choppy.
 */
export function FamilyMapDockSheet({
  members,
  selectedId,
  places,
  open,
  onOpenChange,
  tab,
  onTabChange,
  onSelectMember,
  onOpenMemberDetails,
  onSelectPlace,
  placesContent,
  insightsContent,
  drivingContent,
  toolbar,
  alerts,
}: {
  members: FamilyMapMemberView[];
  selectedId: string | null;
  places: FamilyMapState["places"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: FamilyMapDockTab;
  onTabChange: (tab: FamilyMapDockTab) => void;
  onSelectMember: (id: string) => void;
  onOpenMemberDetails: (id: string) => void;
  onSelectPlace?: (id: string) => void;
  placesContent?: ReactNode;
  insightsContent?: ReactNode;
  drivingContent?: ReactNode;
  toolbar?: ReactNode;
  alerts?: ReactNode;
}) {
  const [cover, setCover] = useState(() =>
    typeof window !== "undefined" ? isCoverWidth() : false
  );
  const [openH, setOpenH] = useState(() =>
    typeof window !== "undefined" ? openHeightPx() : 420
  );
  const [peekH, setPeekH] = useState(() =>
    typeof window !== "undefined" ? peekFallbackPx() : PEEK_FALLBACK
  );

  const chromeRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{ y: number; open: boolean } | null>(null);

  useEffect(() => {
    const sync = () => {
      setCover(isCoverWidth());
      setOpenH(openHeightPx());
      // Keep measured peek if chrome is taller than the fallback.
      setPeekH((prev) => Math.max(peekFallbackPx(), prev));
    };
    sync();
    window.addEventListener("resize", sync, { passive: true });
    return () => window.removeEventListener("resize", sync);
  }, []);

  // Measure real chrome height so Family/Friends is never clipped on first open.
  useEffect(() => {
    const el = chromeRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h < 80) return;
      // +2px fudge so the bottom of tabs isn't clipped by overflow:hidden.
      setPeekH(Math.max(peekFallbackPx(), h + 2));
    };

    apply();
    // Second pass after fonts/layout — fixes first-login half-cover glitch.
    const t = window.setTimeout(apply, 50);
    const t2 = window.setTimeout(apply, 200);
    const ro = new ResizeObserver(() => apply());
    ro.observe(el);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
      ro.disconnect();
    };
  }, [toolbar, cover]);

  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    swipeRef.current = { y: e.clientY, open };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // WebView may reject capture; up still fires on this node.
    }
  }

  function onHandlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const s = swipeRef.current;
    swipeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
    if (!s) return;
    const dy = e.clientY - s.y;
    // Tap → toggle. Clear swipe → snap. No live resizing.
    if (Math.abs(dy) < 12) {
      onOpenChange(!s.open);
      return;
    }
    if (dy < -24) onOpenChange(true);
    else if (dy > 24) onOpenChange(false);
  }

  function onHandlePointerCancel() {
    swipeRef.current = null;
  }

  const height = open ? openH : peekH;

  return (
    <div className="family-map-dock-root pointer-events-none absolute inset-x-0 bottom-0 z-[850] kinzo-ui">
      {open ? (
        <button
          type="button"
          aria-label="Collapse family sheet"
          className="pointer-events-auto absolute inset-x-0 bottom-full h-[35vh] bg-transparent"
          onClick={() => onOpenChange(false)}
        />
      ) : null}

      <div
        className={`family-map-dock-sheet pointer-events-auto relative flex flex-col overflow-hidden ${KINZO_SHEET_SOLID}`}
        style={{
          height,
          transition: "height 160ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        <div ref={chromeRef} className="family-map-dock-chrome relative z-[3] shrink-0 bg-white">
          <div
            className="family-map-dock-handle flex touch-none flex-col items-center px-3 pb-2 pt-2.5"
            style={{ touchAction: "none" }}
            onPointerDown={onHandlePointerDown}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerCancel}
            role="button"
            aria-label={open ? "Collapse family sheet" : "Expand family sheet"}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenChange(!open);
              }
            }}
          >
            <span className="h-1.5 w-12 rounded-full bg-forward-300/95" />
          </div>

          {toolbar ? (
            <div
              className={`family-map-dock-toolbar bg-white px-2.5 pb-2 ${
                cover ? "px-1.5" : ""
              }`}
            >
              {toolbar}
            </div>
          ) : null}

          <div
            className={`family-map-dock-tabs flex overflow-x-hidden bg-white px-2.5 pb-2.5 sm:gap-2 sm:px-3 ${
              cover ? "gap-1 px-1.5 pb-2" : "gap-1.5"
            }`}
          >
            {TABS.map((t) => {
              const Icon = t.Icon;
              const active = tab === t.id;
              const tone = KINZO_FEATURE[TAB_TONE[t.id]];
              const label = cover ? t.shortLabel : t.label;
              const blurb = cover ? t.shortBlurb : t.blurb;
              const darkText = t.id === "places";
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onTabChange(t.id);
                    if (!open) onOpenChange(true);
                  }}
                  className={`family-map-dock-tab kinzo-feature-card relative flex min-w-0 flex-1 flex-col items-start overflow-hidden rounded-[1.25rem] text-left ${
                    cover
                      ? "min-h-[4.35rem] items-center rounded-[1.05rem] px-1 pb-1.5 pt-1.5"
                      : "min-h-[6.5rem] px-2 pb-2 pt-2"
                  } ${
                    active
                      ? cover
                        ? "z-[1] ring-2 ring-white/95"
                        : "z-[1] ring-2 ring-white/95 ring-offset-1 ring-offset-white"
                      : ""
                  }`}
                  style={{
                    background: tone.gradient,
                    boxShadow: cover
                      ? "0 4px 10px -6px rgba(15,23,42,0.3)"
                      : "0 8px 18px -10px rgba(15,23,42,0.35)",
                    color: darkText ? "#1A1A1A" : "#fff",
                  }}
                  aria-label={t.label}
                  aria-pressed={active}
                  title={t.label}
                >
                  <span
                    className={`relative inline-flex items-center justify-center rounded-[1.05rem] bg-white/22 text-inherit ${
                      cover
                        ? "mb-1 h-7 w-7 rounded-[0.85rem]"
                        : "mb-1.5 h-9 w-9 sm:h-10 sm:w-10"
                    }`}
                  >
                    <Icon
                      className={cover ? "h-3.5 w-3.5" : "h-[1.15rem] w-[1.15rem]"}
                      strokeWidth={2.35}
                      color={darkText ? tone.deep : "#fff"}
                    />
                    {!cover && t.id === "people" ? (
                      <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white shadow-sm">
                        <Heart className="h-2 w-2 fill-[#3B82F6] text-[#3B82F6]" />
                      </span>
                    ) : null}
                    {!cover && t.id === "insights" ? (
                      <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white px-1 text-[7px] font-black leading-3 text-[#8B5CF6] shadow-sm">
                        AI
                      </span>
                    ) : null}
                    {!cover && t.id === "places" ? (
                      <span className="absolute -right-1 -top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#EF4444] text-white shadow-sm">
                        <MapPin className="h-2 w-2" strokeWidth={3} />
                      </span>
                    ) : null}
                  </span>

                  <span
                    className={`family-map-dock-tab-label w-full truncate text-center text-[11px] font-bold leading-tight sm:text-xs ${
                      cover ? "text-[9px] leading-none" : "line-clamp-2 text-left"
                    } ${darkText ? "text-[#1A1A1A]" : "text-white"}`}
                  >
                    {label}
                  </span>
                  {!cover ? (
                    <span
                      className={`family-map-dock-tab-blurb mt-0.5 line-clamp-2 text-[9px] font-medium leading-snug sm:text-[10px] ${
                        darkText ? "text-[#1A1A1A]/75" : "text-white/88"
                      }`}
                    >
                      {blurb}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className={`family-map-dock-body relative z-[1] min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white pb-6 [-webkit-overflow-scrolling:touch] ${
            cover ? "px-2.5" : "px-3"
          }`}
          style={{ touchAction: "pan-y" }}
        >
          {alerts ? (
            <div className="family-map-dock-alerts mb-2 flex flex-col gap-1.5 pt-1">
              {alerts}
            </div>
          ) : null}

          {tab === "people" ? (
            <ul className="space-y-1.5 pb-2">
              {members.map((m) => {
                const active = m.id === selectedId;
                const status = memberPresenceSubtitle(m);
                const badge = kinzoStatusForMember(m);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (m.id === selectedId) {
                          onOpenMemberDetails(m.id);
                        } else {
                          onSelectMember(m.id);
                        }
                      }}
                      className={`flex w-full items-center rounded-2xl text-left ${
                        cover ? "gap-2 px-2 py-2" : "gap-3 px-2.5 py-2.5"
                      } ${
                        active
                          ? "bg-sky-50/95 ring-1 ring-sky-200/90"
                          : "hover:bg-forward-50/90"
                      }`}
                    >
                      <span className="relative shrink-0">
                        <span
                          className={`inline-flex items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white ring-2 ring-white ${
                            cover ? "h-10 w-10 text-xs" : "h-12 w-12"
                          }`}
                          style={{ background: m.color }}
                        >
                          {m.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.avatarUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            m.displayName.slice(0, 1)
                          )}
                        </span>
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                        {m.batteryPercent != null ? (
                          <span
                            className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${batteryTone(
                              m.batteryPercent
                            )}`}
                          >
                            {m.batteryPercent}%
                          </span>
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-forward-950">
                            {m.displayName}
                            {m.isYou ? " · You" : ""}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-forward-600">
                          {status}
                        </span>
                      </span>
                      <span className={kinzoStatusBadgeClass(badge)}>
                        <StatusGlyph kind={badge.kind} />
                        <span className="truncate">{badge.label}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {members.length === 0 ? (
                <li className="rounded-2xl bg-forward-50 px-3 py-4 text-center text-xs text-forward-500">
                  No family members on the map yet.
                </li>
              ) : null}
            </ul>
          ) : null}

          {tab === "places" ? (
            placesContent ?? (
              <ul className="space-y-1.5 pb-2">
                {places.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onSelectPlace?.(p.id)}
                      className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left hover:bg-amber-50/80"
                    >
                      <span
                        className="inline-flex h-10 w-10 items-center justify-center rounded-[1.05rem] text-white"
                        style={{ background: KINZO_FEATURE.places.gradient }}
                      >
                        <Building2 className="h-4 w-4" strokeWidth={2.35} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-forward-900">
                          {p.name}
                        </span>
                        <span className="block truncate text-xs text-forward-500">
                          {p.category}
                          {p.visitCount ? ` · ${p.visitCount} visits` : ""}
                          {p.mostCommonVisitorName
                            ? ` · mostly ${p.mostCommonVisitorName}`
                            : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {places.length === 0 ? (
                  <li className="rounded-2xl bg-forward-50 px-3 py-4 text-center text-xs text-forward-500">
                    Save places from the map to see them here.
                  </li>
                ) : null}
              </ul>
            )
          ) : null}

          {tab === "insights" ? (
            <div className="pb-8">{insightsContent}</div>
          ) : null}

          {tab === "driving" ? <div className="pb-2">{drivingContent}</div> : null}
        </div>
      </div>
    </div>
  );
}
