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

/** Peek fits handle + toolbar + colorful tabs (cover is tighter). */
const PEEK_H = 236;
const PEEK_H_COVER = 210;
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

function isDragBlockedTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "button, a, input, textarea, select, label, [data-no-dock-drag], [role='textbox']"
    )
  );
}

/**
 * KINZO soft-UI bottom dock — gradient feature cards + solid sheet + status badges.
 * Drag from the whole chrome header (handle + toolbar + tabs). List body scrolls.
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
  /** Family/Friends, Live, settings, theme, layers — lives in the drawer, not on the map. */
  toolbar?: ReactNode;
  /** Conditions / attention chips — inside the scroll body so they never cover controls. */
  alerts?: ReactNode;
}) {
  const [openH, setOpenH] = useState(openHeightPx);
  const [peekH, setPeekH] = useState(peekHeightPx);
  const [cover, setCover] = useState(false);
  const [dragging, setDragging] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const openHRef = useRef(openH);
  const peekHRef = useRef(peekH);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    lastY: number;
    lastT: number;
    dy: number;
    velocity: number;
    startedOpen: boolean;
    moved: boolean;
    baseH: number;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  const windowListenersRef = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
    cancel: (e: PointerEvent) => void;
  } | null>(null);
  onOpenChangeRef.current = onOpenChange;

  openRef.current = open;
  openHRef.current = openH;
  peekHRef.current = peekH;

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
    // Settle to the target snap height whenever open/peek changes.
    dragRef.current = null;
    setDragging(false);
    const el = sheetRef.current;
    if (el) {
      el.style.transition = "height 180ms ease-out";
      el.style.height = `${open ? openH : peekH}px`;
    }
  }, [open, openH, peekH]);

  function clampHeight(h: number) {
    return Math.max(peekHRef.current, Math.min(openHRef.current, h));
  }

  function paintHeight(h: number) {
    const el = sheetRef.current;
    if (!el) return;
    el.style.height = `${clampHeight(h)}px`;
  }

  function schedulePaint(h: number) {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      paintHeight(h);
    });
  }

  function detachWindowDrag() {
    const L = windowListenersRef.current;
    if (!L) return;
    window.removeEventListener("pointermove", L.move);
    window.removeEventListener("pointerup", L.up);
    window.removeEventListener("pointercancel", L.cancel);
    windowListenersRef.current = null;
  }

  function collapse() {
    dragRef.current = null;
    setDragging(false);
    detachWindowDrag();
    onOpenChangeRef.current(false);
  }

  function endDrag(commit: boolean) {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    detachWindowDrag();

    const el = sheetRef.current;
    if (el) el.style.transition = "height 180ms ease-out";

    if (!d || !commit) {
      paintHeight(openRef.current ? openHRef.current : peekHRef.current);
      return;
    }

    // Tap chrome (not a button) → toggle
    if (!d.moved || Math.abs(d.dy) < 10) {
      onOpenChangeRef.current(!d.startedOpen);
      return;
    }

    const flickUp = d.velocity < -0.35;
    const flickDown = d.velocity > 0.35;
    const mid = (openHRef.current + peekHRef.current) / 2;
    const liveH = clampHeight(d.baseH - d.dy);

    if (flickUp || liveH > mid + 24 || d.dy < -28) onOpenChangeRef.current(true);
    else if (flickDown || liveH < mid - 24 || d.dy > 28)
      onOpenChangeRef.current(false);
    else onOpenChangeRef.current(d.startedOpen);
  }

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      detachWindowDrag();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChromePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (isDragBlockedTarget(e.target)) return;
    if (dragRef.current) return;

    // Stop map / backdrop from eating the gesture.
    e.preventDefault();
    e.stopPropagation();

    const baseH = openRef.current ? openHRef.current : peekHRef.current;
    const now = performance.now();
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      lastY: e.clientY,
      lastT: now,
      dy: 0,
      velocity: 0,
      startedOpen: openRef.current,
      moved: false,
      baseH,
    };
    setDragging(true);

    const el = sheetRef.current;
    if (el) el.style.transition = "none";

    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== ev.pointerId) return;
      ev.preventDefault();
      const t = performance.now();
      const dy = ev.clientY - d.startY;
      const dt = Math.max(8, t - d.lastT);
      const instantV = (ev.clientY - d.lastY) / dt;
      d.dy = dy;
      d.velocity = d.velocity * 0.55 + instantV * 0.45;
      d.lastY = ev.clientY;
      d.lastT = t;
      if (Math.abs(dy) > 5) d.moved = true;
      schedulePaint(d.baseH - dy);
    };
    const up = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== ev.pointerId) return;
      endDrag(true);
    };
    const cancel = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== ev.pointerId) return;
      if (d.moved && Math.abs(d.dy) >= 24) endDrag(true);
      else endDrag(false);
    };

    windowListenersRef.current = { move, up, cancel };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }

  const settledH = open ? openH : peekH;

  return (
    <div className="family-map-dock-root pointer-events-none absolute inset-x-0 bottom-0 z-[850] kinzo-ui">
      {open ? (
        <button
          type="button"
          aria-label="Collapse family sheet"
          className="pointer-events-auto absolute inset-x-0 bottom-full h-[40vh] bg-transparent"
          onClick={collapse}
        />
      ) : null}

      <div
        ref={sheetRef}
        className={`pointer-events-auto relative flex flex-col overflow-hidden ${KINZO_SHEET_SOLID}`}
        style={{
          height: settledH,
          willChange: dragging ? "height" : undefined,
        }}
      >
        {/* Entire header is the drag surface — buttons still work via closest(). */}
        <div
          className="family-map-dock-chrome relative z-[3] shrink-0 touch-none bg-white"
          style={{ touchAction: "none" }}
          onPointerDown={onChromePointerDown}
        >
          <div
            className="family-map-dock-handle flex flex-col items-center px-3 pb-1.5 pt-2.5"
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
                  data-no-dock-drag
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
                    boxShadow: cover
                      ? "0 6px 14px -8px rgba(15,23,42,0.35)"
                      : tone.glow,
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
                        // First tap: follow on map, keep People/Places/Intel/Driving visible.
                        // Second tap on the same person: open their detail sheet.
                        if (m.id === selectedId) {
                          onOpenMemberDetails(m.id);
                        } else {
                          onSelectMember(m.id);
                        }
                      }}
                      className={`flex w-full items-center rounded-2xl text-left transition ${
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
