"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { FamilyMapMemberView, FamilyMapState } from "@forward/shared";
import {
  Building2,
  Car,
  Footprints,
  KeyRound,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";

export type FamilyMapDockTab = "people" | "places" | "insights" | "more";

function dwellLabel(mins: number | null | undefined): string | null {
  if (mins == null || !Number.isFinite(mins) || mins < 1) return null;
  const n = Math.round(mins);
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const rem = n % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function memberStatusLine(m: FamilyMapMemberView): string {
  if (m.presence === "driving") {
    const speed = m.speedKmh != null ? ` · ${Math.round(m.speedKmh)} km/h` : "";
    return `Driving${speed}`;
  }
  if (m.presence === "moving") return "On the move";
  if (m.placeName) return `At ${m.placeName}`;
  return m.statusLabel || "Live";
}

function sinceLabel(m: FamilyMapMemberView): string | null {
  const dwell = dwellLabel(m.timeAtPlaceMinutes);
  if (dwell) return `Since ${dwell} ago`;
  if (!m.lastLocationAt) return null;
  try {
    return `Updated ${new Date(m.lastLocationAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  } catch {
    return null;
  }
}

function batteryTone(pct: number) {
  if (pct <= 20) return "bg-red-100 text-red-800";
  if (pct <= 35) return "bg-amber-100 text-amber-900";
  return "bg-emerald-100 text-emerald-800";
}

const TABS: {
  id: FamilyMapDockTab;
  label: string;
  icon: typeof Users;
}[] = [
  { id: "people", label: "People", icon: Users },
  { id: "places", label: "Places", icon: Building2 },
  { id: "insights", label: "Intel", icon: Sparkles },
  { id: "more", label: "More", icon: KeyRound },
];

const PEEK_H = 132;
const OPEN_MAX = 520;
const OPEN_RATIO = 0.58;

function openHeightPx() {
  if (typeof window === "undefined") return 420;
  return Math.min(window.innerHeight * OPEN_RATIO, OPEN_MAX);
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
  placesContent,
  insightsContent,
  moreContent,
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
  placesContent?: ReactNode;
  insightsContent?: ReactNode;
  moreContent?: ReactNode;
}) {
  const [openH, setOpenH] = useState(openHeightPx);
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
    const onResize = () => setOpenH(openHeightPx());
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

  const baseH = open ? openH : PEEK_H;
  const height = Math.max(PEEK_H, Math.min(openH, baseH - dragDy));

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
        className="pointer-events-auto relative flex flex-col rounded-t-[1.6rem] bg-white shadow-[0_-12px_40px_-18px_rgba(10,25,48,0.45)] ring-1 ring-forward-100"
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

        <div className="flex shrink-0 gap-2 px-3 pb-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onTabChange(t.id);
                  if (!open) onOpenChange(true);
                }}
                className={`inline-flex h-12 flex-1 items-center justify-center rounded-2xl transition ${
                  active
                    ? "bg-forward-900 text-white"
                    : "bg-forward-100 text-forward-700"
                }`}
                aria-label={t.label}
                title={t.label}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 [-webkit-overflow-scrolling:touch]"
          style={{ touchAction: "pan-y" }}
        >
          {tab === "people" ? (
            <ul className="space-y-1 pb-2">
              {members.map((m) => {
                const active = m.id === selectedId;
                const since = sinceLabel(m);
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
                          {memberStatusLine(m)}
                        </span>
                        {since ? (
                          <span className="mt-0.5 block truncate text-[11px] text-forward-400">
                            {since}
                          </span>
                        ) : null}
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
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-2xl px-2 py-2.5"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-forward-100 text-forward-700">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-forward-900">
                        {p.name}
                      </span>
                      <span className="block truncate text-xs text-forward-500">
                        {p.category}
                        {p.visitCount ? ` · ${p.visitCount} visits` : ""}
                      </span>
                    </span>
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

          {tab === "more" ? <div className="pb-2">{moreContent}</div> : null}
        </div>
      </div>
    </div>
  );
}
