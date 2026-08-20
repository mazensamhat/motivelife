"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Filter, Sparkles } from "lucide-react";
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
  if (isBillEvent(ev)) return "bill";
  if (isLifestyleEvent(ev) || ev.kind === "lifestyle") return "life";
  return "bill";
}

function shortTitle(title: string, max = 9) {
  const t = title.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Friendly emoji for the bubble — concept-style, not corporate icons. */
function eventEmoji(ev: KashuRadarEvent): string {
  const t = ev.title.toLowerCase();
  if (isPayEvent(ev)) return "🥳";
  if (/netflix|disney|hulu|prime video|streaming/.test(t)) return "📺";
  if (/spotify|apple music|youtube music/.test(t)) return "🎧";
  if (/gym|fitness|planet/.test(t)) return "💪";
  if (/rent|mortgage|housing|landlord/.test(t)) return "🏠";
  if (/insurance|geico|state farm/.test(t)) return "🛡️";
  if (/phone|bell|rogers|telus|verizon|at&t|mobile/.test(t)) return "📱";
  if (/hydro|electric|gas|utility|power|water/.test(t)) return "⚡";
  if (/internet|wifi|comcast|shaw/.test(t)) return "🌐";
  if (/car|auto|lease|toyota|honda/.test(t)) return "🚗";
  if (/grocery|food|uber eats|doordash|restaur/.test(t)) return "🍔";
  if (/coffee|starbucks|tim/.test(t)) return "☕";
  if (/school|tuition|daycare/.test(t)) return "📚";
  if (/medical|dental|health|pharmacy/.test(t)) return "💊";
  if (/credit card|visa|mastercard/.test(t)) return "💳";
  if (eventTone(ev) === "life") return "✨";
  if (ev.amount >= 500) return "😰";
  if (ev.amount >= 100) return "😮";
  return "📌";
}

function moodEmoji(ev: KashuRadarEvent): string {
  if (isPayEvent(ev)) return "💚";
  if (ev.amount >= 800) return "😤";
  if (ev.amount >= 200) return "😕";
  if (eventTone(ev) === "life") return "😎";
  return "🙂";
}

type DayCell = {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  day: KashuDayProjection | null;
  events: KashuRadarEvent[];
  col: number;
  row: number;
};

function EventBubble({
  ev,
  big = false,
}: {
  ev: KashuRadarEvent;
  big?: boolean;
}) {
  const tone = eventTone(ev);
  const sign = tone === "pay" ? "+" : "−";
  return (
    <span
      title={`${ev.title} ${sign}${money(ev.amount)}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full font-bold leading-none shadow-md transition hover:scale-[1.03]",
        big ? "px-2.5 py-1.5 text-[11px]" : "px-1.5 py-1 text-[9px] sm:text-[10px]",
        tone === "pay" &&
          "bg-gradient-to-r from-[#34D399] to-[#059669] text-white shadow-emerald-400/40",
        tone === "bill" &&
          "bg-gradient-to-r from-[#FB7185] to-[#E11D48] text-white shadow-rose-400/40",
        tone === "life" &&
          "bg-gradient-to-r from-[#FBBF24] to-[#F97316] text-white shadow-orange-400/40"
      )}
    >
      <span className={big ? "text-sm" : "text-[11px]"} aria-hidden>
        {eventEmoji(ev)}
      </span>
      <span className="truncate">
        {shortTitle(ev.title, big ? 14 : 8)}
      </span>
      <span className="shrink-0 opacity-95">
        {sign}
        {moneyShort(ev.amount).replace("-", "")}
      </span>
      <span className="text-[10px]" aria-hidden>
        {moodEmoji(ev)}
      </span>
    </span>
  );
}

/**
 * Trend ON the calendar — one smooth curve per week row (no Sat→Sun zigzag).
 * Y inside each cell = leftover above floor (higher = safer).
 */
function CalendarTrendOnMap({
  cells,
  rows,
  selectedDate,
}: {
  cells: DayCell[];
  rows: number;
  selectedDate: string | null;
}) {
  const projected = cells.filter((c) => c.inMonth && c.day);
  if (projected.length < 2 || rows < 1) return null;

  const values = projected.map((c) => c.day!.availableAboveFloor);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = Math.max(max - min, 1);

  const weekPaths: Array<{
    d: string;
    fill: string;
    pts: Array<{ x: number; y: number; cell: DayCell; color: string }>;
  }> = [];

  for (let row = 0; row < rows; row++) {
    const week = cells
      .filter((c) => c.row === row && c.inMonth && c.day)
      .sort((a, b) => a.col - b.col);
    if (week.length < 2) {
      if (week.length === 1) {
        const c = week[0]!;
        const x = ((c.col + 0.5) / 7) * 100;
        const cellTop = (row / rows) * 100;
        const cellH = 100 / rows;
        const norm = (c.day!.availableAboveFloor - min) / span;
        const y = cellTop + cellH * (0.72 - norm * 0.42);
        const color =
          c.day!.status === "red"
            ? "#F43F5E"
            : c.day!.status === "yellow"
              ? "#F59E0B"
              : "#10B981";
        weekPaths.push({
          d: `M ${x} ${y}`,
          fill: "",
          pts: [{ x, y, cell: c, color }],
        });
      }
      continue;
    }

    const pts = week.map((c) => {
      const x = ((c.col + 0.5) / 7) * 100;
      const cellTop = (row / rows) * 100;
      const cellH = 100 / rows;
      const norm = (c.day!.availableAboveFloor - min) / span;
      // Sit in the lower-middle of the cell so bubbles stay readable on top.
      const y = cellTop + cellH * (0.72 - norm * 0.42);
      const color =
        c.day!.status === "red"
          ? "#F43F5E"
          : c.day!.status === "yellow"
            ? "#F59E0B"
            : "#10B981";
      return { x, y, cell: c, color };
    });

    // Smooth cubic per week only — never connect Saturday → next Sunday.
    let d = `M ${pts[0]!.x.toFixed(2)} ${pts[0]!.y.toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1]!;
      const p1 = pts[i]!;
      const cpx = (p0.x + p1.x) / 2;
      d += ` C ${cpx.toFixed(2)} ${p0.y.toFixed(2)}, ${cpx.toFixed(2)} ${p1.y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
    }

    const cellBottom = ((row + 1) / rows) * 100;
    const fill = `${d} L ${pts[pts.length - 1]!.x.toFixed(2)} ${cellBottom.toFixed(2)} L ${pts[0]!.x.toFixed(2)} ${cellBottom.toFixed(2)} Z`;

    weekPaths.push({ d, fill, pts });
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[2] h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="kashuWeekFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34D399" stopOpacity="0.28" />
          <stop offset="55%" stopColor="#38BDF8" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#F472B6" stopOpacity="0.06" />
        </linearGradient>
        <filter id="kashuSoftGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.35" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {weekPaths.map((wp, i) =>
        wp.fill ? (
          <path key={`fill-${i}`} d={wp.fill} fill="url(#kashuWeekFill)" />
        ) : null
      )}

      {/* One colored cubic segment between each pair of days in the week */}
      {weekPaths.map((wp, wi) =>
        wp.pts.slice(0, -1).map((p, i) => {
          const n = wp.pts[i + 1]!;
          const color =
            p.cell.day!.status === "red" || n.cell.day!.status === "red"
              ? "#F43F5E"
              : p.cell.day!.status === "yellow" || n.cell.day!.status === "yellow"
                ? "#F59E0B"
                : "#10B981";
          const cpx = (p.x + n.x) / 2;
          const d = `M ${p.x.toFixed(2)} ${p.y.toFixed(2)} C ${cpx.toFixed(2)} ${p.y.toFixed(2)}, ${cpx.toFixed(2)} ${n.y.toFixed(2)}, ${n.x.toFixed(2)} ${n.y.toFixed(2)}`;
          return (
            <path
              key={`seg-${wi}-${i}`}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={1.15}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              filter="url(#kashuSoftGlow)"
              opacity={0.95}
            />
          );
        })
      )}

      {weekPaths.flatMap((wp) =>
        wp.pts.map((p) => {
          const selected = p.cell.date === selectedDate;
          return (
            <g key={p.cell.date}>
              <circle
                cx={p.x}
                cy={p.y}
                r={selected ? 1.55 : 1.15}
                fill={p.color}
                stroke="#fff"
                strokeWidth={0.45}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })
      )}
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

  const filterEvents = (raw: KashuRadarEvent[]) =>
    showLifestyle ? raw : raw.filter((e) => eventTone(e) !== "life");

  const { cells, rows } = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const total = Math.ceil((startPad + daysInMonth) / 7) * 7;
    const rowCount = total / 7;
    const out: DayCell[] = [];
    for (let i = 0; i < total; i++) {
      const date = new Date(cursor.year, cursor.month, i - startPad + 1);
      const ymd = toYmd(date);
      out.push({
        date: ymd,
        inMonth: date.getMonth() === cursor.month,
        isToday: ymd === todayYmd,
        day: dayByDate.get(ymd) ?? null,
        events: filterEvents(eventsByDate.get(ymd) ?? []),
        col: i % 7,
        row: Math.floor(i / 7),
      });
    }
    return { cells: out, rows: rowCount };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      return {
        date: ymd,
        inMonth: true,
        isToday: ymd === todayYmd,
        day: dayByDate.get(ymd) ?? null,
        events: filterEvents(eventsByDate.get(ymd) ?? []),
        col: i,
        row: 0,
      } satisfies DayCell;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (ev.date >= from && ev.date <= to && isBillEvent(ev)) upcoming += ev.amount;
    }
    return {
      available: forecast.safeToSpend,
      eomLeftover: eom?.availableAboveFloor ?? null,
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
      .filter((ev) => showLifestyle || eventTone(ev) !== "life")
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
      return `Whoa — this day dips below your floor. Pause the fun spend if you can. 🛟`;
    }
    if (selected.day.status === "yellow") {
      return `Close to the cushion. About ${money(daily)}/day feels safe until payday. 👀`;
    }
    return `You're in a good zone! Safe to spend about ${money(Math.max(daily, 0))}/day without breaking the plan. ✨`;
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
  const displayRows = view === "week" ? 1 : rows;

  return (
    <div className="space-y-4">
      {/* Bubbly header stats — playful orbs */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <FunStat
          emoji="💸"
          label="Available now"
          value={money(headerStats.available)}
          hint="Above safety floor"
          className="from-[#ECFDF5] to-[#A7F3D0] text-emerald-950"
        />
        <FunStat
          emoji="🏁"
          label="Month end vibe"
          value={
            headerStats.eomLeftover != null ? money(headerStats.eomLeftover) : "—"
          }
          hint="Projected leftover"
          className="from-[#EFF6FF] to-[#BFDBFE] text-sky-950"
        />
        <FunStat
          emoji="🎉"
          label="Next payday"
          value={
            headerStats.daysUntilPayday != null
              ? headerStats.daysUntilPayday === 0
                ? "Today!"
                : `in ${headerStats.daysUntilPayday}d`
              : "—"
          }
          hint={headerStats.nextPayday ?? "Set in Buffers"}
          className="from-[#F5F3FF] to-[#DDD6FE] text-violet-950"
        />
        <FunStat
          emoji="🧾"
          label="Bills coming"
          value={money(headerStats.upcoming7)}
          hint="Next 7 days"
          className="from-[#FFF1F2] to-[#FECDD3] text-rose-950"
        />
        <FunStat
          emoji="🛟"
          label="Safety floor"
          value={money(headerStats.safetyFloor)}
          hint="Don't go below"
          className="col-span-2 from-[#FFFBEB] to-[#FDE68A] text-amber-950 lg:col-span-1"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Cash calendar 🗓️
          </h2>
          <p className="text-sm text-slate-500">
            Bubbles are your money moves. The wavy line is leftover above your floor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-white/80 p-1 shadow-sm ring-1 ring-slate-200/80 backdrop-blur">
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
                  "rounded-full px-3.5 py-1.5 text-xs font-bold transition",
                  view === id
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-md"
                    : "text-slate-600 hover:bg-slate-50"
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
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ring-1 transition",
              showLifestyle
                ? "bg-gradient-to-r from-amber-300 to-orange-400 text-white ring-orange-300"
                : "bg-white text-slate-600 ring-slate-200"
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Lifestyle ✨
          </button>
          <div className="inline-flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200">
            <button
              type="button"
              aria-label="Previous"
              onClick={() => (view === "week" ? shiftWeek(-1) : shiftMonth(-1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-violet-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-[9rem] text-center text-sm font-bold text-slate-900">
              {view === "week"
                ? `Week of ${parseYmd(weekCells[0]?.date ?? todayYmd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                : monthLabel(cursor.year, cursor.month)}
            </p>
            <button
              type="button"
              aria-label="Next"
              onClick={() => (view === "week" ? shiftWeek(1) : shiftMonth(1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-violet-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div className="min-w-0 space-y-4">
          {view === "list" ? (
            <ListView
              cells={cells.filter((c) => c.inMonth)}
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
            />
          ) : (
            <div className="overflow-hidden rounded-[1.75rem] border border-white/60 bg-gradient-to-br from-white via-[#F0FDFA] to-[#FDF2F8] shadow-[0_20px_50px_-28px_rgba(124,58,237,0.35)] ring-1 ring-violet-100/80">
              <div className="grid grid-cols-7 border-b border-violet-100/60 bg-white/50 backdrop-blur">
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="px-1 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-violet-400"
                  >
                    {d}
                  </div>
                ))}
              </div>

              <div className="relative">
                {(view === "month" || view === "week") && (
                  <CalendarTrendOnMap
                    cells={displayCells}
                    rows={displayRows}
                    selectedDate={selectedDate}
                  />
                )}

                <div className="relative z-[3] grid grid-cols-7">
                  {displayCells.map((cell) => {
                    const isSelected = cell.date === selectedDate;
                    const chips = cell.events.slice(0, view === "week" ? 3 : 2);
                    const extra = cell.events.length - chips.length;
                    return (
                      <button
                        key={cell.date}
                        type="button"
                        disabled={view === "month" && !cell.inMonth}
                        onClick={() => setSelectedDate(cell.date)}
                        className={cn(
                          "relative flex min-h-[6rem] flex-col gap-1 border-b border-r border-violet-100/50 p-1.5 text-left transition sm:min-h-[7.25rem] sm:p-2",
                          view === "month" && !cell.inMonth && "bg-slate-50/40 opacity-40",
                          cell.inMonth && "hover:bg-white/70",
                          isSelected &&
                            "z-[4] bg-white/90 shadow-[inset_0_0_0_2.5px_#A855F7]",
                          cell.isToday && cell.inMonth && "bg-violet-50/40"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              "inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full text-[12px] font-bold",
                              cell.isToday && cell.inMonth
                                ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-400/40"
                                : "text-slate-700"
                            )}
                          >
                            {parseYmd(cell.date).getDate()}
                          </span>
                          {cell.isToday && cell.inMonth ? (
                            <span className="rounded-full bg-violet-500 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white shadow-sm">
                              Today
                            </span>
                          ) : null}
                        </div>

                        {(cell.inMonth || view === "week") && (
                          <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                            {chips.map((ev) => (
                              <EventBubble key={ev.id} ev={ev} />
                            ))}
                            {extra > 0 ? (
                              <span className="text-[9px] font-bold text-violet-500">
                                +{extra} more
                              </span>
                            ) : null}

                            {cell.isToday && cell.day ? (
                              <span className="mt-auto inline-flex max-w-full items-center gap-1 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 px-2 py-1 text-[9px] font-black text-white shadow-md shadow-sky-400/40">
                                <span aria-hidden>🪙</span>
                                <span className="truncate">
                                  Leftover {moneyShort(cell.day.availableAboveFloor)}
                                </span>
                              </span>
                            ) : cell.day ? (
                              <span
                                className={cn(
                                  "mt-auto text-[9px] font-bold",
                                  cell.day.availableAboveFloor < 0
                                    ? "text-rose-500"
                                    : cell.day.status === "yellow"
                                      ? "text-amber-600"
                                      : "text-emerald-600/80"
                                )}
                              >
                                {moneyShort(cell.day.availableAboveFloor)}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {selected && (selected.inMonth || view !== "month") ? (
            <div className="grid gap-3 rounded-[1.75rem] border border-violet-100 bg-white/90 p-4 shadow-[0_16px_40px_-28px_rgba(168,85,247,0.45)] backdrop-blur md:grid-cols-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-violet-500">
                  {parseYmd(selected.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                  {selected.isToday ? " · Today 👋" : ""}
                </p>
                <p className="mt-2 text-xs font-bold text-slate-400">Cash flow</p>
                {selected.day ? (
                  <ul className="mt-2 space-y-2 text-sm">
                    <FlowRow emoji="🥳" label="Income" value={`+${money(selected.day.income)}`} tone="text-emerald-600" />
                    <FlowRow emoji="🧾" label="Bills" value={`−${money(selected.day.obligations)}`} tone="text-rose-600" />
                    <FlowRow emoji="✨" label="Lifestyle" value={`−${money(selected.day.lifestyleBurn)}`} tone="text-orange-600" />
                    <li className="flex justify-between border-t border-violet-100 pt-2 font-black text-slate-900">
                      <span>Net</span>
                      <span>
                        {money(
                          selected.day.income -
                            selected.day.obligations -
                            selected.day.lifestyleBurn
                        )}
                      </span>
                    </li>
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No projection yet.</p>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400">Balance impact</p>
                {selected.day ? (
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Yesterday</span>
                      <span className="font-bold">
                        {prevDay ? money(prevDay.endingBalance) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Ends today</span>
                      <span className="font-bold">{money(selected.day.endingBalance)}</span>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 px-3 py-2.5 text-white shadow-md shadow-sky-300/40">
                      <p className="text-[10px] font-black uppercase tracking-wider text-sky-50">
                        Leftover above floor
                      </p>
                      <p className="text-xl font-black">
                        {money(selected.day.availableAboveFloor)}
                      </p>
                    </div>
                  </div>
                ) : null}
                <div className="mt-3 flex flex-col gap-1.5">
                  {selected.events.slice(0, 4).map((ev) => (
                    <EventBubble key={ev.id} ev={ev} big />
                  ))}
                </div>
              </div>

              <div className="rounded-[1.35rem] bg-gradient-to-br from-violet-600 via-fuchsia-500 to-rose-400 p-3.5 text-white shadow-xl shadow-fuchsia-400/30">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-violet-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  Kashu’s take
                </p>
                <p className="mt-2 text-sm font-medium leading-relaxed text-white">
                  {dayInsight ?? "Add bills + payday and I’ll coach this day. 🤖"}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-3">
          <div className="rounded-[1.75rem] border border-violet-100 bg-white/90 p-4 shadow-sm backdrop-blur">
            <p className="text-xs font-black uppercase tracking-wider text-violet-500">
              Next 7 days 🔮
            </p>
            <ul className="mt-3 space-y-2.5">
              {next7.map((ev) => (
                <li key={ev.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(ev.date);
                      const d = parseYmd(ev.date);
                      setCursor({ year: d.getFullYear(), month: d.getMonth() });
                      setView("month");
                    }}
                    className="flex w-full items-center gap-2 rounded-2xl px-1 py-0.5 text-left hover:bg-violet-50"
                  >
                    <span className="w-10 shrink-0 text-[10px] font-bold text-slate-400">
                      {parseYmd(ev.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="text-base" aria-hidden>
                      {eventEmoji(ev)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-800">
                      {ev.title}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-black",
                        eventTone(ev) === "pay" && "text-emerald-600",
                        eventTone(ev) === "life" && "text-orange-500",
                        eventTone(ev) === "bill" && "text-rose-600"
                      )}
                    >
                      {eventTone(ev) === "pay" ? "+" : "−"}
                      {moneyShort(ev.amount).replace("-", "")}
                    </span>
                  </button>
                </li>
              ))}
              {next7.length === 0 ? (
                <li className="text-sm text-slate-500">
                  Quiet week — add bills to see the bubbles pop. 🫧
                </li>
              ) : null}
            </ul>
          </div>

          <div className="rounded-[1.75rem] bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-400 p-4 text-white shadow-lg shadow-emerald-300/40">
            <p className="text-xs font-black uppercase tracking-wider text-emerald-50">
              Safe to Spend 💚
            </p>
            <p className="mt-1 text-3xl font-black tracking-tight">
              {money(forecast.safeToSpend)}
            </p>
            <p className="mt-1 text-xs font-medium text-white/90">{forecast.message}</p>
          </div>

          <div className="rounded-2xl bg-violet-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-violet-800">
            <p>
              🌊 The wavy line on the calendar is your <strong>leftover</strong> (above the
              safety floor) — one smooth wave per week. Higher on the day = more cushion.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function FunStat({
  emoji,
  label,
  value,
  hint,
  className,
}: {
  emoji: string;
  label: string;
  value: string;
  hint: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.5rem] bg-gradient-to-br p-3 shadow-md ring-1 ring-black/5",
        className
      )}
    >
      <p className="text-[10px] font-black uppercase tracking-wider opacity-70">
        <span className="mr-1">{emoji}</span>
        {label}
      </p>
      <p className="mt-0.5 text-lg font-black tracking-tight sm:text-xl">{value}</p>
      <p className="text-[10px] font-semibold opacity-60">{hint}</p>
    </div>
  );
}

function FlowRow({
  emoji,
  label,
  value,
  tone,
}: {
  emoji: string;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-full bg-slate-50 px-2.5 py-1.5">
      <span className="text-slate-600">
        <span className="mr-1">{emoji}</span>
        {label}
      </span>
      <span className={cn("font-black", tone)}>{value}</span>
    </li>
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
    <div className="overflow-hidden rounded-[1.75rem] border border-violet-100 bg-white shadow-sm">
      <ul className="divide-y divide-violet-50">
        {withAction.map((cell) => (
          <li key={cell.date}>
            <button
              type="button"
              onClick={() => onSelect(cell.date)}
              className={cn(
                "flex w-full flex-col gap-2 px-4 py-3 text-left hover:bg-violet-50/80 sm:flex-row sm:items-center",
                selectedDate === cell.date && "bg-violet-50"
              )}
            >
              <div className="w-28 shrink-0">
                <p className="text-sm font-black text-slate-900">
                  {parseYmd(cell.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                {cell.day ? (
                  <p className="text-[11px] font-bold text-emerald-600">
                    🪙 {money(cell.day.availableAboveFloor)}
                  </p>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {cell.events.map((ev) => (
                  <EventBubble key={ev.id} ev={ev} big />
                ))}
              </div>
            </button>
          </li>
        ))}
        {withAction.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-slate-500">
            No bubbles yet — add payday + bills and this list lights up. 🫧
          </li>
        ) : null}
      </ul>
    </div>
  );
}
