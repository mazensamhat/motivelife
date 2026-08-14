"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  FAMILY_RELATIONSHIP_PRESETS,
  type FamilyDriveImpact,
  type FamilyMapMemberView,
  type FamilyMapState,
} from "@forward/shared";
import {
  AlertTriangle,
  Battery,
  Bell,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Clock,
  Footprints,
  Car,
  Home,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Sparkles,
  X,
} from "lucide-react";
import { DayTimeline } from "@/components/family/day-timeline";
import { LocationHistoryPanel } from "@/components/family/location-history-panel";
import { DriveScoreBubble } from "@/components/family/drive-score-bubble";
import { authFetch } from "@/lib/auth-fetch";
import { FamilyIntelLockedPreview } from "@/components/family/family-intel-locked-preview";
import {
  appleMapsNavigateUrl,
  mapsNavigateUrl,
  preferAppleMaps,
  smsUrl,
  telUrl,
} from "@/lib/family-map/member-actions";
import { memberPresenceSubtitle } from "@/lib/family-map/member-presence-label";
import type { LocalHistoryTrip } from "@/lib/family-map/local-history-types";
import {
  kinzoStatusBadgeClass,
  kinzoStatusForMember,
  type KinzoStatusKind,
} from "@/lib/family-map/ui-theme";

const CHECK_INS = [
  { label: "What's up?", text: "Hey — what's up?" },
  { label: "Be safe", text: "Be safe 🙏" },
  { label: "On my way!", text: "On my way!" },
  { label: "Need a ride?", text: "Need a ride?" },
  { label: "Call me", text: "Call me when you can." },
] as const;

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
  if (mins < 2) return "Last updated Now";
  if (mins < 60) return `Last updated ${Math.floor(mins)}m ago`;
  return `Last updated ${Math.floor(mins / 60)}h ago`;
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
  driveImpact = null,
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
  /** Live Route Orb / clear-run impact for this household (filtered to member). */
  driveImpact?: FamilyDriveImpact | null;
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
  const [noShowTime, setNoShowTime] = useState("17:30");
  const [noShowPlaceId, setNoShowPlaceId] = useState(state.places[0]?.id ?? "");
  const [noShowBusy, setNoShowBusy] = useState(false);
  const [placeAlertBusy, setPlaceAlertBusy] = useState(false);

  const intel = state.entitlements?.intelligence === true;

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
  const statusMeta = kinzoStatusForMember(member);
  const PresenceIcon =
    member.presence === "driving"
      ? Car
      : member.presence === "moving"
        ? Footprints
        : null;

  function StatusGlyph({ kind }: { kind: KinzoStatusKind }) {
    const cls = "h-3 w-3 shrink-0";
    if (kind === "home") return <Home className={cls} strokeWidth={2.5} />;
    if (kind === "work") return <Briefcase className={cls} strokeWidth={2.5} />;
    if (kind === "driving") return <Car className={cls} strokeWidth={2.5} />;
    if (kind === "onTheWay") return <Clock className={cls} strokeWidth={2.5} />;
    if (kind === "attention") return <AlertTriangle className={cls} strokeWidth={2.5} />;
    return <MapPin className={cls} strokeWidth={2.5} />;
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex flex-col justify-end">
      <div
        role="dialog"
        aria-modal="false"
        aria-label={`${member.displayName} live status`}
        className="family-intel-sheet kinzo-ui pointer-events-auto relative mx-auto w-full max-w-lg rounded-t-[1.75rem] bg-white/95 shadow-[0_-16px_48px_-20px_rgba(15,23,42,0.35)] ring-1 ring-forward-100/80 backdrop-blur-xl"
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
              {memberPresenceSubtitle(member)}
            </p>
          </div>
          <span className={kinzoStatusBadgeClass(statusMeta)}>
            <StatusGlyph kind={statusMeta.kind} />
            <span className="truncate">{statusMeta.label}</span>
          </span>
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

        <div className="max-h-[min(58vh,520px)] space-y-3 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          {mode === "focus" ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold leading-snug text-forward-900">
                    {memberPresenceSubtitle(member)}
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
                  {(member.likelyDestination ||
                    member.placeName ||
                    state.somethingDifferent?.memberName === member.displayName) && (
                    <div className="mt-2 rounded-2xl bg-sky-50 px-3 py-2 ring-1 ring-sky-100">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                        Today
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-forward-800">
                        {[
                          member.likelyDestination && member.etaMinutes != null
                            ? `Heading to ${member.likelyDestination} · ETA ${member.etaMinutes} min`
                            : member.likelyDestination
                              ? `Likely headed to ${member.likelyDestination}`
                              : member.placeName
                                ? `At ${member.placeName}`
                                : null,
                          state.somethingDifferent?.memberName === member.displayName
                            ? state.somethingDifferent.title
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  )}
                </div>
                <span
                  className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                    member.presence === "driving"
                      ? "bg-blue-50 text-blue-700"
                      : member.presence === "moving"
                        ? "bg-sky-50 text-sky-700"
                        : "bg-forward-50 text-forward-600"
                  }`}
                >
                  {PresenceIcon ? (
                    <PresenceIcon className="h-6 w-6" />
                  ) : (
                    <MapPin className="h-6 w-6" />
                  )}
                </span>
              </div>

              {intel ? (
                <MemberFamilyIntelCard
                  member={member}
                  state={state}
                  driveImpact={driveImpact}
                  onOpenHistory={() => setMode("history")}
                />
              ) : null}

              <div className="flex gap-2">
                <ActionButton label="Message" icon={<MessageCircle className="h-4 w-4" />} onClick={runMessage} />
                <ActionButton label="Call" icon={<Phone className="h-4 w-4" />} onClick={runCall} />
                <ActionButton label="Navigate" icon={<Navigation className="h-4 w-4" />} onClick={runNavigate} />
              </div>

              {actionNote ? <p className="text-xs text-amber-800">{actionNote}</p> : null}

              {intel ? (
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                  {CHECK_INS.map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => {
                        if (!member.phoneNumber) {
                          setActionNote("No phone on file for them yet.");
                          return;
                        }
                        window.location.href = smsUrl(member.phoneNumber, c.text);
                      }}
                      className="shrink-0 rounded-full border border-forward-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-forward-800 shadow-sm"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {intel ? (
                <>
                  {member.placeName ? (
                    <div className="rounded-xl border border-forward-100 bg-forward-50/70 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-forward-500">
                            Place alert
                          </p>
                          <p className="text-sm font-semibold text-forward-900">
                            At {member.placeName}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={placeAlertBusy}
                          className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-forward-800 shadow-sm"
                          onClick={async () => {
                            const place = state.places.find((p) => p.name === member.placeName);
                            if (!place) {
                              setActionNote("Save this place first to manage alerts.");
                              return;
                            }
                            setPlaceAlertBusy(true);
                            try {
                              const res = await authFetch("/api/family/places", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  id: place.id,
                                  notifyOnEnter: !place.notifyOnEnter,
                                  notifyOnLeave: !place.notifyOnLeave,
                                }),
                              });
                              if (!res.ok) {
                                setActionNote(
                                  res.status === 401
                                    ? "Session expired — open Mode of Life once, then try again."
                                    : "Could not update place alert."
                                );
                                return;
                              }
                              onMemberUpdated?.((await res.json()) as FamilyMapState);
                            } catch {
                              setActionNote("Could not update place alert.");
                            } finally {
                              setPlaceAlertBusy(false);
                            }
                          }}
                        >
                          <Bell className="h-3 w-3" />
                          {state.places.find((p) => p.name === member.placeName)?.notifyOnEnter
                            ? "On"
                            : "Off"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-forward-100 bg-forward-50/70 px-3 py-2.5">
                    <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-forward-500">
                      <Clock className="h-3 w-3" /> No show alert
                    </p>
                    <p className="mt-0.5 text-xs text-forward-600">
                      Get notified if {member.displayName.split(" ")[0]} isn’t at a place by a set
                      time.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <select
                        value={noShowPlaceId}
                        onChange={(e) => setNoShowPlaceId(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-forward-200 bg-white px-2 py-1.5 text-xs"
                      >
                        {state.places.length === 0 ? (
                          <option value="">Save a place first</option>
                        ) : (
                          state.places.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))
                        )}
                      </select>
                      <input
                        type="time"
                        value={noShowTime}
                        onChange={(e) => setNoShowTime(e.target.value)}
                        className="rounded-lg border border-forward-200 bg-white px-2 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        disabled={noShowBusy || !noShowPlaceId}
                        className="rounded-lg bg-forward-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        onClick={async () => {
                          setNoShowBusy(true);
                          setActionNote(null);
                          try {
                            const res = await fetch("/api/family/no-show", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                memberId: member.id,
                                placeId: noShowPlaceId,
                                byTimeLocal: noShowTime,
                                enabled: true,
                              }),
                            });
                            if (!res.ok) {
                              const data = (await res.json().catch(() => null)) as {
                                error?: string;
                              } | null;
                              setActionNote(data?.error ?? "Could not save no-show alert.");
                              return;
                            }
                            setActionNote("No show alert saved.");
                          } catch {
                            setActionNote("Could not save no-show alert.");
                          } finally {
                            setNoShowBusy(false);
                          }
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  <DayTimeline
                    memberId={member.id}
                    isYou={member.isYou}
                    member={member}
                    refreshKey={historyRefreshKey}
                    selectedTripId={selectedHistoryTripId}
                    onSelectTrip={(t) => onSelectHistoryTrip?.(t)}
                    placeVisitsToday={(state.placeVisitsToday ?? []).filter(
                      (v) => v.memberId === member.id
                    )}
                    recentCloudTrips={(state.recentTrips ?? []).filter(
                      (t) => t.memberId === member.id
                    )}
                  />

                  <div className="divide-y divide-forward-100 overflow-hidden rounded-[1.25rem] bg-forward-50/60 ring-1 ring-forward-100">
                    <CascadeRow label="Full history" onClick={() => setMode("history")} />
                    <CascadeRow label="Member settings" onClick={() => setMode("settings")} />
                  </div>
                </>
              ) : (
                <FamilyIntelLockedPreview
                  state={state}
                  canUpgrade={state.entitlements?.canUpgrade ?? false}
                />
              )}

              {onSavePlaceAtMember && member.lat != null && member.lng != null && intel ? (
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
            intel ? (
              <LocationHistoryPanel
                memberId={member.id}
                memberName={member.displayName}
                isYou={member.isYou}
                refreshKey={historyRefreshKey}
                selectedTripId={selectedHistoryTripId}
                onHighlightPlaces={onHighlightPlaces}
                onSelectTrip={(t) => onSelectHistoryTrip?.(t)}
              />
            ) : (
              <FamilyIntelLockedPreview
                state={state}
                canUpgrade={state.entitlements?.canUpgrade ?? false}
              />
            )
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
      <span>{label}</span>
      <ChevronRight className="h-4 w-4 text-forward-400" />
    </button>
  );
}

/**
 * Per-person Family Intelligence slice — clear run / Normal / Drive Score /
 * something different — shown when you second-tap someone you're following.
 */
function MemberFamilyIntelCard({
  member,
  state,
  driveImpact,
  onOpenHistory,
}: {
  member: FamilyMapMemberView;
  state: FamilyMapState;
  driveImpact: FamilyDriveImpact | null;
  onOpenHistory: () => void;
}) {
  const first = member.displayName.split(" ")[0] || member.displayName;
  const normal = (state.normalLife ?? []).find((n) => n.memberId === member.id) ?? null;
  const different =
    state.somethingDifferent?.memberId === member.id ? state.somethingDifferent : null;
  const latestTrip =
    (state.recentTrips ?? []).find((t) => t.memberId === member.id) ?? null;
  const memberEvents = (driveImpact?.events ?? []).filter((e) => e.memberId === member.id);
  const aboutThisDrive =
    driveImpact &&
    (driveImpact.primaryMemberId === member.id || memberEvents.length > 0)
      ? driveImpact
      : null;

  let headline: string;
  let detail: string | null = null;
  if (aboutThisDrive && member.presence === "driving") {
    headline =
      aboutThisDrive.etaDeltaMin > 0
        ? aboutThisDrive.headline
        : `${first} is on a clear run`;
    detail = [
      aboutThisDrive.etaMinutes != null
        ? `ETA ${aboutThisDrive.etaMinutes} min${
            aboutThisDrive.etaWasMinutes != null && aboutThisDrive.etaDeltaMin > 0
              ? ` · was ${aboutThisDrive.etaWasMinutes}`
              : ""
          }`
        : null,
      aboutThisDrive.etaDeltaMin > 0
        ? `+${aboutThisDrive.etaDeltaMin} min vs clear`
        : null,
      aboutThisDrive.summary,
    ]
      .filter(Boolean)
      .join(" · ");
  } else if (member.presence === "driving" && member.likelyDestination) {
    headline = `Driving to ${member.likelyDestination}`;
    detail =
      member.etaMinutes != null ? `ETA ${member.etaMinutes} min` : "Live on the map";
  } else if (different) {
    headline = different.title;
    detail = different.body;
  } else if (normal) {
    headline = normal.line;
    detail =
      normal.status === "unusual"
        ? "Different from usual"
        : normal.status === "learning"
          ? "Still learning this rhythm"
          : "Looks normal for them";
  } else if (member.placeName) {
    headline = `At ${member.placeName}`;
    detail = "Family Intelligence fills in as Share Live stays on.";
  } else {
    headline = "Family Intelligence";
    detail = "Drive score, Normal Life, and clear-run alerts show up here.";
  }

  const eventPills = (aboutThisDrive?.events ?? memberEvents).slice(0, 3);

  return (
    <section className="rounded-2xl bg-gradient-to-br from-violet-50 via-white to-sky-50 px-3.5 py-3 ring-1 ring-violet-100/80">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700">
            <Sparkles className="h-3 w-3" />
            Family Intelligence
          </p>
          <h3 className="mt-1 font-display text-base font-semibold leading-snug text-forward-950">
            {headline}
          </h3>
          {detail ? (
            <p className="mt-1 text-xs leading-snug text-forward-600">{detail}</p>
          ) : null}
        </div>
        {latestTrip ? (
          <DriveScoreBubble score={latestTrip.driveScore} size="sm" />
        ) : null}
      </div>

      {eventPills.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {eventPills.map((e) => (
            <span
              key={e.id}
              className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-forward-800 ring-1 ring-forward-100"
            >
              {e.badge?.trim() || e.title}
              {e.etaDeltaMin != null && e.etaDeltaMin > 0
                ? ` · +${e.etaDeltaMin} min`
                : ""}
            </span>
          ))}
        </div>
      ) : null}

      {latestTrip ? (
        <p className="mt-2 text-[11px] text-forward-500">
          Latest drive {latestTrip.fromLabel} → {latestTrip.toLabel}
          {latestTrip.distanceKm != null
            ? ` · ${Number(latestTrip.distanceKm).toFixed(1)} km`
            : ""}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onOpenHistory}
        className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-800"
      >
        Today’s history
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </section>
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
