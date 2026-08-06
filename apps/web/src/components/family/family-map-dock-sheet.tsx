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
  const dwell = dwellLabel(m.timeAtPlaceMinutes);
  if (m.placeName && dwell) return `At ${m.placeName}`;
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

/**
 * Life360-style bottom dock: peek tabs, pull up for the member list / intel.
 * Sits over the full-bleed map above the app tab bar.
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
  const dragRef = useRef<{ y: number; open: boolean } | null>(null);
  const [dragDy, setDragDy] = useState(0);

  useEffect(() => {
    if (!open) setDragDy(0);
  }, [open]);

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { y: e.clientY, open };
    setDragDy(0);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    setDragDy(e.clientY - dragRef.current.y);
  }

  function onPointerUp() {
    if (!dragRef.current) return;
    const startedOpen = dragRef.current.open;
    const dy = dragDy;
    dragRef.current = null;
    setDragDy(0);
    if (dy < -48) onOpenChange(true);
    else if (dy > 48) onOpenChange(false);
    else onOpenChange(startedOpen);
  }

  const peekH = 132;
  const openH = typeof window !== "undefined" ? Math.min(window.innerHeight * 0.58, 520) : 420;
  const baseH = open ? openH : peekH;
  const height = Math.max(peekH, Math.min(openH, baseH - dragDy));

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[30] flex flex-col justify-end"
      style={{ height: open ? openH + 24 : peekH + 8 }}
    >
      {open ? (
        <button
          type="button"
          aria-label="Collapse family sheet"
          className="pointer-events-auto absolute inset-0 -top-[40vh] bg-transparent"
          onClick={() => onOpenChange(false)}
        />
      ) : null}

      <div
        className="pointer-events-auto relative mx-0 flex max-h-full flex-col rounded-t-[1.6rem] bg-white shadow-[0_-12px_40px_-18px_rgba(10,25,48,0.45)] ring-1 ring-forward-100"
        style={{ height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="flex shrink-0 cursor-grab flex-col items-center pt-2 active:cursor-grabbing">
          <span className="h-1 w-10 rounded-full bg-forward-200" />
        </div>

        <div className="flex shrink-0 gap-2 px-3 pb-2 pt-2">
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
