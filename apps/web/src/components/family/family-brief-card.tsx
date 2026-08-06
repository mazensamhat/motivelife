"use client";

import { useMemo, useState } from "react";
import type { FamilyMapState } from "@forward/shared";
import { buildFamilyLifeBrief } from "@/lib/family-map/life-brief";

/**
 * Calm Family Brief under the map — one composition instead of the old 8-KPI farm.
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

  const movers = state.members.filter(
    (m) => m.presence === "driving" || m.presence === "moving"
  );
  const atHome = state.members.filter(
    (m) => m.placeCategory === "home" || /home/i.test(m.placeName ?? "")
  );

  const headline =
    movers.length === 1
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

  const line =
    movers[0]?.likelyDestination && movers[0]?.etaMinutes != null
      ? `Toward ${movers[0].likelyDestination} · ETA ${movers[0].etaMinutes} min`
      : state.smartDeparture
        ? `Leave by ${state.smartDeparture.leaveByLabel} for ${state.smartDeparture.destinationName}`
        : state.somethingDifferent
          ? `${state.somethingDifferent.memberName} — ${state.somethingDifferent.body}`
          : brief.insights[0] ?? brief.summary;

  const flowValue =
    state.flow.everyoneHomeByLabel?.replace(/^Everyone (is )?home by /i, "Home by ") ??
    (atHome.length ? `${atHome.length} home` : "Learning");
  const leaveValue = state.smartDeparture?.leaveByLabel ?? "Nothing soon";
  const differentValue = state.somethingDifferent
    ? state.somethingDifferent.memberName
    : "All normal";

  return (
    <section className="relative overflow-hidden rounded-[1.35rem] bg-white px-5 py-5 shadow-sm ring-1 ring-forward-100">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full opacity-40"
        style={{
          background: state.somethingDifferent
            ? "radial-gradient(circle, rgba(255,140,0,0.2), transparent 70%)"
            : "radial-gradient(circle, rgba(0,198,255,0.18), transparent 70%)",
        }}
      />
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forward-400">
          Family Intelligence
        </p>
        <h3 className="mt-1 font-display text-[1.45rem] font-semibold leading-tight tracking-tight text-forward-950">
          {headline}
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-forward-600">{line}</p>

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-forward-100 pt-4">
          <QuietMetric label="Flow" value={flowValue} />
          <QuietMetric
            label="Leave by"
            value={leaveValue}
            emphasize={Boolean(state.smartDeparture)}
          />
          <QuietMetric
            label="Different"
            value={differentValue}
            muted={!state.somethingDifferent}
          />
        </div>

        <button
          type="button"
          onClick={() => setOpenMore((v) => !v)}
          className="mt-4 text-xs font-semibold text-forward-500 underline-offset-2 hover:text-forward-800 hover:underline"
        >
          {openMore ? "Hide more" : "Drive · Fuel · Places · Family time"}
        </button>

        {openMore ? (
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-forward-50 pt-3 text-sm">
            {brief.chips.map((c) => (
              <div key={c.label}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-forward-400">
                  {c.label}
                </p>
                <p className="mt-0.5 font-medium text-forward-900">{c.value}</p>
              </div>
            ))}
            {state.familyTime?.insight ? (
              <div className="col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-forward-400">
                  Family time
                </p>
                <p className="mt-0.5 text-forward-800">{state.familyTime.insight}</p>
              </div>
            ) : null}
            {state.somethingDifferent && onOpenMember ? (
              <button
                type="button"
                className="col-span-2 text-left text-xs font-semibold text-violet-700"
                onClick={() => {
                  const id = state.members.find(
                    (m) => m.displayName === state.somethingDifferent?.memberName
                  )?.id;
                  if (id) onOpenMember(id);
                }}
              >
                Open {state.somethingDifferent.memberName} →
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
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
    <div>
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
