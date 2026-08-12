"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { FamilyMapMemberView, FamilyMapState } from "@forward/shared";
import {
  BarChart3,
  Building2,
  Car,
  Footprints,
  Heart,
  Home,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";
import { memberPresenceSubtitle } from "@/lib/family-map/member-presence-label";

export type FamilyMapDockTab = "people" | "places" | "insights" | "driving";

function batteryTone(pct: number) {
  if (pct <= 20) return "bg-red-100 text-red-800";
  if (pct <= 35) return "bg-amber-100 text-amber-900";
  return "bg-emerald-100 text-emerald-800";
}

const TABS: {
  id: FamilyMapDockTab;
  label: string;
  shortLabel: string;
  blurb: string;
  shortBlurb: string;
  card: string;
  iconWrap: string;
  title: string;
  blurbTone: string;
  accent: string;
  accentSide: "left" | "right";
  Icon: typeof Users;
}[] = [
  {
    id: "people",
    label: "People",
    shortLabel: "People",
    blurb: "See everyone on the map.",
    shortBlurb: "Everyone on the map.",
    card: "bg-[#2F80ED]",
    iconWrap: "bg-white/20 text-white",
    title: "text-white",
    blurbTone: "text-white/85",
    accent: "bg-sky-300",
    accentSide: "left",
    Icon: Users,
  },
  {
    id: "places",
    label: "Places",
    shortLabel: "Places",
    blurb: "Saved places & visits.",
    shortBlurb: "Saved places.",
    card: "bg-[#F5C518]",
    iconWrap: "bg-white/35 text-[#8B5A00]",
    title: "text-[#1A1A1A]",
    blurbTone: "text-[#1A1A1A]/75",
    accent: "bg-amber-300",
    accentSide: "left",
    Icon: Home,
  },
  {
    id: "insights",
    label: "Family Intelligence",
    shortLabel: "Intel",
    blurb: "Insights that matter.",
    shortBlurb: "Insights.",
    card: "bg-[#8B5CF6]",
    iconWrap: "bg-white/20 text-white",
    title: "text-white",
    blurbTone: "text-white/85",
    accent: "bg-violet-300",
    accentSide: "left",
    Icon: Sparkles,
  },
  {
    id: "driving",
    label: "Driving Report",
    shortLabel: "Driving",
    blurb: "Safety, stats & weekly summary.",
    shortBlurb: "Safety & stats.",
    card: "bg-[#EF4444]",
    iconWrap: "bg-white/20 text-white",
    title: "text-white",
    blurbTone: "text-white/85",
    accent: "bg-rose-300",
    accentSide: "right",
    Icon: BarChart3,
  },
];

/** Tall enough for handle + colorful tab cards in peek. */
const PEEK_H = 168;
const PEEK_H_COVER = 148;
const OPEN_MAX = 520;
const OPEN_RATIO = 0.58;
const OPEN_RATIO_COVER = 0.72;

function isCoverWidth() {
  if (typeof window === "undefined") return false;
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
 * Life360-style bottom dock.
 * Drag ONLY on the grab handle so the member list scrolls cleanly on Android.
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

  // Refs avoid stale React state on pointerup (Android WebView was "sticking").
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
  const handleRef = useRef<HTMLDivElement>(null);

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

  function endDrag(commit: boolean) {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    setDragDy(0);
    if (!d || !commit) return;

    // Tap handle → toggle
    if (!d.moved || Math.abs(d.dy) < 8) {
      onOpenChange(!d.startedOpen);
      return;
    }

    const flickUp = d.velocity < -0.55;
    const flickDown = d.velocity > 0.55;
    if (flickUp || d.dy < -40) onOpenChange(true);
    else if (flickDown || d.dy > 40) onOpenChange(false);
    else onOpenChange(d.startedOpen);
  }

  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Don't steal clicks from tab buttons — only the grab strip.
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const now = performance.now();
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      lastY: e.clientY,
      lastT: now,
      dy: 0,
      velocity: 0,
      startedOpen: open,
      moved: false,
    };
    setDragging(true);
    setDragDy(0);
  }

  function onHandlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const now = performance.now();
    const dy = e.clientY - d.startY;
    const dt = Math.max(1, now - d.lastT);
    const instantV = (e.clientY - d.lastY) / dt; // px/ms
    d.dy = dy;
    d.velocity = d.velocity * 0.6 + instantV * 0.4;
    d.lastY = e.clientY;
    d.lastT = now;
    if (Math.abs(dy) > 6) d.moved = true;
    setDragDy(dy);
  }

  function onHandlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
    endDrag(true);
  }

  function onHandlePointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    endDrag(false);
  }

  const baseH = open ? openH : peekH;
  const height = Math.max(peekH, Math.min(openH, baseH - dragDy));

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[30]">
      {open ? (
        <button
          type="button"
          aria-label="Collapse family sheet"
          className="pointer-events-auto absolute inset-x-0 bottom-full h-[45vh] bg-transparent"
          onClick={() => onOpenChange(false)}
        />
      ) : null}

      <div
        className="pointer-events-auto relative flex flex-col overflow-hidden rounded-t-[1.6rem] bg-white shadow-[0_-12px_40px_-18px_rgba(10,25,48,0.45)] ring-1 ring-forward-100"
        style={{
          height,
          transition: dragging ? "none" : "height 180ms ease-out",
          willChange: dragging ? "height" : undefined,
        }}
      >
        {/* Drag zone: handle only — list scrolls independently on Android */}
        <div
          ref={handleRef}
          className="flex shrink-0 touch-none flex-col items-center pt-2"
          style={{ touchAction: "none" }}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerCancel}
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
          <span className="h-1.5 w-11 rounded-full bg-forward-300" />
          <p className="pb-1 pt-1 text-[10px] font-medium text-forward-400">
            {open ? "Pull down" : "Pull up for family"}
          </p>
        </div>

        <div className="family-map-dock-tabs flex shrink-0 gap-1.5 overflow-x-hidden px-2.5 pb-2.5 sm:gap-2 sm:px-3">
          {TABS.map((t) => {
            const Icon = t.Icon;
            const active = tab === t.id;
            const label = cover ? t.shortLabel : t.label;
            const blurb = cover ? t.shortBlurb : t.blurb;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onTabChange(t.id);
                  if (!open) onOpenChange(true);
                }}
                className={`family-map-dock-tab relative flex min-h-[7.25rem] min-w-0 flex-1 flex-col items-start overflow-hidden rounded-[1.15rem] px-2 pb-2 pt-2 text-left shadow-[0_8px_18px_-10px_rgba(15,23,42,0.45)] transition duration-200 ${
                  t.card
                } ${
                  active
                    ? "z-[1] ring-2 ring-white/90 ring-offset-1 ring-offset-white"
                    : "opacity-95 hover:opacity-100"
                }`}
                aria-label={t.label}
                aria-pressed={active}
                title={t.label}
              >
                {/* Motion accent lines */}
                <span
                  className={`pointer-events-none absolute top-1.5 flex flex-col gap-[3px] ${
                    t.accentSide === "left" ? "left-1.5" : "right-1.5"
                  }`}
                  aria-hidden
                >
                  <span className={`h-[2px] w-2.5 rounded-full ${t.accent} opacity-90`} />
                  <span className={`h-[2px] w-2 rounded-full ${t.accent} opacity-70`} />
                  <span className={`h-[2px] w-1.5 rounded-full ${t.accent} opacity-50`} />
                </span>

                <span
                  className={`relative mb-1.5 inline-flex h-8 w-8 items-center justify-center rounded-2xl shadow-sm sm:h-9 sm:w-9 ${t.iconWrap}`}
                >
                  <Icon className="h-4.5 w-4.5 h-[1.15rem] w-[1.15rem]" strokeWidth={2.25} />
                  {t.id === "people" ? (
                    <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white shadow-sm">
                      <Heart className="h-2 w-2 fill-[#2F80ED] text-[#2F80ED]" />
                    </span>
                  ) : null}
                  {t.id === "insights" ? (
                    <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white px-1 text-[7px] font-black leading-3 text-[#8B5CF6] shadow-sm">
                      AI
                    </span>
                  ) : null}
                  {t.id === "places" ? (
                    <span className="absolute -right-1 -top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#EF4444] text-white shadow-sm">
                      <MapPin className="h-2 w-2" strokeWidth={3} />
                    </span>
                  ) : null}
                </span>

                <span
                  className={`family-map-dock-tab-label line-clamp-2 text-[11px] font-bold leading-tight sm:text-xs ${t.title}`}
                >
                  {label}
                </span>
                <span
                  className={`family-map-dock-tab-blurb mt-0.5 line-clamp-2 text-[9px] font-medium leading-snug sm:text-[10px] ${t.blurbTone}`}
                >
                  {blurb}
                </span>

                {/* Active speech-bubble tip (matches People card in mock) */}
                {active ? (
                  <span
                    className={`pointer-events-none absolute -bottom-[7px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[8px] border-x-transparent ${
                      t.id === "people"
                        ? "border-t-[#2F80ED]"
                        : t.id === "places"
                          ? "border-t-[#F5C518]"
                          : t.id === "insights"
                            ? "border-t-[#8B5CF6]"
                            : "border-t-[#EF4444]"
                    }`}
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <div
          className="family-map-dock-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 [-webkit-overflow-scrolling:touch]"
          style={{ touchAction: "pan-y" }}
        >
          {tab === "people" ? (
            <ul className="space-y-1 pb-2">
              {members.map((m) => {
                const active = m.id === selectedId;
                const status = memberPresenceSubtitle(m);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectMember(m.id);
                        onOpenMemberDetails(m.id);
                      }}
                      className={`flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition ${
                        active ? "bg-sky-50 ring-1 ring-sky-200" : "hover:bg-forward-50"
                      }`}
                    >
                      <span className="relative shrink-0">
                        <span
                          className="inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white"
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
                          {m.presence === "driving" ? (
                            <Car className="h-3.5 w-3.5 shrink-0 text-blue-700" />
                          ) : m.presence === "moving" ? (
                            <Footprints className="h-3.5 w-3.5 shrink-0 text-sky-700" />
                          ) : (
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-forward-400" />
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-forward-600">
                          {status}
                        </span>
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
              <ul className="space-y-1 pb-2">
                {places.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onSelectPlace?.(p.id)}
                      className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-forward-50"
                    >
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                        <Building2 className="h-4 w-4" />
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
            <div className="pb-2">{insightsContent}</div>
          ) : null}

          {tab === "driving" ? <div className="pb-2">{drivingContent}</div> : null}
        </div>
      </div>
    </div>
  );
}
