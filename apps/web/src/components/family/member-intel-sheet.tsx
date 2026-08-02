"use client";

import { useState, type ReactNode } from "react";
import type { FamilyMapMemberView, FamilyMapState } from "@forward/shared";
import { MessageCircle, Navigation, Phone, X } from "lucide-react";
import {
  appleMapsNavigateUrl,
  mapsNavigateUrl,
  preferAppleMaps,
  smsUrl,
  telUrl,
} from "@/lib/family-map/member-actions";

export function MemberIntelSheet({
  member,
  state,
  onClose,
  onSavePlaceAtMember,
}: {
  member: FamilyMapMemberView;
  state: FamilyMapState;
  onClose: () => void;
  onSavePlaceAtMember?: (member: FamilyMapMemberView) => void;
}) {
  const [actionNote, setActionNote] = useState<string | null>(null);
  const trip = state.recentTrips[0];
  const place = state.places.find((p) => p.name === member.placeName);
  const lastFix = member.lastLocationAt
    ? new Date(member.lastLocationAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const area = state.areaIntel;
  const memberAlerts = area?.alerts ?? [];

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

  return (
    <div className="family-intel-sheet pointer-events-auto absolute inset-x-0 bottom-0 z-20 mx-auto max-w-lg px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-h-[min(70vh,560px)] overflow-y-auto overflow-hidden rounded-3xl border border-forward-200/80 bg-white shadow-2xl shadow-forward-900/20">
        <div className="flex items-start gap-3 px-4 pb-2 pt-4">
          <span
            className="mt-0.5 inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-bold text-white shadow"
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
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="truncate font-display text-xl font-semibold text-forward-900">
                  {member.displayName}
                  {member.isYou ? " · You" : ""}
                </h2>
                <p className="mt-0.5 text-sm text-forward-600">{member.statusLabel}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-forward-500 hover:bg-forward-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 px-4 py-3">
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

        {area?.weather ? (
          <div className="mx-4 mb-2 rounded-2xl bg-sky-50 px-3 py-2.5 text-sm text-sky-950">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">
              Area conditions
            </p>
            <p className="mt-0.5 font-medium">
              {area.weather.summary} · {area.weather.tempC}°C
              {area.weather.feelsLikeC != null
                ? ` (feels ${area.weather.feelsLikeC}°)`
                : ""}
              {" · "}wind {area.weather.windKmh} km/h
            </p>
            <p className="mt-1 text-xs text-sky-800">{area.traffic.summary}</p>
          </div>
        ) : null}

        {memberAlerts.length > 0 ? (
          <div className="space-y-1.5 px-4 pb-2">
            {memberAlerts.slice(0, 3).map((alert) => (
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

        <div className="space-y-3 border-t border-forward-100 px-4 py-3 text-sm">
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
              member.driveScoreRecent != null ? `${member.driveScoreRecent}/100` : "No recent trip"
            }
          />
          {place?.insight ? <IntelRow label="Place intel" value={place.insight} /> : null}
          {trip && member.isYou ? (
            <IntelRow
              label="Last trip"
              value={`${trip.fromLabel} → ${trip.toLabel} · ${trip.driveScore}`}
            />
          ) : null}
          <IntelRow label="Last update" value={lastFix ?? "Waiting for location"} />
          {member.isSimulated ? (
            <p className="text-xs text-forward-500">Sample household member for preview.</p>
          ) : null}
        </div>

        {actionNote ? (
          <p className="px-4 pb-2 text-xs text-amber-800">{actionNote}</p>
        ) : null}

        <div className="flex gap-2 border-t border-forward-100 px-4 py-3">
          <ActionButton label="Message" icon={<MessageCircle className="h-4 w-4" />} onClick={runMessage} />
          <ActionButton label="Call" icon={<Phone className="h-4 w-4" />} onClick={runCall} />
          <ActionButton label="Navigate" icon={<Navigation className="h-4 w-4" />} onClick={runNavigate} />
        </div>

        {onSavePlaceAtMember && member.lat != null && member.lng != null ? (
          <div className="border-t border-forward-100 px-4 py-3">
            <button
              type="button"
              onClick={() => onSavePlaceAtMember(member)}
              className="w-full rounded-xl border border-forward-200 py-2.5 text-sm font-semibold text-forward-800 hover:bg-forward-50"
            >
              Name this spot as a saved place
            </button>
          </div>
        ) : null}
      </div>
    </div>
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
