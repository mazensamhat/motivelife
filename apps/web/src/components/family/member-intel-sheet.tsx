"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  FAMILY_RELATIONSHIP_PRESETS,
  type FamilyAirQuality,
  type FamilyDriveImpact,
  type FamilyMapMemberView,
  type FamilyMapState,
} from "@forward/shared";
import {
  AlertTriangle,
  Battery,
  Bell,
  Briefcase,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  CloudRain,
  Construction,
  Footprints,
  Home,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Sparkles,
  Sun,
  Wind,
  X,
} from "lucide-react";
import { DayTimeline } from "@/components/family/day-timeline";
import { LocationHistoryPanel } from "@/components/family/location-history-panel";
import { DriveScoreBubble } from "@/components/family/drive-score-bubble";
import { authFetch } from "@/lib/auth-fetch";
import { FamilyIntelLockedPreview } from "@/components/family/family-intel-locked-preview";
import { buildKinzoPrediction } from "@/lib/family-map/prediction-display";
import {
  buildRouteFingerprint,
  compareFinishedTrip,
} from "@/lib/family-map/route-fingerprint";
import {
  appleMapsNavigateUrl,
  mapsNavigateUrl,
  preferAppleMaps,
  smsUrl,
  telUrl,
} from "@/lib/family-map/member-actions";
import { memberPresenceSubtitle } from "@/lib/family-map/member-presence-label";
import type { LocalHistoryTrip } from "@/lib/family-map/local-history-types";
import { isElevatedAirQuality } from "@/lib/family-map/air-quality";
import {
  kinzoStatusBadgeClass,
  kinzoStatusForMember,
  KINZO_UI,
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
              <h2 className="truncate text-base font-semibold tracking-normal text-forward-900">
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
                  <p className="text-lg font-semibold leading-snug tracking-normal text-forward-900">
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
                          member.leaveInMinutes != null &&
                          member.presence === "stationary" &&
                          member.placeName
                            ? member.leaveInMinutes <= 1
                              ? `Usually leaves soon`
                              : `Usually leaves in ~${member.leaveInMinutes} min`
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

              <KinzoPredictsPanel member={member} />
              <RouteFingerprintPanel member={member} state={state} />

              {intel ? (
                <MemberFamilyIntelCard
                  member={member}
                  state={state}
                  driveImpact={driveImpact}
                  onOpenHistory={() => setMode("history")}
                />
              ) : null}

              <MemberConditionCards
                member={member}
                state={state}
                driveImpact={driveImpact}
              />

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
 * Weather / traffic / air cards on the member detail sheet (second-tap focus).
 * Uses household area intel, per-member weather/air when available, and this
 * person's drive-impact events while they're on the road.
 */
function MemberConditionCards({
  member,
  state,
  driveImpact,
}: {
  member: FamilyMapMemberView;
  state: FamilyMapState;
  driveImpact: FamilyDriveImpact | null;
}) {
  const area = state.areaIntel;
  const memberWeather =
    area?.memberWeather?.find((mw) => mw.memberId === member.id)?.weather ??
    area?.weather ??
    null;
  const memberAir: FamilyAirQuality | null =
    area?.memberAirQuality?.find((ma) => ma.memberId === member.id)
      ?.airQuality ??
    area?.airQuality ??
    null;
  const memberEvents = (driveImpact?.events ?? []).filter(
    (e) => e.memberId === member.id
  );
  const trafficEvent =
    memberEvents.find((e) => e.kind === "traffic") ??
    memberEvents.find((e) =>
      ["construction", "accident", "closure", "hazard"].includes(e.kind)
    ) ??
    null;
  const traffic = area?.traffic ?? null;
  const wet = Boolean(
    memberWeather &&
      (memberWeather.severe ||
        memberWeather.precipMm >= 0.4 ||
        memberWeather.code >= 51)
  );
  const airHit = Boolean(
    memberAir &&
      (isElevatedAirQuality(memberAir) || memberAir.level === "moderate")
  );
  const slow =
    traffic?.level === "slow" ||
    Boolean(trafficEvent && trafficEvent.severity !== "info");
  const roadHit = Boolean(
    trafficEvent &&
      ["construction", "accident", "closure", "hazard"].includes(
        trafficEvent.kind
      )
  );

  const weatherLabel = memberWeather
    ? `${memberWeather.summary || "Weather"} · ${memberWeather.tempC}°C`
    : null;
  const airLabel = memberAir
    ? airHit
      ? `Air · AQI ${memberAir.aqi}`
      : `AQI ${memberAir.aqi}`
    : null;
  const trafficLabel = trafficEvent
    ? `${trafficEvent.title}${
        trafficEvent.etaDeltaMin
          ? ` · +${trafficEvent.etaDeltaMin} min`
          : trafficEvent.badge
            ? ` · ${trafficEvent.badge}`
            : ""
      }`
    : member.presence === "driving"
      ? slow
        ? "Slower roads"
        : traffic?.level === "clear"
          ? "Roads clear"
          : "Road feel"
      : traffic?.level === "slow"
        ? "Slower roads nearby"
        : null;

  if (!weatherLabel && !airLabel && !trafficLabel) return null;

  const WeatherIcon = wet
    ? CloudRain
    : memberWeather && memberWeather.code >= 2
      ? Cloud
      : Sun;

  return (
    <div className="grid gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-forward-500">
        Conditions
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {weatherLabel ? (
          <div
            className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 ring-1 ring-sky-100/90"
            style={{
              background: wet
                ? "color-mix(in srgb, #0EA5E9 16%, white)"
                : "color-mix(in srgb, #0EA5E9 9%, white)",
              borderLeft: `3px solid ${KINZO_UI.weather}`,
            }}
          >
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: KINZO_UI.weather }}
            >
              <WeatherIcon className="h-4 w-4" strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                Weather
              </p>
              <p className="truncate text-xs font-semibold text-forward-900">
                {weatherLabel}
              </p>
            </div>
          </div>
        ) : null}
        {airLabel ? (
          <div
            className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 ring-1 ring-lime-100/90"
            style={{
              background: airHit
                ? "color-mix(in srgb, #84cc16 16%, white)"
                : "color-mix(in srgb, #84cc16 9%, white)",
              borderLeft: "3px solid #65a30d",
            }}
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime-600 text-white">
              <Wind className="h-4 w-4" strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-lime-900">
                Air quality
              </p>
              <p className="truncate text-xs font-semibold text-forward-900">
                {airLabel}
              </p>
              {memberAir?.summary ? (
                <p className="truncate text-[10px] text-forward-500">
                  {memberAir.summary}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        {trafficLabel ? (
          <div
            className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 ring-1 ring-forward-100/90"
            style={{
              background: slow
                ? "color-mix(in srgb, #EF4444 14%, white)"
                : roadHit
                  ? "color-mix(in srgb, #F97316 14%, white)"
                  : "color-mix(in srgb, #22C55E 11%, white)",
              borderLeft: `3px solid ${
                slow
                  ? KINZO_UI.traffic
                  : roadHit
                    ? KINZO_UI.construction
                    : "#22C55E"
              }`,
            }}
          >
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
              style={{
                background: slow
                  ? KINZO_UI.traffic
                  : roadHit
                    ? KINZO_UI.construction
                    : "#16A34A",
              }}
            >
              {roadHit && !slow ? (
                <Construction className="h-4 w-4" strokeWidth={2.4} />
              ) : (
                <Car className="h-4 w-4" strokeWidth={2.4} />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-forward-700">
                {roadHit && !slow ? "Road" : "Traffic"}
              </p>
              <p className="truncate text-xs font-semibold text-forward-900">
                {trafficLabel}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Per-person Family Intelligence slice — clear run / Normal / Drive Score /
 * something different — shown when you second-tap someone you're following.
 */
function KinzoPredictsPanel({ member }: { member: FamilyMapMemberView }) {
  const [showWhy, setShowWhy] = useState(false);
  const card = buildKinzoPrediction(member);
  if (!card) return null;

  return (
    <div className="mt-2 rounded-2xl bg-gradient-to-br from-violet-50 via-white to-sky-50 px-3 py-2.5 ring-1 ring-violet-100/80">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700">
            <Sparkles className="h-3 w-3" />
            Kinzo predicts
          </p>
          <p className="mt-1 text-sm font-semibold leading-snug tracking-normal text-forward-950">
            Likely heading {card.destination}
            <span className="ml-1.5 text-violet-700">{card.confidencePct}%</span>
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-forward-600">
            {[
              card.arriveWindowLabel ? `Expected ${card.arriveWindowLabel}` : null,
              card.typicalDriveLabel,
              card.tripKind,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-violet-800 ring-1 ring-violet-100"
        >
          {showWhy ? "Hide" : "Why?"}
        </button>
      </div>
      {showWhy ? (
        <ul className="mt-2 space-y-1 border-t border-violet-100/80 pt-2">
          {card.reasons.map((r) => (
            <li
              key={r}
              className="flex gap-2 text-[11px] leading-snug text-forward-700"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function RouteFingerprintPanel({
  member,
  state,
}: {
  member: FamilyMapMemberView;
  state: FamilyMapState;
}) {
  const trips = state.recentTrips ?? [];
  const live = buildRouteFingerprint(member, trips);
  const latest =
    trips.find((t) => t.memberId === member.id && t.endedAt) ??
    trips.find((t) => t.memberId === member.id) ??
    null;
  const finished = latest && !live?.unusual ? compareFinishedTrip(latest, trips) : null;
  const card = live?.unusual ? live : finished?.unusual ? finished : live ?? finished;
  if (!card) return null;

  return (
    <div
      className={`rounded-2xl px-3 py-2.5 ring-1 ${
        card.unusual
          ? "bg-amber-50/90 ring-amber-100"
          : "bg-forward-50/90 ring-forward-100"
      }`}
    >
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
          card.unusual ? "text-amber-800" : "text-forward-500"
        }`}
      >
        Route · {card.badge}
      </p>
      <p className="mt-0.5 text-sm font-semibold leading-snug text-forward-900">
        {card.title}
      </p>
      {card.detail ? (
        <p className="mt-0.5 text-[11px] text-forward-600">{card.detail}</p>
      ) : null}
    </div>
  );
}

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
  } else if (
    member.leaveInMinutes != null &&
    member.presence === "stationary" &&
    member.placeName
  ) {
    headline =
      member.leaveInMinutes <= 1
        ? `Usually leaving ${member.placeName} now`
        : `Usually leaves ${member.placeName} in ~${member.leaveInMinutes} min`;
    detail = normal?.line ?? "Based on their weekday rhythm";
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
          <h3 className="mt-1 text-base font-semibold leading-snug tracking-normal text-forward-950">
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
