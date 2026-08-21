"use client";

import { useEffect, useMemo } from "react";
import type { KashuDayProjection, KashuRadarEvent } from "@forward/shared";
import {
  CashMapTimeline,
  RunningBalanceChart,
} from "@/components/kashu-calendar";

/**
 * Local Fold-cover QA page (no auth). Forces `motivelife-cover-screen` and a
 * ~360px frame so we can verify Kashu chart + cash-map density without login.
 */
export default function KashuFoldPreviewPage() {
  useEffect(() => {
    document.documentElement.classList.add("motivelife-cover-screen");
    return () => {
      document.documentElement.classList.remove("motivelife-cover-screen");
    };
  }, []);

  const year = 2026;
  const monthIndex = 7; // August
  const asOf = "2026-08-21";
  const monthDays = 31;

  const seriesBals = [
    6500, 6200, 5800, 4100, 1800, -200, -800, -1500, -900, 500, 1200, 900, 700,
    400, 200, 100, 50, 0, -100, 200, 1500, 8200, 7900, 7600, 7400, 7200, 7000,
    7100, 7300, 7800, 8200,
  ];

  const { cells, events, eventsByDate } = useMemo(() => {
    const radar: KashuRadarEvent[] = [
      {
        id: "pay-1",
        date: "2026-08-07",
        kind: "payday",
        title: "Cox payday",
        amount: 3698,
        balanceAfter: 500,
        status: "yellow",
      },
      {
        id: "pay-2",
        date: "2026-08-21",
        kind: "payday",
        title: "Cox payday",
        amount: 7689,
        balanceAfter: 8200,
        status: "green",
      },
      {
        id: "bill-mort",
        date: "2026-08-03",
        kind: "obligation",
        title: "Mortgage",
        amount: 2100,
        balanceAfter: 4100,
        status: "yellow",
      },
      {
        id: "bill-aviva",
        date: "2026-08-06",
        kind: "obligation",
        title: "Aviva",
        amount: 420,
        balanceAfter: -800,
        status: "red",
      },
      {
        id: "bill-hydro",
        date: "2026-08-12",
        kind: "obligation",
        title: "EnWin",
        amount: 180,
        balanceAfter: 900,
        status: "yellow",
      },
    ];

    const byDate = new Map<string, KashuRadarEvent[]>();
    for (const ev of radar) {
      const list = byDate.get(ev.date) ?? [];
      list.push(ev);
      byDate.set(ev.date, list);
    }

    const built = [];
    for (let day = 1; day <= monthDays; day++) {
      const date = `2026-08-${String(day).padStart(2, "0")}`;
      const bal = seriesBals[day - 1] ?? 0;
      const dayProj: KashuDayProjection = {
        date,
        startingBalance: bal,
        income: 0,
        obligations: 0,
        lifestyleBurn: 0,
        endingBalance: bal,
        availableAboveFloor: Math.max(0, bal - 500),
        status: bal < 0 ? "red" : bal < 1500 ? "yellow" : "green",
        events: byDate.get(date) ?? [],
      };
      const d = new Date(year, monthIndex, day);
      built.push({
        date,
        inMonth: true,
        isToday: date === asOf,
        day: dayProj,
        events: byDate.get(date) ?? [],
        col: d.getDay(),
        row: Math.floor((day + new Date(year, monthIndex, 1).getDay() - 1) / 7),
      });
    }
    return { cells: built, events: radar, eventsByDate: byDate };
  }, []);

  return (
    <div className="min-h-dvh bg-slate-100 py-3">
      <p className="mb-2 px-3 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Fold cover preview · 360px
      </p>
      <div
        className="mx-auto overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-lg"
        style={{ width: 360 }}
      >
        <div className="kashu-shell space-y-3 p-3">
          <header className="rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Cash-Flow Calendar
            </p>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900">
              Kashu
            </h1>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Safe to Spend
            </p>
            <p className="mt-1 font-display text-5xl font-semibold tracking-tight text-emerald-600">
              $1,498
            </p>
          </header>

          <div className="grid grid-cols-2 gap-2">
            {[
              ["Available Now", "$1,498"],
              ["End of Month", "$6,753"],
              ["Next Payday", "Today"],
              ["Safety Floor", "$500"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="kashu-stat-orb rounded-[1.35rem] border border-slate-200 bg-white px-3 py-3"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  {label}
                </p>
                <p className="kashu-stat-orb__value mt-0.5 text-base font-bold text-slate-900">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <CashMapTimeline
            events={events}
            monthDays={monthDays}
            year={year}
            monthIndex={monthIndex}
          />

          <div className="overflow-hidden rounded-[1.35rem] border border-slate-200">
            <RunningBalanceChart
              cells={cells}
              eventsByDate={eventsByDate}
              asOf={asOf}
              liquid={1498}
              safetyFloor={500}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
