"use client";

import {
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  FAMILY_RELATIONSHIP_PRESETS,
  type FamilyMapMemberView,
  type FamilyMapState,
} from "@forward/shared";
import { MessageCircle, Navigation, Phone, X } from "lucide-react";
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

/**
 * Member details — portaled above the Leaflet map, positioned over the map
 * card (not stuck to the browser/viewport bottom).
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
  anchorRef,
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
  /** Map wrapper — overlay clips/positions to this rect when available */
  anchorRef?: RefObject<HTMLElement | null>;
}) {
  const [actionNote, setActionNote] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [anchorBox, setAnchorBox] = useState<DOMRect | null>(null);
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
    const select = relationshipSelectValue(member.relationshipLabel);
    setRelationDraft(select);
    setCustomRelation(select === "Other" ? member.relationshipLabel ?? "" : "");
  }, [member.id, member.relationshipLabel]);

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
      const next = (await res.json()) as FamilyMapState;
      onMemberUpdated?.(next);
    } catch {
      setActionNote("Could not save relationship. Check your connection.");
    } finally {
      setRelationBusy(false);
    }
  }
  const trip = state.recentTrips[0];
  const place = state.places.find((p) => p.name === member.placeName);
  const lastFix = member.lastLocationAt
    ? new Date(member.lastLocationAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const area = state.areaIntel;
  const memberWeather =
    area?.memberWeather?.find((w) => w.memberId === member.id)?.weather ?? null;
  const memberAlerts = (area?.alerts ?? []).filter(
    (a) => !a.memberId || a.memberId === member.id
  );

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useLayoutEffect(() => {
    const el = anchorRef?.current;
    if (!el) {
      setAnchorBox(null);
      return;
    }
    const update = () => setAnchorBox(el.getBoundingClientRect());
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  const overlayStyle = anchorBox
    ? {
        top: Math.max(0, anchorBox.top),
        left: Math.max(0, anchorBox.left),
        width: anchorBox.width,
        height: anchorBox.height,
      }
    : undefined;

  return createPortal(
    <div
      className={
        anchorBox
          ? "fixed z-[10050] flex items-center justify-center p-3 sm:p-4"
          : "fixed inset-0 z-[10050] flex items-center justify-center p-3 sm:p-4"
      }
      style={overlayStyle}
      data-testid="member-intel-sheet"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close member details"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${member.displayName} details`}
        className="relative z-10 flex max-h-[min(72%,520px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-forward-200/80 bg-white shadow-2xl shadow-forward-900/35"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-forward-100 bg-white px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white shadow"
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
              <h2 className="truncate text-sm font-semibold text-forward-900">
                {member.displayName}
                {member.isYou ? " · You" : ""}
              </h2>
              <p className="truncate text-xs text-forward-600">
                {member.relationshipLabel
                  ? `${member.relationshipLabel} · ${member.statusLabel}`
                  : member.statusLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forward-100 text-forward-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            <IntelStat
              label="ETA"
              value={member.etaMinutes != null ? `${member.etaMinutes}m` : "—"}
            />
            <IntelStat
              label="Speed"
              value={member.speedKmh != null ? `${Math.round(member.speedKmh)}` : "—"}
              unit={member.speedKmh != null ? "km/h" : undefined}
            />
            <IntelStat
              label="Battery"
              value={member.batteryPercent != null ? `${member.batteryPercent}%` : "—"}
            />
          </div>

          <p className="mt-2 text-xs text-forward-600">
            {member.placeName
              ? `${member.placeName}${
                  member.timeAtPlaceMinutes != null
                    ? ` · ${member.timeAtPlaceMinutes} min`
                    : ""
                }`
              : "On the move"}
            {lastFix ? ` · ${lastFix}` : ""}
            {memberWeather || area?.weather
              ? ` · ${(memberWeather ?? area!.weather)!.tempC}°`
              : ""}
          </p>

          {memberAlerts.length > 0 ? (
            <p
              className={`mt-1.5 text-xs ${
                memberAlerts[0]!.severity === "warning"
                  ? "text-red-800"
                  : memberAlerts[0]!.severity === "watch"
                    ? "text-amber-800"
                    : "text-forward-700"
              }`}
            >
              <span className="font-semibold">{memberAlerts[0]!.title}.</span>{" "}
              {memberAlerts[0]!.body}
            </p>
          ) : null}

          <label className="mt-2.5 block text-[11px] font-semibold uppercase tracking-wide text-forward-500">
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
            <div className="mt-1.5 flex gap-2">
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
          <p className="mt-1 text-[11px] text-forward-500">
            {member.isYou
              ? "Label yourself for the household — Dad, Mom, etc."
              : `Who is ${member.displayName.split(" ")[0] ?? "they"} to your family?`}
          </p>

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="mt-2 text-xs font-semibold text-forward-800 underline"
          >
            {showMore ? "Hide details" : "More details"}
          </button>

          {showMore ? (
            <div className="mt-2 space-y-1.5 border-t border-forward-100 pt-2 text-sm">
              <IntelRow
                label="Likely destination"
                value={
                  member.likelyDestination
                    ? `${member.likelyDestination}${
                        member.destinationConfidence != null
                          ? ` · ${Math.round(member.destinationConfidence * 100)}%`
                          : ""
                      }`
                    : "Learning…"
                }
              />
              <IntelRow
                label="Drive score"
                value={
                  member.driveScoreRecent != null
                    ? `${member.driveScoreRecent}/100`
                    : "No recent trip"
                }
              />
              {member.vehicleLabel ? (
                <IntelRow label="Vehicle" value={member.vehicleLabel} />
              ) : null}
              {place?.insight ? <IntelRow label="Place intel" value={place.insight} /> : null}
              {trip && member.isYou ? (
                <IntelRow
                  label="Last trip"
                  value={`${trip.fromLabel} → ${trip.toLabel} · ${trip.driveScore}${
                    trip.estimatedFuelCostCad != null
                      ? ` · ~$${trip.estimatedFuelCostCad.toFixed(2)} fuel`
                      : ""
                  }`}
                />
              ) : null}
            </div>
          ) : null}

          <div className="mt-2.5 border-t border-forward-100 pt-2.5">
            <LocationHistoryPanel
              memberId={member.id}
              memberName={member.displayName}
              isYou={member.isYou}
              refreshKey={historyRefreshKey}
              selectedTripId={selectedHistoryTripId}
              onHighlightPlaces={onHighlightPlaces}
              onSelectTrip={(t) => {
                onSelectHistoryTrip?.(t);
                if (t) onClose();
              }}
            />
          </div>

          {actionNote ? (
            <p className="mt-2 text-xs text-amber-800">{actionNote}</p>
          ) : null}

          <div className="mt-2.5 flex gap-2">
            <ActionButton
              label="Message"
              icon={<MessageCircle className="h-4 w-4" />}
              onClick={runMessage}
            />
            <ActionButton label="Call" icon={<Phone className="h-4 w-4" />} onClick={runCall} />
            <ActionButton
              label="Navigate"
              icon={<Navigation className="h-4 w-4" />}
              onClick={runNavigate}
            />
          </div>

          {onSavePlaceAtMember && member.lat != null && member.lng != null ? (
            <button
              type="button"
              onClick={() => onSavePlaceAtMember(member)}
              className="mt-2 w-full rounded-xl border border-forward-200 py-2 text-sm font-semibold text-forward-800 hover:bg-forward-50"
            >
              Name this spot as a saved place
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
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
      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-forward-100 py-2 text-sm font-semibold text-forward-800 active:bg-forward-200"
    >
      {icon}
      {label}
    </button>
  );
}

function IntelStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-lg bg-forward-50 px-2 py-1.5 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-forward-500">{label}</p>
      <p className="text-sm font-semibold text-forward-900">
        {value}
        {unit ? <span className="ml-0.5 text-[10px] font-medium text-forward-500">{unit}</span> : null}
      </p>
    </div>
  );
}

function IntelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="shrink-0 text-forward-500">{label}</span>
      <span className="text-right font-medium text-forward-900">{value}</span>
    </div>
  );
}
