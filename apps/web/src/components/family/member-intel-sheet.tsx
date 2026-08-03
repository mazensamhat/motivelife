"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  FAMILY_RELATIONSHIP_PRESETS,
  type FamilyMapMemberView,
  type FamilyMapState,
} from "@forward/shared";
import {
  Battery,
  ChevronLeft,
  ChevronRight,
  Footprints,
  Car,
  MessageCircle,
  Navigation,
  Phone,
  X,
} from "lucide-react";
import { DayTimeline } from "@/components/family/day-timeline";
import { LocationHistoryPanel } from "@/components/family/location-history-panel";
import {
  appleMapsNavigateUrl,
  mapsNavigateUrl,
  preferAppleMaps,
  smsUrl,
  telUrl,
} from "@/lib/family-map/member-actions";
import type { LocalHistoryTrip } from "@/lib/family-map/local-history-types";

function relationshipSelectValue(label: string | null | undefined): string {
  if (!label) return "";
  if ((FAMILY_RELATIONSHIP_PRESETS as readonly string[]).includes(label)) return label;
  return "Other";
}

function formatUpdatedLabel(iso: string | null | undefined): string {
  if (!iso) return "No recent fix";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "No recent fix";
  const mins = Math.max(0, (Date.now() - t) / 60_000);
  if (mins < 1) return "Last updated Now";
  if (mins < 60) return `Last updated ${Math.round(mins)}m ago`;
  return `Last updated ${Math.round(mins / 60)}h ago`;
}

function formatSince(minutes: number | null | undefined, lastAt: string | null): string | null {
  if (minutes != null && minutes > 0) {
    if (minutes < 60) return `Since ${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return rem ? `Since ${hrs}h ${rem}m` : `Since ${hrs}h`;
  }
  if (!lastAt) return null;
  const t = Date.parse(lastAt);
  if (!Number.isFinite(t)) return null;
  return `Since ${new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

type SheetMode = "focus" | "history" | "settings";

/**
 * Life360-style member focus: bottom sheet over the live map.
 * Tap person → follow + status + today timeline. History / settings cascade deeper.
 */
export function MemberIntelSheet({
  member,
  state,
  onClose,
  onSavePlaceAtMember,
  onMemberUpdated,
  historyRefreshKey = 0,
  selectedHistoryTripId = null,
  onSelectHistoryTrip,
  onHighlightPlaces,
}: {
  member: FamilyMapMemberView;
  state: FamilyMapState;
  onClose: () => void;
  onSavePlaceAtMember?: (member: FamilyMapMemberView) => void;
  onMemberUpdated?: (state: FamilyMapState) => void;
  historyRefreshKey?: number;
  selectedHistoryTripId?: string | null;
  onSelectHistoryTrip?: (trip: LocalHistoryTrip | null) => void;
  onHighlightPlaces?: (
    places: { name: string; lat: number; lng: number; radiusM: number }[]
  ) => void;
  /** Kept for call-site compatibility; sheet docks to viewport bottom. */
  anchorRef?: unknown;
}) {
  const [actionNote, setActionNote] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [mode, setMode] = useState<SheetMode>("focus");
  const [relationBusy, setRelationBusy] = useState(false);
  const [relationDraft, setRelationDraft] = useState(
    relationshipSelectValue(member.relationshipLabel)
  );
  const [customRelation, setCustomRelation] = useState(
    relationshipSelectValue(member.relationshipLabel) === "Other"
      ? member.relationshipLabel ?? ""
      : ""
  );

  useEffect(() => {
    setMode("focus");
    setActionNote(null);
  }, [member.id]);

  useEffect(() => {
    const select = relationshipSelectValue(member.relationshipLabel);
    setRelationDraft(select);
    setCustomRelation(select === "Other" ? member.relationshipLabel ?? "" : "");
  }, [member.id, member.relationshipLabel]);

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mode !== "focus") setMode("focus");
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, mode]);

  async function saveRelationship(label: string | null) {
    setRelationBusy(true);
    setActionNote(null);
    try {
      const res = await fetch(`/api/family/members/${encodeURIComponent(member.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationshipLabel: label }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setActionNote(data?.error ?? "Could not save relationship.");
        return;
      }
      onMemberUpdated?.((await res.json()) as FamilyMapState);
    } catch {
      setActionNote("Could not save relationship. Check your connection.");
    } finally {
      setRelationBusy(false);
    }
  }

  function runMessage() {
    setActionNote(null);
    if (!member.phoneNumber) {
      setActionNote("No phone on file for them yet. Ask them to add one in account settings.");
      return;
    }
    window.location.href = smsUrl(
      member.phoneNumber,
      `Hey ${member.displayName.split(" ")[0] ?? ""} — checking in from MyMotiveFamily.`
    );
  }

  function runCall() {
    setActionNote(null);
    if (!member.phoneNumber) {
      setActionNote("No phone on file for them yet.");
      return;
    }
    window.location.href = telUrl(member.phoneNumber);
  }

  function runNavigate() {
    setActionNote(null);
    if (member.lat == null || member.lng == null) {
      setActionNote("No live coordinates to navigate to.");
      return;
    }
    const label = member.placeName || member.displayName;
    const url = preferAppleMaps()
      ? appleMapsNavigateUrl(member.lat, member.lng, label)
      : mapsNavigateUrl(member.lat, member.lng, label);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (!portalReady) return null;

  const moving = member.presence === "driving" || member.presence === "moving";
  const since = formatSince(member.timeAtPlaceMinutes, member.lastLocationAt);
  const PresenceIcon = member.presence === "driving" ? Car : Footprints;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex flex-col justify-end">
      <div
        role="dialog"
        aria-modal="false"
        aria-label={`${member.displayName} live status`}
        className="family-intel-sheet pointer-events-auto relative mx-auto w-full max-w-lg rounded-t-3xl bg-white shadow-2xl"
      >
        <div className="flex justify-center pt-2">
          <span className="h-1 w-10 rounded-full bg-forward-200" />
        </div>

        <div className="flex items-center gap-2 border-b border-forward-100 px-4 pb-3 pt-2">
          {mode !== "focus" ? (
            <button
              type="button"
              className="rounded-full bg-forward-100 p-2 text-forward-700"
              aria-label="Back"
              onClick={() => setMode("focus")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : null}
          <span
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white shadow"
            style={{ background: member.color }}
          >
            {member.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              member.displayName.slice(0, 1)
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate font-display text-base font-semibold text-forward-900">
                {member.displayName}
                {member.isYou ? " · You" : ""}
              </h2>
              <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            </div>
            <p className="truncate text-[11px] text-forward-500">
              {formatUpdatedLabel(member.lastLocationAt)}
              {member.relationshipLabel ? ` · ${member.relationshipLabel}` : ""}
            </p>
          </div>
          {member.batteryPercent != null ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-forward-50 px-2 py-1 text-[11px] font-semibold text-forward-800">
              <Battery className="h-3.5 w-3.5 text-emerald-600" />
              {member.batteryPercent}%
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-forward-100 p-2 text-forward-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[min(48vh,420px)] space-y-3 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          {mode === "focus" ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold leading-snug text-forward-900">
                    {member.statusLabel}
                  </p>
                  <p className="mt-0.5 text-xs text-forward-500">
                    {[
                      since,
                      member.speedKmh != null && moving
                        ? `${Math.round(member.speedKmh)} km/h`
                        : null,
                      member.etaMinutes != null ? `ETA ${member.etaMinutes} min` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Live on the map"}
                  </p>
                </div>
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                  <PresenceIcon className="h-6 w-6" />
                </span>
              </div>

              <div className="flex gap-2">
                <ActionButton label="Message" icon={<MessageCircle className="h-4 w-4" />} onClick={runMessage} />
                <ActionButton label="Call" icon={<Phone className="h-4 w-4" />} onClick={runCall} />
                <ActionButton label="Navigate" icon={<Navigation className="h-4 w-4" />} onClick={runNavigate} />
              </div>

              {actionNote ? <p className="text-xs text-amber-800">{actionNote}</p> : null}

              <DayTimeline
                memberId={member.id}
                isYou={member.isYou}
                member={member}
                refreshKey={historyRefreshKey}
                selectedTripId={selectedHistoryTripId}
                onSelectTrip={(t) => onSelectHistoryTrip?.(t)}
                placeVisitsToday={state.placeVisitsToday ?? []}
                recentCloudTrips={state.recentTrips ?? []}
              />

              <div className="divide-y divide-forward-100 overflow-hidden rounded-2xl border border-forward-100">
                <CascadeRow label="Full history" onClick={() => setMode("history")} />
                <CascadeRow label="Member settings" onClick={() => setMode("settings")} />
              </div>

              {onSavePlaceAtMember && member.lat != null && member.lng != null ? (
                <button
                  type="button"
                  onClick={() => onSavePlaceAtMember(member)}
                  className="w-full rounded-xl border border-forward-200 py-2.5 text-sm font-semibold text-forward-800 hover:bg-forward-50"
                >
                  Save this spot as a place
                </button>
              ) : null}
            </>
          ) : null}

          {mode === "history" ? (
            <LocationHistoryPanel
              memberId={member.id}
              memberName={member.displayName}
              isYou={member.isYou}
              refreshKey={historyRefreshKey}
              selectedTripId={selectedHistoryTripId}
              onHighlightPlaces={onHighlightPlaces}
              onSelectTrip={(t) => onSelectHistoryTrip?.(t)}
            />
          ) : null}

          {mode === "settings" ? (
            <div className="space-y-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-forward-500">
                Relationship
                <select
                  className="mt-1 w-full rounded-lg border border-forward-200 bg-white px-2.5 py-2 text-sm font-medium normal-case tracking-normal text-forward-900"
                  value={relationDraft}
                  disabled={relationBusy}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRelationDraft(value);
                    if (!value) {
                      void saveRelationship(null);
                      return;
                    }
                    if (value === "Other") {
                      setCustomRelation(
                        member.relationshipLabel &&
                          !(FAMILY_RELATIONSHIP_PRESETS as readonly string[]).includes(
                            member.relationshipLabel
                          )
                          ? member.relationshipLabel
                          : ""
                      );
                      return;
                    }
                    void saveRelationship(value);
                  }}
                >
                  <option value="">
                    {member.isYou ? "Your role (optional)" : "Choose relationship…"}
                  </option>
                  {FAMILY_RELATIONSHIP_PRESETS.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {relationDraft === "Other" ? (
                <div className="flex gap-2">
                  <input
                    value={customRelation}
                    onChange={(e) => setCustomRelation(e.target.value)}
                    placeholder="e.g. Stepmom, Godfather"
                    maxLength={40}
                    disabled={relationBusy}
                    className="flex-1 rounded-lg border border-forward-200 px-2.5 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={relationBusy || !customRelation.trim()}
                    onClick={() => void saveRelationship(customRelation.trim())}
                    className="rounded-lg bg-forward-900 px-3 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              ) : null}
              {actionNote ? <p className="text-xs text-amber-800">{actionNote}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

function CascadeRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-forward-900 hover:bg-forward-50"
    >
      {label}
      <ChevronRight className="h-4 w-4 text-forward-400" />
    </button>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-forward-200 bg-white py-2.5 text-xs font-semibold text-forward-800 shadow-sm active:bg-forward-50"
    >
      {icon}
      {label}
    </button>
  );
}
