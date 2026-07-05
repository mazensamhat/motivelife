"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, ChevronRight, Sparkles, X, Zap } from "lucide-react";
import type {
  AutoPilotProposal,
  CommandCenterTimelineBlock,
  CommandCenterTimelinePayload,
  LifeArea,
} from "@forward/shared";
import { Button } from "./button";
import { cn } from "@/lib/utils";

const AREA_STYLES: Record<
  LifeArea,
  { bar: string; badge: string; label: string }
> = {
  career: { bar: "bg-brand-blue", badge: "bg-brand-blue/15 text-brand-blue", label: "Career" },
  health: { bar: "bg-brand-green", badge: "bg-brand-green/15 text-brand-green", label: "Health" },
  money: { bar: "bg-amber-500", badge: "bg-amber-500/15 text-amber-700", label: "Money" },
  relationships: {
    bar: "bg-rose-400",
    badge: "bg-rose-400/15 text-rose-700",
    label: "Relationships",
  },
  learning: { bar: "bg-violet-500", badge: "bg-violet-500/15 text-violet-700", label: "Learning" },
  home: { bar: "bg-forward-400", badge: "bg-forward-200 text-forward-700", label: "Home" },
  business: { bar: "bg-orange-500", badge: "bg-orange-500/15 text-orange-700", label: "Business" },
  mindset: { bar: "bg-brand-cyan", badge: "bg-brand-cyan/15 text-teal-700", label: "Mindset" },
};

function BlockDrawer({
  block,
  onClose,
  onCompleteMission,
}: {
  block: CommandCenterTimelineBlock;
  onClose: () => void;
  onCompleteMission?: () => void;
}) {
  const [prep, setPrep] = useState(block.coaching?.prepItems ?? []);
  const area = AREA_STYLES[block.lifeArea];

  async function completeMission() {
    if (!block.missionId) return;
    if (block.missionKind === "habit") {
      await fetch("/api/habits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: block.missionId, checkIn: true }),
      });
    } else {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: block.missionId, status: "DONE" }),
      });
    }
    onCompleteMission?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-forward-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className={cn("h-1.5 w-full", area.bar)} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
                {block.timeLabel} · {area.label}
              </p>
              <h3 className="mt-1 text-xl font-semibold text-forward-900">
                {block.emoji ? `${block.emoji} ` : ""}
                {block.title}
              </h3>
              {block.subtitle ? (
                <p className="mt-1 text-sm text-forward-500">{block.subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-forward-400 hover:bg-forward-100"
            >
              <X size={20} />
            </button>
          </div>

          {block.coaching?.headline ? (
            <p className="mt-4 text-sm leading-relaxed text-forward-700">{block.coaching.headline}</p>
          ) : null}
          {block.coaching?.subline ? (
            <p className="mt-2 text-sm font-medium text-forward-900">{block.coaching.subline}</p>
          ) : null}

          {block.coaching?.intelligence?.prepPercent != null ? (
            <div className="mt-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-forward-400">
                  {block.coaching.intelligence.confidenceLabel ?? "Preparation"}
                </p>
                <span className="text-sm font-semibold tabular-nums text-forward-700">
                  {block.coaching.intelligence.prepPercent}%
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-forward-100">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    block.coaching.intelligence.prepPercent >= 80
                      ? "bg-brand-green"
                      : block.coaching.intelligence.prepPercent >= 60
                        ? "bg-brand-blue"
                        : "bg-amber-500"
                  )}
                  style={{ width: `${block.coaching.intelligence.prepPercent}%` }}
                />
              </div>
            </div>
          ) : null}

          {block.coaching?.aiBriefReady ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-brand-blue/20 bg-brand-blue/5 px-3 py-2 text-sm text-brand-blue">
              <Sparkles size={16} />
              AI brief ready
            </div>
          ) : null}

          {prep.length > 0 ? (
            <ul className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-forward-400">
                Preparation
              </p>
              {prep.map((item, i) => (
                <li key={item.label}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-forward-100 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => {
                        setPrep((prev) =>
                          prev.map((p, j) => (j === i ? { ...p, done: !p.done } : p))
                        );
                      }}
                      className="rounded border-forward-300"
                    />
                    <span className={item.done ? "text-forward-400 line-through" : "text-forward-800"}>
                      {item.label}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : null}

          {block.coaching?.intelligence?.sections?.map((section) => (
            <div key={section.title} className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-forward-400">
                {section.title}
              </p>
              <ul className="mt-2 space-y-1.5">
                {section.items.map((item) => (
                  <li key={item} className="text-sm text-forward-700">
                    · {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {block.coaching?.scoreImpact != null && block.coaching.scoreImpact > 0 ? (
            <p className="mt-4 text-sm font-semibold text-brand-green">
              Potential Life Score +{block.coaching.scoreImpact}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            {block.missionId && block.kind !== "calendar" ? (
              <Button onClick={completeMission}>Mark complete</Button>
            ) : null}
            {block.missionId ? (
              <Link href="/dashboard#mission">
                <Button variant="secondary">View mission</Button>
              </Link>
            ) : null}
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  block,
  onSelect,
}: {
  block: CommandCenterTimelineBlock;
  onSelect: (block: CommandCenterTimelineBlock) => void;
}) {
  const area = AREA_STYLES[block.lifeArea];
  const score = block.coaching?.scoreImpact;
  const prepPercent = block.coaching?.intelligence?.prepPercent;

  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      <div className="flex w-14 shrink-0 flex-col items-end pt-0.5">
        <span className="text-xs font-semibold tabular-nums text-forward-500">{block.timeLabel}</span>
      </div>
      <div className="relative flex min-w-0 flex-1">
        <span
          className={cn("absolute -left-[1.125rem] top-2 h-full w-0.5 -translate-x-1/2", area.bar, "opacity-30")}
          aria-hidden
        />
        <span
          className={cn(
            "absolute -left-[1.125rem] top-2 h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-2 ring-white",
            area.bar
          )}
          aria-hidden
        />
        <button
          type="button"
          onClick={() => onSelect(block)}
          className="group w-full rounded-xl border border-forward-200 bg-white p-3 text-left shadow-sm transition hover:border-forward-300 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", area.badge)}>
                  {area.label}
                </span>
                {block.coaching?.aiBriefReady ? (
                  <span className="text-[10px] font-medium text-brand-blue">AI brief</span>
                ) : null}
                {block.kind === "calendar" && prepPercent != null ? (
                  <span
                    className={cn(
                      "text-[10px] font-medium tabular-nums",
                      prepPercent >= 80
                        ? "text-brand-green"
                        : prepPercent >= 60
                          ? "text-brand-blue"
                          : "text-amber-600"
                    )}
                  >
                    {prepPercent}% prep
                  </span>
                ) : null}
              </div>
              <p className="mt-1 font-semibold text-forward-900">
                {block.emoji ? `${block.emoji} ` : ""}
                {block.title}
              </p>
              {block.coaching?.headline ? (
                <p className="mt-1 line-clamp-2 text-sm text-forward-600">{block.coaching.headline}</p>
              ) : null}
            </div>
            <ChevronRight
              size={18}
              className="shrink-0 text-forward-300 transition group-hover:text-forward-500"
            />
          </div>
          {score != null && score > 0 ? (
            <p className="mt-2 text-xs font-semibold text-brand-green">+{score} Life Score</p>
          ) : null}
        </button>
      </div>
    </li>
  );
}

function WorkloadBar({
  label,
  day,
}: {
  label: string;
  day: CommandCenterTimelinePayload["workload"]["today"];
}) {
  const barColor =
    day.percent >= 90 ? "bg-red-500" : day.percent >= 72 ? "bg-amber-500" : "bg-brand-green";

  return (
    <div className="min-w-[120px] flex-1">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-forward-400">{label}</p>
        <p className="text-xs font-bold tabular-nums text-white">{day.percent}%</p>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${day.percent}%` }} />
      </div>
      <p className="mt-0.5 text-[10px] text-forward-400">{day.label}</p>
    </div>
  );
}

function EnergyCurveChart({
  points,
}: {
  points: NonNullable<CommandCenterTimelinePayload["energyCurve"]>;
}) {
  const max = Math.max(...points.map((p) => p.level), 1);

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">Energy curve</p>
      <div className="mt-2 flex h-16 items-end gap-0.5">
        {points.map((point) => (
          <div key={point.hour} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-gradient-to-t from-brand-cyan/80 to-brand-green/90"
              style={{ height: `${Math.max(8, (point.level / max) * 100)}%` }}
              title={`${point.label}: ${point.level}%`}
            />
            {point.hour % 3 === 0 ? (
              <span className="text-[9px] tabular-nums text-forward-400">{point.hour}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyHeatMap({
  days,
}: {
  days: NonNullable<CommandCenterTimelinePayload["weeklyHeatMap"]>;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">Week load</p>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const color =
            day.percent >= 90 ? "bg-red-500" : day.percent >= 72 ? "bg-amber-500" : "bg-brand-green";
          return (
            <div key={day.dateIso} className="text-center">
              <div
                className={cn(
                  "mx-auto h-8 w-full max-w-[2.25rem] rounded-md opacity-90",
                  color,
                  day.isToday && "ring-2 ring-brand-cyan ring-offset-1"
                )}
                title={`${day.dayLabel}: ${day.percent}%`}
              />
              <p className="mt-1 text-[9px] font-medium text-forward-500">{day.dayLabel}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AutoPilotProposalCard({
  proposal,
  onAccepted,
}: {
  proposal: AutoPilotProposal;
  onAccepted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const area = AREA_STYLES[proposal.lifeArea];
  const start = new Date(proposal.startIso);
  const end = new Date(proposal.endIso);
  const timeLabel = `${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;

  async function accept() {
    setBusy(true);
    try {
      const res = await fetch("/api/calendar/proposals/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proposal),
      });
      if (res.ok) {
        setDone(true);
        onAccepted();
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) return null;

  return (
    <div className="rounded-xl border border-forward-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", area.badge)}>
              {proposal.kind === "reschedule" ? "Reschedule" : "Auto-Pilot"}
            </span>
            <span className="text-xs text-forward-500">{timeLabel}</span>
          </div>
          <p className="mt-1 font-semibold text-forward-900">{proposal.title}</p>
          <p className="mt-1 text-sm text-forward-600">{proposal.reason}</p>
        </div>
        {proposal.canAccept ? (
          <Button size="sm" onClick={accept} disabled={busy}>
            {busy ? "…" : "Accept"}
          </Button>
        ) : (
          <Link href="/integrations">
            <Button size="sm" variant="secondary">
              Reconnect Google
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

export function CommandCenterTimeline({
  data,
  onRefresh,
}: {
  data: CommandCenterTimelinePayload;
  onRefresh?: () => void;
}) {
  const [selected, setSelected] = useState<CommandCenterTimelineBlock | null>(null);
  const [dismissedProposals, setDismissedProposals] = useState<Set<string>>(new Set());

  const visibleProposals =
    data.autoPilot?.proposals.filter((p) => !dismissedProposals.has(p.id)) ?? [];

  const needsInsightsRefresh =
    data.calendarConnected && (!data.energyCurve?.length || !data.weeklyHeatMap?.length);

  return (
    <section className="overflow-hidden rounded-2xl border border-forward-200 bg-white shadow-sm">
      <div className="border-b border-forward-100 bg-gradient-to-r from-forward-950 via-forward-900 to-forward-950 px-5 py-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-cyan">
              AI Command Center
            </p>
            <p className="mt-1 text-sm text-forward-300">Today&apos;s focus</p>
            <p className="text-lg font-semibold">{data.todayFocus}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wider text-forward-400">
              Success probability
            </p>
            <p className="text-3xl font-bold tabular-nums text-brand-green">{data.successProbability}%</p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-green to-brand-cyan transition-all"
            style={{ width: `${data.successProbability}%` }}
          />
        </div>
        {data.calendarConnected ? (
          <div className="mt-4 flex flex-wrap gap-4 border-t border-white/10 pt-4">
            <WorkloadBar label="Today" day={data.workload.today} />
            <WorkloadBar label="Tomorrow" day={data.workload.tomorrow} />
          </div>
        ) : null}
        {data.calendarConnected &&
        data.workload.tomorrow.recommendation &&
        data.workload.tomorrow.percent >= 90 ? (
          <p className="mt-2 text-xs text-amber-200/90">{data.workload.tomorrow.recommendation}</p>
        ) : null}
      </div>

      {!data.calendarConnected && (data.calendarConfigured || true) ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-blue/20 bg-brand-blue/5 px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-forward-700">
            <Calendar size={16} className="text-brand-blue" />
            Connect Google or Apple Calendar to coach around your real schedule.
          </div>
          <Link href="/integrations">
            <Button size="sm">Connect calendars</Button>
          </Link>
        </div>
      ) : null}

      {data.calendarConnected ? (
        <div className="flex flex-wrap gap-2 border-b border-forward-100 px-5 py-2 text-[10px] text-forward-500">
          {data.calendarSources.google ? (
            <span className="rounded-full bg-forward-100 px-2 py-0.5">Google synced</span>
          ) : null}
          {data.calendarSources.apple ? (
            <span className="rounded-full bg-forward-100 px-2 py-0.5">Apple synced</span>
          ) : null}
          {needsInsightsRefresh && onRefresh ? (
            <button
              type="button"
              onClick={() => onRefresh()}
              className="rounded-full bg-brand-cyan/15 px-2 py-0.5 font-medium text-brand-cyan"
            >
              Refresh insights
            </button>
          ) : null}
        </div>
      ) : null}

      {data.calendarConnected ? (
        <div className="grid gap-4 border-b border-forward-100 px-5 py-4 sm:grid-cols-2">
          {data.energyCurve?.length ? (
            <EnergyCurveChart points={data.energyCurve} />
          ) : (
            <div className="rounded-xl border border-dashed border-forward-200 bg-forward-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">Energy curve</p>
              <p className="mt-2 text-sm text-forward-600">
                Refresh the page to load energy insights.
              </p>
            </div>
          )}
          {data.weeklyHeatMap?.length ? (
            <WeeklyHeatMap days={data.weeklyHeatMap} />
          ) : (
            <div className="rounded-xl border border-dashed border-forward-200 bg-forward-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">Week load</p>
              <p className="mt-2 text-sm text-forward-600">
                Refresh the page to load your weekly heat map.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {data.calendarConnected ? (
        <div className="border-b border-brand-cyan/20 bg-brand-cyan/5 px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <Zap size={16} className="text-brand-cyan" />
            <p className="text-xs font-semibold uppercase tracking-widest text-forward-700">
              Auto-Pilot suggestions
            </p>
          </div>
          {!data.autoPilot?.writeEnabled ? (
            <p className="mb-3 text-xs text-forward-600">
              Reconnect Google Calendar to enable one-tap scheduling.
            </p>
          ) : null}
          {visibleProposals.length > 0 ? (
            <div className="space-y-2">
              {visibleProposals.map((proposal) => (
                <AutoPilotProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onAccepted={() => {
                    setDismissedProposals((prev) => new Set(prev).add(proposal.id));
                    onRefresh?.();
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-forward-600">
              No open slots right now, or your calendar is full. Add a mission on Today or free up 30+
              minutes on your calendar.
            </p>
          )}
        </div>
      ) : null}

      <div className="px-5 py-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-forward-400">
          Today&apos;s timeline
        </p>
        {data.blocks.length === 0 ? (
          <p className="text-sm text-forward-500">Your timeline will appear here once you add missions or connect a calendar.</p>
        ) : (
          <ul className="relative ml-4 border-l-0">
            {data.blocks.map((block) => (
              <TimelineRow key={block.id} block={block} onSelect={setSelected} />
            ))}
          </ul>
        )}

        {data.tomorrowHighlight ? (
          <div className="mt-6 rounded-xl border border-forward-200 bg-forward-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
              Tomorrow preview
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-forward-900">{data.tomorrowHighlight.title}</p>
              <span className="text-sm text-forward-500">
                Preparation {data.tomorrowHighlight.prepPercent}%
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-forward-200">
              <div
                className="h-full rounded-full bg-brand-blue"
                style={{ width: `${data.tomorrowHighlight.prepPercent}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {selected ? (
        <BlockDrawer
          block={selected}
          onClose={() => setSelected(null)}
          onCompleteMission={onRefresh}
        />
      ) : null}
    </section>
  );
}
