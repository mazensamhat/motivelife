"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type {
  DrivingReport,
  DrivingReportPeriod,
} from "@forward/shared";
import {
  ArrowDownRight,
  ArrowUpRight,
  Brain,
  Car,
  Gauge,
  Minus,
  Phone,
  RotateCcw,
} from "lucide-react";
import { DriveEventsStrip } from "@/components/family/drive-events-strip";
import { DriveScoreBubble } from "@/components/family/drive-score-bubble";
import {
  FAMILY_BUBBLE_CARD,
  FAMILY_BUBBLE_PILL,
  FAMILY_BUBBLE_PILL_ACTIVE,
  FAMILY_BUBBLE_ROW,
  FAMILY_BUBBLE_TILE,
  countSeverity,
} from "@/lib/family-map/ui-theme";

type PeriodOption = { id: DrivingReportPeriod; label: string };

function Trend({ delta, invert }: { delta: number; invert?: boolean }) {
  if (delta === 0) {
    return <Minus className="h-3 w-3 text-forward-400" aria-hidden />;
  }
  const improved = invert ? delta < 0 : delta > 0;
  if (improved) {
    return <ArrowDownRight className="h-3.5 w-3.5 text-emerald-600" aria-hidden />;
  }
  return <ArrowUpRight className="h-3.5 w-3.5 text-amber-600" aria-hidden />;
}

/**
 * Weekly Driving Report — household aggregates + per-member breakdown.
 * Shows real event counts (Life360 locks these behind Silver).
 */
export function WeeklyDrivingReport({
  onSelectMember,
  demoReport,
  canResetHouseholdDrives = false,
}: {
  onSelectMember?: (memberId: string) => void;
  /** When set, skip API and render this sample report (public preview). */
  demoReport?: DrivingReport;
  /** Household owner can wipe noisy drive history and start clean. */
  canResetHouseholdDrives?: boolean;
}) {
  const [period, setPeriod] = useState<DrivingReportPeriod>(
    demoReport?.period ?? "this_week"
  );
  const [periods, setPeriods] = useState<PeriodOption[]>(
    demoReport
      ? [
          { id: "this_week", label: "This week" },
          { id: "last_week", label: "Last week" },
        ]
      : []
  );
  const [report, setReport] = useState<DrivingReport | null>(demoReport ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!demoReport);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    if (demoReport) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/family/driving-report?period=${encodeURIComponent(period)}`
      );
      if (!res.ok) {
        setError("Could not load driving report.");
        setReport(null);
        return;
      }
      const data = (await res.json()) as {
        report: DrivingReport;
        periods: PeriodOption[];
      };
      setReport(data.report);
      setPeriods(data.periods ?? []);
      setError(null);
    } catch {
      setError("Could not load driving report.");
    } finally {
      setLoading(false);
    }
  }, [period, demoReport]);

  useEffect(() => {
    if (demoReport) {
      setReport(demoReport);
      setLoading(false);
      return;
    }
    void load();
  }, [load, demoReport]);

  const totals = report?.totals;
  const vs = report?.vsPrevious;

  return (
    <section className={FAMILY_BUBBLE_CARD}>
      <div
        className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full opacity-50"
        style={{
          background:
            "radial-gradient(circle, rgba(34,139,230,0.16), transparent 70%)",
        }}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-forward-900">
              Weekly Driving Report
            </h3>
            <p className="mt-0.5 text-xs text-forward-500">
              Household drives, risky events, and Drive Score — open, not locked.
            </p>
          </div>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-50 text-brand-blue ring-1 ring-sky-100">
            <Car className="h-4 w-4" />
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(periods.length
            ? periods
            : [
                { id: "this_week" as const, label: "This week" },
                { id: "last_week" as const, label: "Last week" },
              ]
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={
                period === p.id ? FAMILY_BUBBLE_PILL_ACTIVE : FAMILY_BUBBLE_PILL
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        {error ? <p className="mt-3 text-xs text-amber-800">{error}</p> : null}

        {loading && !report ? (
          <p className="mt-4 text-xs text-forward-500">Loading report…</p>
        ) : totals ? (
          <>
            <div className="mt-4 flex items-center gap-4">
              <DriveScoreBubble score={totals.avgDriveScore} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-forward-400">
                  Avg Drive Score
                </p>
                <p className="mt-1 font-display text-lg font-semibold text-forward-900">
                  {totals.drives} {totals.drives === 1 ? "drive" : "drives"} ·{" "}
                  {totals.distanceKm} km
                </p>
                <p className="mt-0.5 text-xs text-forward-500">
                  Top {totals.topSpeedKmh > 0 ? `${totals.topSpeedKmh} km/h` : "—"}
                  {totals.topSpeedMemberName
                    ? ` · ${totals.topSpeedMemberName}`
                    : ""}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <MetricChip
                icon={<Gauge className="h-3.5 w-3.5" />}
                value={totals.topSpeedKmh > 0 ? totals.topSpeedKmh : "—"}
                label="Top speed"
                hint="Peak km/h this period"
                severity={
                  totals.topSpeedKmh >= 130
                    ? "alert"
                    : totals.topSpeedKmh >= 115
                      ? "watch"
                      : "calm"
                }
                trend={null}
              />
              <MetricChip
                icon={<Phone className="h-3.5 w-3.5" />}
                value={
                  totals.phoneUsageEvents > 0 ? totals.phoneUsageEvents : "—"
                }
                label="Phone in use"
                hint="App open while driving"
                severity={countSeverity(totals.phoneUsageEvents)}
                trend={
                  vs ? (
                    <Trend delta={vs.phoneUsageEvents ?? 0} invert />
                  ) : null
                }
              />
            </div>

            {canResetHouseholdDrives && !demoReport ? (
              <button
                type="button"
                disabled={resetting}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Reset all household drive history? This clears trips and drive alerts so Drive Score starts clean. Places and stays stay."
                    )
                  ) {
                    return;
                  }
                  setResetting(true);
                  void fetch("/api/family/history?scope=household-drives", {
                    method: "DELETE",
                  })
                    .then(async (res) => {
                      if (!res.ok) {
                        const body = (await res.json().catch(() => null)) as {
                          error?: string;
                        } | null;
                        setError(body?.error ?? "Could not reset drive history.");
                        return;
                      }
                      setError(null);
                      await load();
                    })
                    .finally(() => setResetting(false));
                }}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-forward-50 px-3 py-2 text-[11px] font-semibold text-forward-600 ring-1 ring-forward-100 disabled:opacity-60"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {resetting ? "Resetting…" : "Start clean — reset family drives"}
              </button>
            ) : null}

            {report?.insight ? (
              <div className="mt-3 flex gap-2 rounded-2xl bg-sky-50/90 px-3 py-2.5 text-xs text-sky-950 ring-1 ring-sky-100">
                <Brain className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-blue" />
                <p>
                  <span className="font-semibold">Family Intelligence. </span>
                  {report.insight}
                </p>
              </div>
            ) : null}

            {report && report.members.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {report.members.map((m) => (
                  <li key={m.memberId}>
                    <button
                      type="button"
                      onClick={() => onSelectMember?.(m.memberId)}
                      className={FAMILY_BUBBLE_ROW}
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm ring-2 ring-white"
                        style={{ backgroundColor: m.color }}
                      >
                        {m.displayName.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-forward-900">
                          {m.displayName}
                        </p>
                        <p className="truncate text-[11px] text-forward-500">
                          {m.driveCount}{" "}
                          {m.driveCount === 1 ? "drive" : "drives"} · {m.distanceKm}{" "}
                          km
                          {m.estimatedFuelCostCad != null
                            ? ` · ~$${m.estimatedFuelCostCad.toFixed(2)} fuel`
                            : ""}
                        </p>
                        {m.learningNotes && m.learningNotes.length > 0 ? (
                          <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-forward-600">
                            {m.learningNotes[0]}
                          </p>
                        ) : null}
                        {m.riskyEvents > 0 ? (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-800 ring-1 ring-rose-100">
                            {m.riskyEvents} phone-in-use{" "}
                            {m.riskyEvents === 1 ? "tick" : "ticks"}
                          </span>
                        ) : (
                          <span className="mt-1 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-100">
                            Clean week
                          </span>
                        )}
                      </div>
                      <DriveScoreBubble
                        score={m.avgDriveScore}
                        size="sm"
                        showLabel={false}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`${FAMILY_BUBBLE_TILE} mt-3 text-center text-xs text-forward-500`}>
                No drives in this period yet.
              </p>
            )}

            {report && report.members[0] ? (
              <div className="mt-3 border-t border-forward-100 pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-forward-500">
                  Household event mix
                </p>
                <DriveEventsStrip
                  maxSpeedKmh={totals.topSpeedKmh}
                  phoneUsageEvents={totals.phoneUsageEvents}
                  compact
                />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function MetricChip({
  icon,
  value,
  label,
  hint,
  trend,
  severity,
}: {
  icon: ReactNode;
  value: number | string;
  label: string;
  hint?: string;
  trend: ReactNode;
  severity: "calm" | "watch" | "alert";
}) {
  return (
    <div className={`family-count-tile family-count-tile--${severity} px-2 py-2.5 text-center`}>
      <div className="flex items-center justify-center gap-1 opacity-80">
        {icon}
        {trend}
      </div>
      <p className="family-count-tile__value mt-1 text-xl leading-none">{value}</p>
      <p className="mt-1 text-[9px] font-semibold opacity-80">{label}</p>
      {hint ? <p className="text-[9px] opacity-60">{hint}</p> : null}
    </div>
  );
}
