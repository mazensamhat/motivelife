"use client";

import type { ReactNode } from "react";
import type { FamilyMapMemberView, FamilyMapState } from "@forward/shared";
import { Car, Footprints, MessageCircle, Navigation, Phone } from "lucide-react";
import { buildFamilyLifeBrief } from "@/lib/family-map/life-brief";
import {
  appleMapsNavigateUrl,
  mapsNavigateUrl,
  preferAppleMaps,
  smsUrl,
  telUrl,
} from "@/lib/family-map/member-actions";

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
    const speed =
      m.speedKmh != null ? ` · ${Math.round(m.speedKmh)} km/h` : "";
    return `Driving${speed}`;
  }
  if (m.presence === "moving") return "On the move";
  const dwell = dwellLabel(m.timeAtPlaceMinutes);
  if (m.placeName && dwell) return `At ${m.placeName} · ${dwell}`;
  if (m.placeName) return `At ${m.placeName}`;
  return m.statusLabel || "Live";
}

export function buildMemberInsight(
  member: FamilyMapMemberView,
  state: FamilyMapState
): string {
  const sd = state.somethingDifferent;
  if (sd && sd.memberName === member.displayName) {
    return sd.body?.trim()
      ? `${sd.title}: ${sd.body}`
      : `${member.displayName} — ${sd.title}`;
  }
  if (member.presence === "driving") {
    if (member.likelyDestination && member.etaMinutes != null) {
      return `${member.displayName} is driving to ${member.likelyDestination} · ETA ${member.etaMinutes} min.`;
    }
    return `${member.displayName} is on the move — live speed on the map.`;
  }
  const dwell = dwellLabel(member.timeAtPlaceMinutes);
  if (member.placeName && dwell && (member.timeAtPlaceMinutes ?? 0) >= 40) {
    return `${member.displayName} has been at ${member.placeName} longer than a quick stop (${dwell}).`;
  }
  if (member.placeName) {
    return `${member.displayName} looks settled at ${member.placeName}.`;
  }
  const brief = buildFamilyLifeBrief(state);
  return brief.insights[0] ?? "Live map plus what the household’s movement is teaching us.";
}

/**
 * Map-first bottom sheet: selected person, quick actions, Family Intelligence
 * insight, and horizontal family carousel. No side panel.
 */
export function FamilyMapPeopleSheet({
  members,
  selectedId,
  state,
  intelligenceUnlocked,
  onSelectMember,
  onOpenDetails,
  onBack,
}: {
  members: FamilyMapMemberView[];
  selectedId: string | null;
  state: FamilyMapState;
  intelligenceUnlocked: boolean;
  onSelectMember: (id: string) => void;
  onOpenDetails: (id: string) => void;
  onBack?: () => void;
}) {
  const selected =
    members.find((m) => m.id === selectedId) ?? members[0] ?? null;
  if (!selected) return null;

  const insight = buildMemberInsight(selected, state);
  const status = memberStatusLine(selected);

  function runMessage() {
    if (!selected.phoneNumber) return;
    window.location.href = smsUrl(
      selected.phoneNumber,
      `Hey ${selected.displayName.split(" ")[0] ?? ""} — checking in from MyMotiveFamily.`
    );
  }
  function runCall() {
    if (!selected.phoneNumber) return;
    window.location.href = telUrl(selected.phoneNumber);
  }
  function runNavigate() {
    if (selected.lat == null || selected.lng == null) return;
    const label = selected.placeName || selected.displayName;
    const url = preferAppleMaps()
      ? appleMapsNavigateUrl(selected.lat, selected.lng, label)
      : mapsNavigateUrl(selected.lat, selected.lng, label);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-2 pb-2 sm:px-3 sm:pb-3">
      <div className="pointer-events-auto rounded-[1.75rem] bg-white/97 shadow-[0_-12px_40px_-16px_rgba(10,25,48,0.35)] ring-1 ring-forward-100/80 backdrop-blur-md">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-forward-200" />

        <div className="flex items-start justify-between gap-3 px-4 pb-1 pt-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="mr-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forward-100 text-sm font-semibold text-forward-800"
                  aria-label="Back to overview"
                >
                  ←
                </button>
              ) : null}
              <h2 className="truncate font-display text-lg font-semibold tracking-tight text-forward-950">
                {selected.displayName}
              </h2>
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  background:
                    selected.presence === "driving" || selected.presence === "moving"
                      ? "#12b886"
                      : selected.color,
                }}
              />
            </div>
            <p className="mt-0.5 truncate text-sm text-forward-500">
              {status}
              {selected.relationshipLabel
                ? ` · ${selected.relationshipLabel}`
                : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <IconAction
              label="Message"
              onClick={runMessage}
              disabled={!selected.phoneNumber}
            >
              <MessageCircle className="h-4 w-4" />
            </IconAction>
            <IconAction
              label="Call"
              onClick={runCall}
              disabled={!selected.phoneNumber}
            >
              <Phone className="h-4 w-4" />
            </IconAction>
            <IconAction
              label="Navigate"
              onClick={runNavigate}
              disabled={selected.lat == null || selected.lng == null}
            >
              <Navigation className="h-4 w-4" />
            </IconAction>
          </div>
        </div>

        {intelligenceUnlocked ? (
          <div className="mx-4 mt-2 rounded-2xl bg-gradient-to-br from-violet-50 to-sky-50 px-3.5 py-3 ring-1 ring-violet-100/80">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-700">
              <span aria-hidden>✦</span>
              Family Intelligence
            </div>
            <p className="mt-1.5 text-sm leading-snug text-forward-800">{insight}</p>
            <button
              type="button"
              onClick={() => onOpenDetails(selected.id)}
              className="mt-2 text-xs font-semibold text-violet-700"
            >
              View details →
            </button>
          </div>
        ) : (
          <div className="mx-4 mt-2 rounded-2xl bg-forward-50 px-3.5 py-3 ring-1 ring-forward-100">
            <p className="text-sm text-forward-700">
              Live map + speed stay free. Unlock Family Intelligence for history
              and insights.
            </p>
            <button
              type="button"
              onClick={() => onOpenDetails(selected.id)}
              className="mt-2 text-xs font-semibold text-forward-900"
            >
              Details →
            </button>
          </div>
        )}

        <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {members.map((m) => {
            const active = m.id === selected.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectMember(m.id)}
                className={`relative min-w-[6.8rem] shrink-0 rounded-2xl px-2.5 py-2.5 text-left transition ${
                  active
                    ? "bg-sky-50 ring-2 ring-sky-400"
                    : "bg-forward-50 ring-1 ring-forward-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold text-white"
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
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 truncate text-xs font-semibold text-forward-900">
                      {m.displayName.split(" ")[0]}
                      {m.presence === "driving" ? (
                        <Car className="h-3 w-3 text-blue-700" aria-hidden />
                      ) : m.presence === "moving" ? (
                        <Footprints className="h-3 w-3 text-sky-700" aria-hidden />
                      ) : null}
                    </p>
                    <p className="truncate text-[10px] text-forward-500">
                      {m.presence === "driving"
                        ? "Driving"
                        : m.placeName ?? m.statusLabel}
                    </p>
                  </div>
                </div>
                {active ? (
                  <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-sky-500" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-violet-800 shadow-sm ring-1 ring-violet-100 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
