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
  Lock,
  Minus,
  Phone,
  Siren,
  Zap,
} from "lucide-react";
import { DriveEventsStrip } from "@/components/family/drive-events-strip";

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
}: {
  onSelectMember?: (memberId: string) => void;
}) {
  const [period, setPeriod] = useState<DrivingReportPeriod>("this_week");
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [report, setReport] = useState<DrivingReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
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
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = report?.totals;
  const vs = report?.vsPrevious;

  return (
    <section className="rounded-2xl border border-forward-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-forward-900">
            Weekly Driving Report
          </h3>
          <p className="mt-0.5 text-xs text-forward-500">
            Household drives, risky events, and Drive Score — open, not locked.
          </p>
        </div>
        <Car className="mt-0.5 h-4 w-4 text-brand-blue" />
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
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              period === p.id
                ? "bg-forward-900 text-white"
                : "bg-forward-100 text-forward-700 hover:bg-forward-200"
            }`}
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
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            <MetricChip
              icon={<Gauge className="h-3.5 w-3.5 text-rose-600" />}
              value={totals.hardBraking}
              label="Hard brake"
              hint="Sudden slowdowns"
              trend={vs ? <Trend delta={vs.hardBraking} invert /> : null}
            />
            <MetricChip
              icon={<Phone className="h-3.5 w-3.5 text-sky-600" />}
              value="—"
              label="Phone"
              hint="Coming soon"
              trend={
                <span title="Phone usage detection coming soon">
                  <Lock className="h-3 w-3 text-forward-300" />
                </span>
              }
            />
            <MetricChip
              icon={<Zap className="h-3.5 w-3.5 text-violet-600" />}
              value={totals.rapidAcceleration}
              label="Rapid accel"
              hint="Quick speed-ups"
              trend={vs ? <Trend delta={vs.rapidAcceleration} invert /> : null}
            />
            <MetricChip
              icon={<Siren className="h-3.5 w-3.5 text-amber-600" />}
              value={totals.unusualRouteEvents}
              label="Unusual"
              hint="Sudden-stop signals"
              trend={vs ? <Trend delta={vs.unusualRouteEvents} invert /> : null}
            />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-forward-100 bg-forward-50/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-forward-500">
                Top speed
              </p>
              <p className="mt-0.5 text-sm font-semibold text-forward-900">
                {totals.topSpeedKmh > 0 ? `${totals.topSpeedKmh} km/h` : "—"}
                {totals.topSpeedMemberName ? (
                  <span className="font-normal text-forward-500">
                    {" "}
                    · {totals.topSpeedMemberName}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="rounded-xl border border-forward-100 bg-forward-50/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-forward-500">
                Drives · Distance
              </p>
              <p className="mt-0.5 text-sm font-semibold text-forward-900">
                {totals.drives} · {totals.distanceKm} km
              </p>
              {totals.avgDriveScore != null ? (
                <p className="text-[11px] text-forward-500">
                  Avg Drive Score {totals.avgDriveScore}/100
                </p>
              ) : null}
            </div>
          </div>

          {report?.insight ? (
            <div className="mt-3 flex gap-2 rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2.5 text-xs text-sky-950">
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
                    className="flex w-full items-center gap-3 rounded-xl border border-forward-200 bg-white px-3 py-2.5 text-left transition hover:border-forward-300"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: m.color }}
                    >
                      {m.displayName.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-forward-900">
                        {m.displayName}
                      </p>
                      <p className="truncate text-[11px] text-forward-500">
                        {m.driveCount} {m.driveCount === 1 ? "drive" : "drives"} ·{" "}
                        {m.distanceKm} km
                        {m.avgDriveScore != null
                          ? ` · score ${m.avgDriveScore}`
                          : ""}
                      </p>
                      {m.riskyEvents > 0 ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                          {m.riskyEvents} risky{" "}
                          {m.riskyEvents === 1 ? "event" : "events"}
                        </span>
                      ) : (
                        <span className="mt-1 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          Clean week
                        </span>
                      )}
                    </div>
                    <span className="text-forward-300">›</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-forward-200 px-3 py-4 text-center text-xs text-forward-500">
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
                hardBraking={totals.hardBraking}
                rapidAcceleration={totals.rapidAcceleration}
                unusualRouteEvents={totals.unusualRouteEvents}
                compact
              />
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function MetricChip({
  icon,
  value,
  label,
  hint,
  trend,
}: {
  icon: ReactNode;
  value: number | string;
  label: string;
  hint?: string;
  trend: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-forward-100 bg-forward-50/60 px-2 py-2 text-center">
      <div className="flex items-center justify-center gap-1">
        {icon}
        {trend}
      </div>
      <p className="mt-1 text-base font-semibold tabular-nums text-forward-900">{value}</p>
      <p className="text-[9px] font-medium text-forward-500">{label}</p>
      {hint ? <p className="text-[9px] text-forward-400">{hint}</p> : null}
    </div>
  );
}
