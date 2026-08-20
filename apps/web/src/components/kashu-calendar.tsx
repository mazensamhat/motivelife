"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Heart,
  List,
  Minus,
  Plus,
  Sparkles,
  Wallet,
} from "lucide-react";
import type { KashuDayProjection, KashuForecast, KashuRadarEvent } from "@forward/shared";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type CalView = "month" | "week" | "list";

function money(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function moneyShort(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1000)}k`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthLabel(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function addDaysYmd(ymd: string, days: number): string {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + days);
  return toYmd(d);
}

function isPayEvent(ev: KashuRadarEvent) {
  return ev.kind === "payday" || ev.kind === "income";
}

function isBillEvent(ev: KashuRadarEvent) {
  return ev.kind === "obligation" || ev.kind === "collision";
}

function isLifestyleEvent(ev: KashuRadarEvent) {
  return ev.kind === "lifestyle" || ev.priority === "LIFESTYLE" || ev.priority === "DISCRETIONARY";
}

function eventTone(ev: KashuRadarEvent): "pay" | "bill" | "life" {
  if (isPayEvent(ev)) return "pay";
  if (isLifestyleEvent(ev) && !isBillEvent(ev)) return "life";
  if (isBillEvent(ev)) return "bill";
  if (ev.kind === "lifestyle") return "life";
  return "bill";
}

function shortTitle(title: string, max = 10) {
  const t = title.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

type DayCell = {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  day: KashuDayProjection | null;
  events: KashuRadarEvent[];
};

function EventBubble({
  ev,
  compact = false,
}: {
  ev: KashuRadarEvent;
  compact?: boolean;
}) {
  const tone = eventTone(ev);
  const sign = tone === "pay" ? "+" : "−";
  return (
    <span
      title={`${sign}${money(ev.amount)} ${ev.title}`}
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none shadow-sm sm:text-[10px]",
        tone === "pay" &&
          "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-500/25",
        tone === "bill" &&
          "bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-rose-500/25",
        tone === "life" &&
          "bg-gradient-to-br from-amber-300 to-orange-500 text-white shadow-orange-500/25"
      )}
    >
      {tone === "pay" ? (
        <Plus className="h-2.5 w-2.5 shrink-0" strokeWidth={3} />
      ) : tone === "life" ? (
        <Heart className="h-2.5 w-2.5 shrink-0" strokeWidth={3} />
      ) : (
        <Minus className="h-2.5 w-2.5 shrink-0" strokeWidth={3} />
      )}
      {!compact ? (
        <span className="truncate">
          {shortTitle(ev.title, 8)} {sign}
          {moneyShort(ev.amount).replace("-", "")}
        </span>
      ) : (
        <span>{sign}{moneyShort(ev.amount).replace("-", "")}</span>
      )}
    </span>
  );
}

function BalanceTrendOverlay({
  cells,
  cols = 7,
}: {
  cells: DayCell[];
  cols?: number;
}) {
  const points = useMemo(() => {
    const inMonth = cells.filter((c) => c.inMonth && c.day);
    if (inMonth.length < 2) return null;
    const values = inMonth.map((c) => c.day!.availableAboveFloor);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const span = Math.max(max - min, 1);
    const rows = Math.ceil(cells.length / cols);

    return inMonth.map((c) => {
      const idx = cells.findIndex((x) => x.date === c.date);
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = ((col + 0.5) / cols) * 100;
      const yBase = ((row + 0.55) / rows) * 100;
      const norm = (c.day!.availableAboveFloor - min) / span;
      // Higher leftover sits higher on the cell band.
      const y = yBase - norm * (70 / rows);
      return {
        x,
        y: Math.min(96, Math.max(4, y)),
        status: c.day!.status,
        leftover: c.day!.availableAboveFloor,
        date: c.date,
      };
    });
  }, [cells, cols]);

  if (!points || points.length < 2) return null;

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  // Split path into green/red segments by status for a simple multi-tone line.
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="kashuBalGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(16,185,129,0.35)" />
          <stop offset="100%" stopColor="rgba(16,185,129,0)" />
        </linearGradient>
      </defs>
      <path
        d={`${d} L ${points[points.length - 1]!.x} 100 L ${points[0]!.x} 100 Z`}
        fill="url(#kashuBalGlow)"
        opacity={0.45}
      />
      {points.slice(0, -1).map((p, i) => {
        const n = points[i + 1]!;
        const bad = p.status === "red" || n.status === "red";
        const warn =
          !bad && (p.status === "yellow" || n.status === "yellow");
        return (
          <line
            key={`${p.date}-${n.date}`}
            x1={p.x}
            y1={p.y}
            x2={n.x}
            y2={n.y}
            stroke={bad ? "#fb7185" : warn ? "#fbbf24" : "#10b981"}
            strokeWidth={0.55}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {points.map((p) => (
        <circle
          key={p.date}
          cx={p.x}
          cy={p.y}
          r={0.7}
          fill={
            p.status === "red"
              ? "#f43f5e"
              : p.status === "yellow"
                ? "#f59e0b"
                : "#059669"
          }
          stroke="#fff"
          strokeWidth={0.25}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

export function KashuCalendar({
  forecast,
  onNeedHorizon,
}: {
  forecast: KashuForecast;
  onNeedHorizon?: (days: 60 | 90) => void;
}) {
  const asOf = parseYmd(forecast.asOf.slice(0, 10));
  const [cursor, setCursor] = useState(() => ({
    year: asOf.getFullYear(),
    month: asOf.getMonth(),
  }));
  const [selectedDate, setSelectedDate] = useState<string | null>(
    forecast.asOf.slice(0, 10)
  );
  const [view, setView] = useState<CalView>("month");
  const [showLifestyle, setShowLifestyle] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);

  const dayByDate = useMemo(() => {
    const map = new Map<string, KashuDayProjection>();
    for (const d of forecast.days) map.set(d.date, d);
    return map;
  }, [forecast.days]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, KashuRadarEvent[]>();
    for (const ev of forecast.radar) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [forecast.radar]);

  const todayYmd = toYmd(new Date());
  const forecastEnd = forecast.days[forecast.days.length - 1]?.date ?? forecast.asOf;

  useEffect(() => {
    if (!onNeedHorizon) return;
    const monthEnd = new Date(cursor.year, cursor.month + 1, 0);
    if (toYmd(monthEnd) > forecastEnd && forecast.horizonDays < 90) {
      onNeedHorizon(90);
    }
  }, [cursor.year, cursor.month, forecastEnd, forecast.horizonDays, onNeedHorizon]);

  const cells: DayCell[] = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const total = Math.ceil((startPad + daysInMonth) / 7) * 7;
    const out: DayCell[] = [];
    for (let i = 0; i < total; i++) {
      const date = new Date(cursor.year, cursor.month, i - startPad + 1);
      const ymd = toYmd(date);
      const raw = eventsByDate.get(ymd) ?? [];
      const events = showLifestyle
        ? raw
        : raw.filter((e) => !isLifestyleEvent(e) || isPayEvent(e) || isBillEvent(e));
      out.push({
        date: ymd,
        inMonth: date.getMonth() === cursor.month,
        isToday: ymd === todayYmd,
        day: dayByDate.get(ymd) ?? null,
        events,
      });
    }
    return out;
  }, [cursor.year, cursor.month, dayByDate, eventsByDate, todayYmd, showLifestyle]);

  const weekCells = useMemo(() => {
    const anchor = selectedDate ?? todayYmd;
    const a = parseYmd(anchor);
    const start = new Date(a);
    start.setDate(a.getDate() - a.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const ymd = toYmd(d);
      const raw = eventsByDate.get(ymd) ?? [];
      return {
        date: ymd,
        inMonth: true,
        isToday: ymd === todayYmd,
        day: dayByDate.get(ymd) ?? null,
        events: showLifestyle
          ? raw
          : raw.filter((e) => !isLifestyleEvent(e) || isPayEvent(e) || isBillEvent(e)),
      } satisfies DayCell;
    });
  }, [selectedDate, todayYmd, dayByDate, eventsByDate, showLifestyle]);

  const selected =
    cells.find((c) => c.date === selectedDate) ??
    weekCells.find((c) => c.date === selectedDate) ??
    cells.find((c) => c.date === todayYmd) ??
    null;

  const headerStats = useMemo(() => {
    const inMonthDays = cells.filter((c) => c.inMonth && c.day);
    const eom = inMonthDays[inMonthDays.length - 1]?.day ?? null;
    const from = todayYmd;
    const to = addDaysYmd(todayYmd, 7);
    let upcoming = 0;
    for (const ev of forecast.radar) {
      if (ev.date >= from && ev.date <= to && isBillEvent(ev)) {
        upcoming += ev.amount;
      }
    }
    return {
      available: forecast.safeToSpend,
      eomLeftover: eom?.availableAboveFloor ?? monthEndFallback(cells),
      nextPayday: forecast.nextPayday,
      daysUntilPayday: forecast.daysUntilPayday,
      upcoming7: upcoming,
      safetyFloor: forecast.safetyFloor,
    };
  }, [cells, forecast, todayYmd]);

  const next7 = useMemo(() => {
    const from = todayYmd;
    const to = addDaysYmd(todayYmd, 7);
    return forecast.radar
      .filter((ev) => ev.date >= from && ev.date <= to)
      .filter((ev) => showLifestyle || !isLifestyleEvent(ev) || isPayEvent(ev) || isBillEvent(ev))
      .slice(0, 8);
  }, [forecast.radar, todayYmd, showLifestyle]);

  const dayInsight = useMemo(() => {
    if (!selected?.day) return null;
    const daysLeft =
      forecast.daysUntilPayday != null && forecast.daysUntilPayday > 0
        ? forecast.daysUntilPayday
        : 7;
    const daily =
      selected.day.availableAboveFloor > 0
        ? Math.floor(selected.day.availableAboveFloor / Math.max(daysLeft, 1))
        : 0;
    if (selected.day.status === "red") {
      return `Tight day — projected below your floor. Hold discretionary spend if you can.`;
    }
    if (selected.day.status === "yellow") {
      return `Near your safety floor. Safe cushion about ${money(daily)}/day until payday.`;
    }
    return `Good zone. Safe to spend about ${money(Math.max(daily, 0))}/day without breaking the plan.`;
  }, [selected, forecast.daysUntilPayday]);

  const prevDay = selected
    ? dayByDate.get(addDaysYmd(selected.date, -1)) ?? null
    : null;

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function shiftWeek(delta: number) {
    const base = selectedDate ?? todayYmd;
    const next = addDaysYmd(base, delta * 7);
    setSelectedDate(next);
    const d = parseYmd(next);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  }

  const displayCells = view === "week" ? weekCells : cells;

  return (
    <div className="space-y-4">
      {/* Concept header bubbles */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <StatBubble
          label="Available now"
          value={money(headerStats.available)}
          hint="Above safety floor"
          tone="emerald"
        />
        <StatBubble
          label="Projected month end"
          value={
            headerStats.eomLeftover != null ? money(headerStats.eomLeftover) : "—"
          }
          hint="Leftover above floor"
          tone="sky"
        />
        <StatBubble
          label="Next payday"
          value={
            headerStats.daysUntilPayday != null
              ? headerStats.daysUntilPayday === 0
                ? "Today"
                : `in ${headerStats.daysUntilPayday}d`
              : "—"
          }
          hint={headerStats.nextPayday ?? "Set payday in Buffers"}
          tone="emerald"
        />
        <StatBubble
          label="Upcoming commitments"
          value={money(headerStats.upcoming7)}
          hint="Next 7 days"
          tone="rose"
        />
        <StatBubble
          label="Safety floor"
          value={money(headerStats.safetyFloor)}
          hint="Your minimum cushion"
          tone="sky"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-forward-900">Cash calendar</h2>
          <p className="text-sm text-forward-500">
            Tap a day. Green = pay. Red = bills. Orange = lifestyle. Line = leftover.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-full bg-white p-1 ring-1 ring-forward-200">
            {(
              [
                ["month", "Month"],
                ["week", "Week"],
                ["list", "List"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  view === id
                    ? "bg-emerald-700 text-white"
                    : "text-forward-600 hover:bg-forward-50"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowLifestyle((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition",
              showLifestyle
                ? "bg-orange-50 text-orange-800 ring-orange-200"
                : "bg-white text-forward-600 ring-forward-200"
            )}
            title="Toggle lifestyle bubbles"
          >
            <Filter className="h-3.5 w-3.5" />
            Lifestyle
          </button>
          <div className="inline-flex items-center gap-1 rounded-full bg-white p-1 ring-1 ring-forward-200">
            <button
              type="button"
              aria-label="Previous"
              onClick={() => (view === "week" ? shiftWeek(-1) : shiftMonth(-1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-forward-600 hover:bg-forward-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-[9rem] text-center text-sm font-semibold text-forward-900">
              {view === "week"
                ? `Week of ${parseYmd(weekCells[0]?.date ?? todayYmd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                : monthLabel(cursor.year, cursor.month)}
            </p>
            <button
              type="button"
              aria-label="Next"
              onClick={() => (view === "week" ? shiftWeek(1) : shiftMonth(1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-forward-600 hover:bg-forward-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-4">
          {view === "list" ? (
            <ListView
              cells={cells.filter((c) => c.inMonth)}
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
            />
          ) : (
            <div className="overflow-hidden rounded-[1.35rem] border border-forward-200/80 bg-gradient-to-b from-white to-emerald-50/30 shadow-[0_12px_40px_-24px_rgba(16,185,129,0.45)]">
              <div className="grid grid-cols-7 border-b border-forward-100/80 bg-white/70 backdrop-blur">
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="px-1 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-forward-500"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="relative" ref={gridRef}>
                {view === "month" ? (
                  <BalanceTrendOverlay cells={cells} />
                ) : null}
                <div
                  className={cn(
                    "relative z-[1] grid",
                    view === "week" ? "grid-cols-7" : "grid-cols-7"
                  )}
                >
                  {displayCells.map((cell) => {
                    const isSelected = cell.date === selectedDate;
                    const chips = cell.events.slice(0, view === "week" ? 4 : 3);
                    const extra = cell.events.length - chips.length;
                    return (
                      <button
                        key={cell.date}
                        type="button"
                        disabled={view === "month" && !cell.inMonth}
                        onClick={() => setSelectedDate(cell.date)}
                        className={cn(
                          "relative flex min-h-[5.5rem] flex-col gap-1 border-b border-r border-forward-100/90 p-1.5 text-left transition sm:min-h-[6.75rem] sm:p-2",
                          view === "month" && !cell.inMonth && "bg-forward-50/50 text-forward-300",
                          view === "month" &&
                            cell.inMonth &&
                            cell.day?.status === "red" &&
                            "bg-rose-50/50",
                          view === "month" &&
                            cell.inMonth &&
                            cell.day?.status === "yellow" &&
                            "bg-amber-50/40",
                          view === "month" &&
                            cell.inMonth &&
                            cell.day?.status === "green" &&
                            "bg-emerald-50/30",
                          cell.inMonth && "hover:bg-white/80",
                          isSelected &&
                            "z-[3] bg-white shadow-[inset_0_0_0_2px_#059669]",
                          cell.isToday && cell.inMonth && "font-semibold"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              "inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-[11px]",
                              cell.isToday && cell.inMonth
                                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                                : "text-forward-700"
                            )}
                          >
                            {parseYmd(cell.date).getDate()}
                          </span>
                          {cell.isToday && cell.inMonth ? (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-emerald-800">
                              Today
                            </span>
                          ) : null}
                        </div>

                        {cell.inMonth || view === "week" ? (
                          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                            {chips.map((ev) => (
                              <EventBubble
                                key={ev.id}
                                ev={ev}
                                compact={view === "month" && chips.length > 2}
                              />
                            ))}
                            {extra > 0 ? (
                              <span className="text-[9px] font-semibold text-forward-500">
                                +{extra} more
                              </span>
                            ) : null}
                            {cell.isToday && cell.day ? (
                              <span className="mt-auto inline-flex items-center gap-1 rounded-full bg-emerald-600/95 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
                                <Wallet className="h-2.5 w-2.5" />
                                Leftover {moneyShort(cell.day.availableAboveFloor)}
                              </span>
                            ) : cell.day ? (
                              <span
                                className={cn(
                                  "mt-auto text-[9px] font-semibold",
                                  cell.day.availableAboveFloor < 0
                                    ? "text-rose-600"
                                    : "text-forward-500"
                                )}
                              >
                                {moneyShort(cell.day.availableAboveFloor)}
                              </span>
                            ) : (
                              <span className="mt-auto text-[9px] text-forward-300">—</span>
                            )}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Selected day — concept bottom panel */}
          {selected && (selected.inMonth || view !== "month") ? (
            <div className="grid gap-3 rounded-[1.35rem] border border-forward-200 bg-white p-4 shadow-sm md:grid-cols-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-forward-500">
                  {parseYmd(selected.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                  {selected.isToday ? " · Today" : ""}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-forward-400">
                  Cash flow
                </p>
                {selected.day ? (
                  <ul className="mt-1.5 space-y-1 text-sm">
                    <li className="flex justify-between gap-2">
                      <span className="text-forward-500">Income</span>
                      <span className="font-semibold text-emerald-700">
                        +{money(selected.day.income)}
                      </span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span className="text-forward-500">Bills</span>
                      <span className="font-semibold text-rose-700">
                        −{money(selected.day.obligations)}
                      </span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span className="text-forward-500">Lifestyle</span>
                      <span className="font-semibold text-orange-700">
                        −{money(selected.day.lifestyleBurn)}
                      </span>
                    </li>
                    <li className="mt-1 flex justify-between gap-2 border-t border-forward-100 pt-1.5">
                      <span className="font-semibold text-forward-800">Net</span>
                      <span className="font-bold text-forward-900">
                        {money(
                          selected.day.income -
                            selected.day.obligations -
                            selected.day.lifestyleBurn
                        )}
                      </span>
                    </li>
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-forward-500">No projection for this day yet.</p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-forward-400">
                  Balance impact
                </p>
                {selected.day ? (
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-forward-500">Yesterday end</span>
                      <span className="font-semibold">
                        {prevDay ? money(prevDay.endingBalance) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-forward-500">Ends today</span>
                      <span className="font-semibold">
                        {money(selected.day.endingBalance)}
                      </span>
                    </div>
                    <div className="rounded-xl bg-emerald-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                        Leftover above floor
                      </p>
                      <p className="text-lg font-bold text-emerald-800">
                        {money(selected.day.availableAboveFloor)}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 space-y-1.5">
                  {selected.events.slice(0, 5).map((ev) => (
                    <div key={ev.id} className="flex items-center gap-2">
                      <EventBubble ev={ev} />
                      <span className="truncate text-[11px] text-forward-500">{ev.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-3 text-white shadow-lg shadow-emerald-700/20">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  Kashu’s take
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/95">
                  {dayInsight ?? "Add bills and payday so Kashu can coach this day."}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right rail — next 7 days */}
        <aside className="space-y-3">
          <div className="rounded-[1.35rem] border border-forward-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-forward-500">
              Next 7 days
            </p>
            <ul className="mt-3 space-y-2">
              {next7.map((ev) => {
                const tone = eventTone(ev);
                return (
                  <li key={ev.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(ev.date);
                        const d = parseYmd(ev.date);
                        setCursor({ year: d.getFullYear(), month: d.getMonth() });
                        setView("month");
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-1 py-1 text-left hover:bg-forward-50"
                    >
                      <span className="w-10 shrink-0 text-[10px] font-semibold text-forward-400">
                        {parseYmd(ev.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-forward-800">
                        {ev.title}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-xs font-bold",
                          tone === "pay"
                            ? "text-emerald-600"
                            : tone === "life"
                              ? "text-orange-600"
                              : "text-rose-600"
                        )}
                      >
                        {tone === "pay" ? "+" : "−"}
                        {moneyShort(ev.amount).replace("-", "")}
                      </span>
                    </button>
                  </li>
                );
              })}
              {next7.length === 0 ? (
                <li className="text-sm text-forward-500">
                  No pay or bills in the next week — add commitments on Bills.
                </li>
              ) : null}
            </ul>
          </div>

          <div className="rounded-[1.35rem] border border-emerald-200 bg-emerald-50/80 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Safe to Spend
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">
              {money(forecast.safeToSpend)}
            </p>
            <p className="mt-1 text-xs text-emerald-800/80">{forecast.message}</p>
          </div>

          <div className="flex flex-wrap gap-2 text-[10px] text-forward-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">
              <Plus className="h-3 w-3" /> Pay
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 font-semibold text-rose-800">
              <Minus className="h-3 w-3" /> Bills
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-1 font-semibold text-orange-800">
              <Heart className="h-3 w-3" /> Lifestyle
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-forward-100 px-2 py-1 font-semibold text-forward-700">
              <List className="h-3 w-3" /> Line = leftover
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function monthEndFallback(cells: DayCell[]): number | null {
  for (let i = cells.length - 1; i >= 0; i--) {
    const c = cells[i]!;
    if (c.inMonth && c.day) return c.day.availableAboveFloor;
  }
  return null;
}

function StatBubble({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "emerald" | "sky" | "rose";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.25rem] border px-3 py-2.5 shadow-sm",
        tone === "emerald" && "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white",
        tone === "sky" && "border-sky-200 bg-gradient-to-br from-sky-50 to-white",
        tone === "rose" && "border-rose-200 bg-gradient-to-br from-rose-50 to-white",
        className
      )}
    >
      <p
        className={cn(
          "text-[10px] font-bold uppercase tracking-wider",
          tone === "emerald" && "text-emerald-700",
          tone === "sky" && "text-sky-700",
          tone === "rose" && "text-rose-700"
        )}
      >
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold text-forward-900 sm:text-xl">{value}</p>
      <p className="text-[10px] text-forward-500">{hint}</p>
    </div>
  );
}

function ListView({
  cells,
  selectedDate,
  onSelect,
}: {
  cells: DayCell[];
  selectedDate: string | null;
  onSelect: (d: string) => void;
}) {
  const withAction = cells.filter(
    (c) => c.events.length > 0 || (c.day && (c.day.income > 0 || c.day.obligations > 0))
  );
  return (
    <div className="overflow-hidden rounded-[1.35rem] border border-forward-200 bg-white">
      <ul className="divide-y divide-forward-100">
        {withAction.map((cell) => (
          <li key={cell.date}>
            <button
              type="button"
              onClick={() => onSelect(cell.date)}
              className={cn(
                "flex w-full flex-col gap-2 px-4 py-3 text-left hover:bg-emerald-50/50 sm:flex-row sm:items-center",
                selectedDate === cell.date && "bg-emerald-50"
              )}
            >
              <div className="w-28 shrink-0">
                <p className="text-sm font-semibold text-forward-900">
                  {parseYmd(cell.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                {cell.day ? (
                  <p className="text-[11px] text-forward-500">
                    Leftover {money(cell.day.availableAboveFloor)}
                  </p>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {cell.events.map((ev) => (
                  <EventBubble key={ev.id} ev={ev} />
                ))}
                {cell.events.length === 0 ? (
                  <span className="text-xs text-forward-400">Quiet day</span>
                ) : null}
              </div>
            </button>
          </li>
        ))}
        {withAction.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-forward-500">
            No paydays or bills this month yet — add them on Bills or set payday in Buffers.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
