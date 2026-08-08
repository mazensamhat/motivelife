"use client";

import { useMemo, useState } from "react";
import type { FamilyDriveEventKind, FamilyMapState } from "@forward/shared";
import { DriveScoreBubble } from "@/components/family/drive-score-bubble";
import { buildFamilyLifeBrief } from "@/lib/family-map/life-brief";
import { DRIVE_EVENT_META } from "@/lib/family-map/drive-impact";
import { FAMILY_BUBBLE_CARD_PADDED } from "@/lib/family-map/ui-theme";

/**
 * Calm Family Brief under the map — one composition instead of the old 8-KPI farm.
 * When drive impact is live, Route Orb signals become the hero headline + pills.
 */
export function FamilyBriefCard({
  state,
  onOpenMember,
}: {
  state: FamilyMapState;
  onOpenMember?: (id: string) => void;
}) {
  const [openMore, setOpenMore] = useState(false);
  const brief = useMemo(() => buildFamilyLifeBrief(state), [state]);
  const impact = state.areaIntel?.driveImpact ?? null;

  const movers = state.members.filter(
    (m) => m.presence === "driving" || m.presence === "moving"
  );
  const atHome = state.members.filter(
    (m) => m.placeCategory === "home" || /home/i.test(m.placeName ?? "")
  );

  const headline = impact?.headline
    ? impact.headline
    : movers.length === 1
      ? `${movers[0]!.displayName} is ${
          movers[0]!.presence === "driving" ? "driving" : "on the move"
        }`
      : movers.length > 1
        ? `${movers.length} people on the move`
        : atHome.length === state.members.length && state.members.length > 0
          ? "Everyone’s settled"
          : state.somethingDifferent
            ? state.somethingDifferent.title
            : state.flow.everyoneHomeByLabel ?? "Family looks good";

  const line = impact
    ? [
        impact.etaMinutes != null
          ? `ETA ${impact.etaMinutes} min${
              impact.etaWasMinutes != null && impact.etaDeltaMin > 0
                ? ` · was ${impact.etaWasMinutes}`
                : ""
            }`
          : null,
        impact.etaDeltaMin > 0 ? `+${impact.etaDeltaMin} min vs clear` : null,
        impact.summary,
      ]
        .filter(Boolean)
        .join(" · ")
    : movers[0]?.likelyDestination && movers[0]?.etaMinutes != null
      ? `Toward ${movers[0].likelyDestination} · ETA ${movers[0].etaMinutes} min`
      : state.smartDeparture
        ? `Leave by ${state.smartDeparture.leaveByLabel} for ${state.smartDeparture.destinationName}`
        : state.somethingDifferent
          ? `${state.somethingDifferent.memberName} — ${state.somethingDifferent.body}`
          : brief.insights[0] ?? brief.summary;

  const flowValue =
    state.flow.everyoneHomeByLabel?.replace(/^Everyone (is )?home by /i, "Home by ") ??
    (atHome.length
      ? `${atHome.length}/${state.members.length} home`
      : movers.length
        ? `${movers.length} moving`
        : "Watching");
  const leaveValue = state.smartDeparture?.leaveByLabel ?? "No trip soon";
  const differentValue = impact
    ? impact.etaDeltaMin > 0
      ? `+${impact.etaDeltaMin} min`
      : "On pace"
    : state.somethingDifferent
      ? state.somethingDifferent.memberName
      : "All normal";

  const topInsights = brief.insights.slice(0, 3);
  const eventPills = (impact?.events ?? []).slice(0, 4);

  return (
    <section className={FAMILY_BUBBLE_CARD_PADDED}>
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full opacity-50"
        style={{
          background: impact
            ? impact.routeTint === "traffic"
              ? "radial-gradient(circle, rgba(248,113,113,0.22), transparent 70%)"
              : impact.routeTint === "weather"
                ? "radial-gradient(circle, rgba(56,189,248,0.24), transparent 70%)"
                : "radial-gradient(circle, rgba(167,139,250,0.22), transparent 70%)"
            : state.somethingDifferent
              ? "radial-gradient(circle, rgba(255,140,0,0.22), transparent 70%)"
              : "radial-gradient(circle, rgba(0,198,255,0.2), transparent 70%)",
        }}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forward-400">
              Family Intelligence
            </p>
            <h3 className="mt-1 font-display text-[1.45rem] font-semibold leading-tight tracking-tight text-forward-950">
              {headline}
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-forward-600">
              {line}
            </p>
            {!impact ? (
              <p className="mt-1.5 text-xs leading-relaxed text-forward-500">
                {brief.summary}
              </p>
            ) : null}
          </div>
          <DriveScoreBubble score={brief.avgDriveScore} size="md" />
        </div>

        {eventPills.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {eventPills.map((e) => (
              <EventPill key={e.id} kind={e.kind} title={e.title} detail={e.detail} />
            ))}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-forward-100 pt-4">
          <QuietMetric label="Flow" value={flowValue} />
          <QuietMetric
            label="Leave by"
            value={leaveValue}
            emphasize={Boolean(state.smartDeparture)}
          />
          <QuietMetric
            label={impact ? "Impact" : "Different"}
            value={differentValue}
            muted={!impact && !state.somethingDifferent}
            emphasize={Boolean(impact && impact.etaDeltaMin > 0)}
          />
        </div>

        {topInsights.length ? (
          <ul className="mt-4 space-y-2 border-t border-forward-100 pt-4">
            {topInsights.map((insight) => (
              <li
                key={insight}
                className="flex gap-2 text-sm leading-snug text-forward-700"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          {brief.chips.map((c) => (
            <div
              key={c.label}
              className={`rounded-2xl px-3 py-2.5 ring-1 ${
                c.tone === "good"
                  ? "bg-emerald-50 ring-emerald-100"
                  : c.tone === "watch"
                    ? "bg-amber-50 ring-amber-100"
                    : "bg-forward-50 ring-forward-100"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-forward-400">
                {c.label}
              </p>
              <p className="mt-0.5 font-display text-base font-semibold text-forward-900">
                {c.value}
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOpenMore((v) => !v)}
          className="mt-4 rounded-full bg-forward-100 px-3 py-1.5 text-xs font-semibold text-forward-600 transition hover:bg-forward-200 hover:text-forward-900"
        >
          {openMore ? "Hide more" : "Family time · alerts · open person"}
        </button>

        {openMore ? (
          <div className="mt-3 space-y-2 border-t border-forward-50 pt-3 text-sm">
            {state.familyTime?.insight ? (
              <div className="rounded-2xl bg-sky-50 px-3 py-2.5 ring-1 ring-sky-100">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                  Family time
                </p>
                <p className="mt-0.5 text-forward-800">{state.familyTime.insight}</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-forward-50 px-3 py-2.5 ring-1 ring-forward-100">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-forward-400">
                  Family time
                </p>
                <p className="mt-0.5 text-forward-600">
                  Overlap at Home fills in after a few shared evenings with Share
                  Live on.
                </p>
              </div>
            )}
            {brief.insights.slice(3).map((insight) => (
              <p key={insight} className="text-xs leading-relaxed text-forward-600">
                {insight}
              </p>
            ))}
            {(impact?.primaryMemberId || state.somethingDifferent) && onOpenMember ? (
              <button
                type="button"
                className="w-full rounded-full bg-violet-50 px-3 py-2 text-left text-xs font-semibold text-violet-700 ring-1 ring-violet-100"
                onClick={() => {
                  const id =
                    impact?.primaryMemberId ??
                    state.members.find(
                      (m) => m.displayName === state.somethingDifferent?.memberName
                    )?.id;
                  if (id) onOpenMember(id);
                }}
              >
                Open {impact?.primaryMemberName ?? state.somethingDifferent?.memberName} →
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function EventPill({
  kind,
  title,
  detail,
}: {
  kind: FamilyDriveEventKind;
  title: string;
  detail: string;
}) {
  const meta = DRIVE_EVENT_META[kind];
  const calm =
    /clear/i.test(title) ||
    /clear skies/i.test(title) ||
    /roads clear/i.test(title) ||
    /air looks fine/i.test(title);
  const color = calm
    ? kind === "traffic"
      ? "#34d399"
      : kind === "air"
        ? "#84cc16"
        : "#818cf8"
    : meta.color;
  const short = detail.length > 22 ? title : detail;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm"
      style={{
        background: `linear-gradient(160deg, color-mix(in srgb, ${color} 78%, white), ${color})`,
      }}
      title={detail}
    >
      <span
        className="h-2 w-2 rounded-full bg-white/90"
        aria-hidden
      />
      {calm ? title : meta.label}
      <span className="font-medium text-white/85">· {short}</span>
    </span>
  );
}

function QuietMetric({
  label,
  value,
  emphasize,
  muted,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-2.5 py-2.5 ring-1 ${
        emphasize
          ? "bg-orange-50 ring-orange-100"
          : muted
            ? "bg-forward-50/60 ring-forward-100"
            : "bg-forward-50 ring-forward-100"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-forward-400">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-[0.95rem] font-semibold leading-snug ${
          emphasize
            ? "text-orange-700"
            : muted
              ? "text-forward-500"
              : "text-forward-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
