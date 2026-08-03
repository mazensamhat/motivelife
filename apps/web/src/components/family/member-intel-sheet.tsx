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
    <div className="fixed inset-0 z-[10050] flex flex-col justify-end">
      {/* Dim map / page — tap anywhere outside to close */}
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
        className="relative z-10 mx-auto flex w-full max-w-lg max-h-[min(52vh,420px)] flex-col rounded-t-3xl border border-forward-200/80 bg-white shadow-2xl shadow-forward-900/30"
      >
        {/* Sticky chrome — always visible, never scrolls away */}
        <div className="shrink-0 border-b border-forward-100 bg-white px-4 pb-3 pt-2">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-forward-200" />
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-bold text-white shadow"
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
              <h2 className="truncate font-display text-lg font-semibold text-forward-900">
                {member.displayName}
                {member.isYou ? " · You" : ""}
              </h2>
              <p className="mt-0.5 truncate text-sm text-forward-600">{member.statusLabel}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forward-100 text-forward-800"
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

          {memberWeather || area?.weather ? (
            <div className="mt-3 rounded-2xl bg-sky-50 px-3 py-2.5 text-sm text-sky-950">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">
                {memberWeather ? "Conditions where they are now" : "Area conditions"}
              </p>
              <p className="mt-0.5 font-medium">
                {(memberWeather ?? area!.weather)!.summary} ·{" "}
                {(memberWeather ?? area!.weather)!.tempC}°C
                {(memberWeather ?? area!.weather)!.feelsLikeC != null
                  ? ` (feels ${(memberWeather ?? area!.weather)!.feelsLikeC}°)`
                  : ""}
                {" · "}wind {(memberWeather ?? area!.weather)!.windKmh} km/h
              </p>
            </div>
          ) : null}

          {memberAlerts.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              {memberAlerts.slice(0, 2).map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-xl px-3 py-2 text-xs ${
                    alert.severity === "warning"
                      ? "bg-red-50 text-red-900"
                      : alert.severity === "watch"
                        ? "bg-amber-50 text-amber-950"
                        : "bg-forward-50 text-forward-800"
                  }`}
                >
                  <span className="font-semibold">{alert.title}.</span> {alert.body}
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3 space-y-2.5 border-t border-forward-100 pt-3 text-sm">
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
              label="Current place"
              value={
                member.placeName
                  ? `${member.placeName}${
                      member.timeAtPlaceMinutes != null
                        ? ` · ${member.timeAtPlaceMinutes} min`
                        : ""
                    }`
                  : "On the move"
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
            <IntelRow label="Last update" value={lastFix ?? "Waiting for location"} />
          </div>

          <div className="mt-4 border-t border-forward-100 pt-3">
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

          <div className="mt-4 flex gap-2">
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
    <div className="rounded-2xl bg-forward-50 px-3 py-2.5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-forward-500">{label}</p>
      <p className="mt-0.5 font-display text-lg font-semibold text-forward-900">
        {value}
        {unit ? <span className="ml-0.5 text-xs font-medium text-forward-500">{unit}</span> : null}
      </p>
    </div>
  );
}

function IntelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-forward-500">{label}</span>
      <span className="text-right font-medium text-forward-900">{value}</span>
    </div>
  );
}
