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

/** Tall enough for handle + colorful tab cards in peek. */
const PEEK_H = 168;
const PEEK_H_COVER = 118;
const OPEN_MAX = 520;
const OPEN_RATIO = 0.58;
const OPEN_RATIO_COVER = 0.72;

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

function peekHeightPx() {
  return isCoverWidth() ? PEEK_H_COVER : PEEK_H;
}

/**
 * KINZO soft-UI bottom dock — gradient feature cards + glass sheet + status badges.
 * Drag the grab strip (and pull-down from list top) to expand/collapse. Document-level
 * pointer tracking keeps Fold cover + inner WebViews from dropping the gesture.
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
}) {
  const [openH, setOpenH] = useState(openHeightPx);
  const [peekH, setPeekH] = useState(peekHeightPx);
  const [cover, setCover] = useState(false);
  const [dragDy, setDragDy] = useState(0);
  const [dragging, setDragging] = useState(false);

  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    lastY: number;
    lastT: number;
    dy: number;
    velocity: number;
    startedOpen: boolean;
    moved: boolean;
  } | null>(null);
  /** Body pull-to-close: wait for clear downward move before claiming the gesture. */
  const pendingBodyDragRef = useRef<{
    pointerId: number;
    startY: number;
  } | null>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  const openRef = useRef(open);
  const coverRef = useRef(cover);
  const windowDragBoundRef = useRef(false);
  const endDragRef = useRef<(commit: boolean) => void>(() => {});
  const moveDragRef = useRef<(pointerId: number, clientY: number) => void>(
    () => {}
  );
  // Stable listener identities so add/removeEventListener always match.
  const windowPointerMoveRef = useRef((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    e.preventDefault();
    moveDragRef.current(e.pointerId, e.clientY);
  });
  const windowPointerUpRef = useRef((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    endDragRef.current(true);
  });
  onOpenChangeRef.current = onOpenChange;
  openRef.current = open;
  coverRef.current = cover;

  useEffect(() => {
    const onResize = () => {
      setOpenH(openHeightPx());
      setPeekH(peekHeightPx());
      setCover(isCoverWidth());
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!dragging) setDragDy(0);
  }, [open, dragging]);

  function unbindWindowDrag() {
    if (!windowDragBoundRef.current) return;
    window.removeEventListener("pointermove", windowPointerMoveRef.current);
    window.removeEventListener("pointerup", windowPointerUpRef.current);
    window.removeEventListener("pointercancel", windowPointerUpRef.current);
    windowDragBoundRef.current = false;
  }

  function bindWindowDrag() {
    if (windowDragBoundRef.current) return;
    window.addEventListener("pointermove", windowPointerMoveRef.current, {
      passive: false,
    });
    window.addEventListener("pointerup", windowPointerUpRef.current);
    window.addEventListener("pointercancel", windowPointerUpRef.current);
    windowDragBoundRef.current = true;
  }

  function endDrag(commit: boolean) {
    const d = dragRef.current;
    dragRef.current = null;
    pendingBodyDragRef.current = null;
    unbindWindowDrag();
    setDragging(false);
    setDragDy(0);
    if (!d || !commit) return;

    const closeThreshold = coverRef.current ? 28 : 40;
    const openThreshold = coverRef.current ? 28 : 40;

    // Tap handle → toggle
    if (!d.moved || Math.abs(d.dy) < 8) {
      onOpenChangeRef.current(!d.startedOpen);
      return;
    }

    const flickUp = d.velocity < -0.45;
    const flickDown = d.velocity > 0.45;
    if (flickUp || d.dy < -openThreshold) onOpenChangeRef.current(true);
    else if (flickDown || d.dy > closeThreshold) onOpenChangeRef.current(false);
    else onOpenChangeRef.current(d.startedOpen);
  }

  function beginDrag(pointerId: number, clientY: number) {
    pendingBodyDragRef.current = null;
    const now = performance.now();
    dragRef.current = {
      pointerId,
      startY: clientY,
      lastY: clientY,
      lastT: now,
      dy: 0,
      velocity: 0,
      startedOpen: openRef.current,
      moved: false,
    };
    bindWindowDrag();
    setDragging(true);
    setDragDy(0);
  }

  function moveDrag(pointerId: number, clientY: number) {
    const d = dragRef.current;
    if (!d || d.pointerId !== pointerId) return;
    const now = performance.now();
    const dy = clientY - d.startY;
    const dt = Math.max(1, now - d.lastT);
    const instantV = (clientY - d.lastY) / dt; // px/ms
    d.dy = dy;
    d.velocity = d.velocity * 0.6 + instantV * 0.4;
    d.lastY = clientY;
    d.lastT = now;
    if (Math.abs(dy) > 6) d.moved = true;
    setDragDy(dy);
  }

  endDragRef.current = endDrag;
  moveDragRef.current = moveDrag;

  useEffect(() => {
    return () => {
      unbindWindowDrag();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount cleanup only
  }, []);

  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Don't steal clicks from tab / Close buttons — only the grab strip.
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // capture optional — window listeners still track the drag
    }
    beginDrag(e.pointerId, e.clientY);
  }

  /** Arm pull-to-close from the list when already scrolled to the top. */
  function onBodyPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!openRef.current) return;
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select")) {
      return;
    }
    const el = bodyRef.current;
    if (!el || el.scrollTop > 2) return;
    pendingBodyDragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
    };
  }

  function onBodyPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const pending = pendingBodyDragRef.current;
    if (pending && pending.pointerId === e.pointerId && !dragRef.current) {
      const dy = e.clientY - pending.startY;
      if (dy > 12) {
        // Clear downward pull at list top → take over as sheet drag.
        beginDrag(pending.pointerId, pending.startY);
        moveDrag(e.pointerId, e.clientY);
        return;
      }
      if (dy < -8) {
        // Scrolling the list up — abandon.
        pendingBodyDragRef.current = null;
        return;
      }
    }

    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (bodyRef.current && bodyRef.current.scrollTop > 2 && e.clientY - d.startY > 0) {
      dragRef.current = null;
      unbindWindowDrag();
      setDragging(false);
      setDragDy(0);
      return;
    }
    moveDrag(e.pointerId, e.clientY);
  }

  function onBodyPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (
      pendingBodyDragRef.current &&
      pendingBodyDragRef.current.pointerId === e.pointerId
    ) {
      pendingBodyDragRef.current = null;
    }
  }

  const baseH = open ? openH : peekH;
  // Allow dragging visually below peek while open so pull-to-close feels live;
  // clamp floor slightly under peek, then settle on release.
  const dragFloor = open ? Math.max(72, peekH - 48) : peekH;
  const height = Math.max(dragFloor, Math.min(openH, baseH - dragDy));

  return (
    <div className="family-map-dock-root pointer-events-none absolute inset-x-0 bottom-0 z-[850] kinzo-ui">
      {open ? (
        <button
          type="button"
          aria-label="Collapse family sheet"
          className="pointer-events-auto absolute inset-x-0 bottom-full h-[45vh] bg-transparent"
          onClick={() => onOpenChange(false)}
        />
      ) : null}

      <div
        className={`pointer-events-auto relative flex flex-col overflow-hidden ${KINZO_SHEET_SOLID}`}
        style={{
          height,
          transition: dragging ? "none" : "height 180ms ease-out",
          willChange: dragging ? "height" : undefined,
        }}
      >
        <div
          ref={handleRef}
          className="family-map-dock-handle flex shrink-0 touch-none flex-col items-center px-3 pt-2 pb-1"
          style={{ touchAction: "none" }}
          onPointerDown={onHandlePointerDown}
          role="button"
          aria-label={open ? "Drag down to collapse" : "Drag up to expand"}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenChange(!open);
            }
          }}
        >
          <span className="h-1.5 w-12 rounded-full bg-forward-300/95" />
          <div className="flex w-full items-center justify-center gap-2 pb-0.5 pt-1">
            <p className="text-[10px] font-medium text-forward-400">
              {open ? "Pull down to close" : "Pull up for family"}
            </p>
            {open ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChange(false);
                }}
                className="rounded-full bg-forward-100 px-2 py-0.5 text-[10px] font-semibold text-forward-700 hover:bg-forward-200"
                aria-label="Close family sheet"
              >
                Close
              </button>
            ) : null}
          </div>
        </div>

        <div
          className={`family-map-dock-tabs flex shrink-0 overflow-x-hidden px-2.5 pb-2.5 sm:gap-2 sm:px-3 ${
            cover ? "gap-1 px-1.5 pb-2" : "gap-1.5"
          }`}
          style={{ touchAction: "none" }}
          onPointerDown={onHandlePointerDown}
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
                className={`family-map-dock-tab kinzo-feature-card relative flex min-w-0 flex-1 flex-col items-start overflow-hidden rounded-[1.25rem] text-left transition duration-200 ${
                  cover
                    ? "min-h-[4.35rem] items-center rounded-[1.05rem] px-1 pb-1.5 pt-1.5"
                    : "min-h-[7.25rem] px-2 pb-2 pt-2"
                } ${
                  active
                    ? cover
                      ? "z-[1] ring-2 ring-white/95"
                      : "z-[1] ring-2 ring-white/95 ring-offset-1 ring-offset-white"
                    : "opacity-[0.96] hover:opacity-100"
                }`}
                style={{
                  background: tone.gradient,
                  boxShadow: cover ? "0 6px 14px -8px rgba(15,23,42,0.35)" : tone.glow,
                  color: darkText ? "#1A1A1A" : "#fff",
                }}
                aria-label={t.label}
                aria-pressed={active}
                title={t.label}
              >
                <span
                  className={`relative inline-flex items-center justify-center rounded-[1.05rem] bg-white/22 text-inherit shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${
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

                {active ? (
                  <span
                    className="pointer-events-none absolute -bottom-[7px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[8px] border-x-transparent"
                    style={{ borderTopColor: tone.hex }}
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <div
          ref={bodyRef}
          className={`family-map-dock-body min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6 [-webkit-overflow-scrolling:touch] ${
            cover ? "px-2.5" : "px-3"
          }`}
          style={{ touchAction: dragging ? "none" : "pan-y" }}
          onPointerDown={onBodyPointerDown}
          onPointerMove={onBodyPointerMove}
          onPointerUp={onBodyPointerUp}
          onPointerCancel={onBodyPointerUp}
        >
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
                        onSelectMember(m.id);
                        onOpenMemberDetails(m.id);
                      }}
                      className={`flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition ${
                        cover ? "gap-2 px-2 py-2" : "gap-3 px-2.5 py-2.5"
                      } ${
                        active
                          ? "bg-sky-50/95 shadow-[0_8px_20px_-14px_rgba(59,130,246,0.45)] ring-1 ring-sky-200/90"
                          : "hover:bg-forward-50/90"
                      }`}
                    >
                      <span className="relative shrink-0">
                        <span
                          className={`inline-flex items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white ring-2 ring-white shadow-[0_0_0_3px_rgba(16,185,129,0.35)] ${
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
                      className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition hover:bg-amber-50/80"
                    >
                      <span
                        className="inline-flex h-10 w-10 items-center justify-center rounded-[1.05rem] text-white shadow-[0_8px_18px_-10px_rgba(245,158,11,0.65)]"
                        style={{
                          background: KINZO_FEATURE.places.gradient,
                        }}
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
