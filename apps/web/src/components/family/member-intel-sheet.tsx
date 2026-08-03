"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { FamilyMapMemberView, FamilyMapState } from "@forward/shared";
import { MessageCircle, Navigation, Phone, X } from "lucide-react";
import { DayTimeline } from "@/components/family/day-timeline";
import {
  appleMapsNavigateUrl,
  mapsNavigateUrl,
  preferAppleMaps,
  smsUrl,
  telUrl,
} from "@/lib/family-map/member-actions";
import type { LocalHistoryTrip } from "@/lib/family-map/local-history-types";

/**
 * Member details — always portaled to document.body so the Leaflet map
 * cannot swallow taps. Close is sticky (X + full-width button + backdrop).
 */
export function MemberIntelSheet({
  member,
  state,
  onClose,
  onSavePlaceAtMember,
  historyRefreshKey = 0,
  selectedHistoryTripId = null,
  onSelectHistoryTrip,
}: {
  member: FamilyMapMemberView;
  state: FamilyMapState;
  onClose: () => void;
  onSavePlaceAtMember?: (member: FamilyMapMemberView) => void;
  historyRefreshKey?: number;
  selectedHistoryTripId?: string | null;
  onSelectHistoryTrip?: (trip: LocalHistoryTrip | null) => void;
}) {
  const [actionNote, setActionNote] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [showMore, setShowMore] = useState(false);
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
      setActionNote(
        member.isSimulated
          ? "Sample member — Message works once a real person joins with a phone on their profile."
          : "No phone on file for them yet. Ask them to add one in account settings."
      );
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
      setActionNote(
        member.isSimulated
          ? "Sample member — Call works for real household members with a phone number."
          : "No phone on file for them yet."
      );
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

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex flex-col justify-end"
      data-testid="member-intel-sheet"
    >
      {/* Full-screen dim — tap to dismiss (sits above the map) */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close member details"
        onClick={onClose}
      />

      {/* Extra floating X — always on screen, never scrolls away */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-forward-900 shadow-lg"
        aria-label="Close"
      >
        <X className="h-6 w-6" strokeWidth={2.5} />
      </button>

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${member.displayName} details`}
        className="relative z-10 mx-auto flex w-full max-w-lg max-h-[min(48vh,380px)] flex-col rounded-t-3xl border border-forward-200/80 bg-white shadow-2xl shadow-forward-900/30"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky chrome — never inside the scroll region */}
        <div className="shrink-0 border-b border-forward-100 bg-white px-4 pb-2.5 pt-2">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-forward-200" />
          <div className="flex items-center gap-3">
            <span
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-bold text-white shadow"
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
              <h2 className="truncate text-base font-semibold text-forward-900">
                {member.displayName}
                {member.isYou ? " · You" : ""}
              </h2>
              <p className="truncate text-xs text-forward-600">{member.statusLabel}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forward-100 text-forward-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-xl bg-forward-900 py-2.5 text-sm font-semibold text-white"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <div className="grid grid-cols-3 gap-2">
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

          <p className="mt-3 text-xs text-forward-600">
            {member.placeName
              ? `${member.placeName}${
                  member.timeAtPlaceMinutes != null
                    ? ` · ${member.timeAtPlaceMinutes} min`
                    : ""
                }`
              : "On the move"}
            {lastFix ? ` · Updated ${lastFix}` : ""}
          </p>

          {memberWeather || area?.weather ? (
            <p className="mt-1.5 text-xs text-sky-900">
              {(memberWeather ?? area!.weather)!.summary} ·{" "}
              {(memberWeather ?? area!.weather)!.tempC}°C
            </p>
          ) : null}

          {memberAlerts.length > 0 ? (
            <div className="mt-2 space-y-1">
              {memberAlerts.slice(0, 1).map((alert) => (
                <p
                  key={alert.id}
                  className={`text-xs ${
                    alert.severity === "warning"
                      ? "text-red-800"
                      : alert.severity === "watch"
                        ? "text-amber-800"
                        : "text-forward-700"
                  }`}
                >
                  <span className="font-semibold">{alert.title}.</span> {alert.body}
                </p>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="mt-3 text-xs font-semibold text-forward-800 underline"
          >
            {showMore ? "Hide details" : "More details"}
          </button>

          {showMore ? (
            <div className="mt-2 space-y-2 border-t border-forward-100 pt-2 text-sm">
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

          <div className="mt-3 border-t border-forward-100 pt-3">
            <DayTimeline
              memberId={member.id}
              isYou={member.isYou}
              member={member}
              refreshKey={historyRefreshKey}
              selectedTripId={selectedHistoryTripId}
              onSelectTrip={(t) => {
                onSelectHistoryTrip?.(t);
                if (t) onClose();
              }}
            />
          </div>

          {actionNote ? (
            <p className="mt-3 text-xs text-amber-800">{actionNote}</p>
          ) : null}

          <div className="mt-3 flex gap-2">
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
              className="mt-3 w-full rounded-xl border border-forward-200 py-2.5 text-sm font-semibold text-forward-800 hover:bg-forward-50"
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
      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-forward-100 py-2.5 text-sm font-semibold text-forward-800 active:bg-forward-200"
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
    <div className="rounded-xl bg-forward-50 px-2 py-2 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-forward-500">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-forward-900">
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
