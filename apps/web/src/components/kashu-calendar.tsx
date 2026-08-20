"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Pencil,
  Plus,
  Minus,
  Shield,
  Sparkles,
  Wallet,
} from "lucide-react";
import type {
  KashuDayProjection,
  KashuForecast,
  KashuRadarEvent,
  KashuTimingScenario,
} from "@forward/shared";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type CalView = "month" | "week" | "list";
type EventTone = "income" | "bill" | "tax" | "utility" | "lifestyle";

function money(n: number, digits = 0) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
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

function eventTone(ev: KashuRadarEvent): EventTone {
  if (isPayEvent(ev)) return "income";
  if (ev.kind === "lifestyle" || ev.priority === "LIFESTYLE" || ev.priority === "DISCRETIONARY") {
    return "lifestyle";
  }
  const t = ev.title.toLowerCase();
  if (/\b(tax|property tax|irs|cra|windsor|assessment)\b/.test(t)) return "tax";
  if (
    /\b(energy|utility|utilities|hydro|electric|gas|water|bell|rogers|telus|internet|phone|sandpiper)\b/.test(
      t
    )
  ) {
    return "utility";
  }
  return "bill";
}

function shortTitle(title: string, max = 12) {
  const t = title.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const TONE_CHIP: Record<EventTone, string> = {
  income: "bg-[#12B76A] text-white ring-emerald-300/40",
  bill: "bg-[#F04438] text-white ring-rose-300/40",
  tax: "bg-[#7A5AF8] text-white ring-violet-300/40",
  utility: "bg-[#2E90FA] text-white ring-sky-300/40",
  lifestyle: "bg-[#F79009] text-white ring-amber-300/40",
};

const TONE_TEXT: Record<EventTone, string> = {
  income: "text-[#12B76A]",
  bill: "text-[#F04438]",
  tax: "text-[#7A5AF8]",
  utility: "text-[#2E90FA]",
  lifestyle: "text-[#F79009]",
};

type DayCell = {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  day: KashuDayProjection | null;
  events: KashuRadarEvent[];
};

function dayWash(cell: DayCell): string {
  if (!cell.inMonth) return "bg-slate-50/70 text-slate-300";
  const tones = new Set(cell.events.map(eventTone));
  if (tones.has("income") && (tones.has("bill") || tones.has("tax") || tones.has("utility"))) {
    return "bg-gradient-to-br from-emerald-50 via-white to-rose-50";
  }
  if (tones.has("income")) return "bg-emerald-50/60";
  if (tones.has("bill") || tones.has("tax")) return "bg-rose-50/50";
  if (tones.has("utility")) return "bg-sky-50/50";
  if (tones.has("lifestyle")) return "bg-amber-50/50";
  if (cell.day?.status === "red") return "bg-rose-50/35";
  if (cell.day?.status === "yellow") return "bg-amber-50/30";
  return "bg-white";
}

function EventBubble({
  ev,
  compact = false,
}: {
  ev: KashuRadarEvent;
  compact?: boolean;
}) {
  const tone = eventTone(ev);
  const sign = tone === "income" ? "+" : "−";
  return (
    <span
      title={`${sign}${money(ev.amount, 2)} ${ev.title}`}
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold leading-none shadow-sm ring-1 sm:text-[10px]",
        TONE_CHIP[tone]
      )}
    >
      {tone === "income" ? (
        <Plus className="h-2.5 w-2.5 shrink-0" strokeWidth={3} />
      ) : (
        <Minus className="h-2.5 w-2.5 shrink-0" strokeWidth={3} />
      )}
      {!compact ? (
        <span className="truncate">
          {shortTitle(ev.title, 10)} {sign}
          {moneyShort(ev.amount).replace("-", "")}
        </span>
      ) : (
        <span>
          {sign}
          {moneyShort(ev.amount).replace("-", "")}
        </span>
      )}
    </span>
  );
}

/** Running projected balance under the month grid — green when healthy, red when dipping. */
function RunningBalanceChart({
  cells,
  selectedDate,
  onSelect,
  safetyFloor,
}: {
  cells: DayCell[];
  selectedDate: string | null;
  onSelect: (d: string) => void;
  safetyFloor: number;
}) {
  const series = useMemo(() => cells.filter((c) => c.inMonth && c.day), [cells]);
  if (series.length < 2) return null;

  const values = series.map((c) => c.day!.endingBalance);
  const min = Math.min(...values, 0, -safetyFloor);
  const max = Math.max(...values, safetyFloor || 1, 1);
  const span = Math.max(max - min, 1);
  const w = 100;
  const h = 42;
  const padY = 5;

  const pts = series.map((c, i) => {
    const x = (i / (series.length - 1)) * w;
    const norm = (c.day!.endingBalance - min) / span;
    const y = h - padY - norm * (h - padY * 2);
    return { x, y, c, bal: c.day!.endingBalance };
  });

  const zeroY = h - padY - ((0 - min) / span) * (h - padY * 2);
  const floorY = h - padY - ((safetyFloor - min) / span) * (h - padY * 2);

  const path = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");

  const ticks = [min, 0, max / 2, max].filter(
    (v, i, arr) => Number.isFinite(v) && arr.indexOf(v) === i
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Running balance (projected)
          </p>
          <p className="text-xs text-slate-500">
            Day-by-day cash after paydays and bills — red marks dips below zero
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] font-semibold">
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <span className="h-1.5 w-4 rounded-full bg-[#12B76A]" /> Healthy
          </span>
          <span className="inline-flex items-center gap-1 text-rose-600">
            <span className="h-1.5 w-4 rounded-full bg-[#F04438]" /> Below $0
          </span>
          <span className="inline-flex items-center gap-1 text-sky-700">
            <span className="h-0.5 w-4 border-t border-dashed border-sky-500" /> Floor
          </span>
        </div>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-10 flex-col justify-between py-1 text-[9px] font-medium text-slate-400">
          <span>{moneyShort(max)}</span>
          <span>$0</span>
          <span>{moneyShort(min)}</span>
        </div>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="ml-10 h-28 w-[calc(100%-2.5rem)]"
          preserveAspectRatio="none"
        >
          <line
            x1={0}
            y1={zeroY}
            x2={w}
            y2={zeroY}
            stroke="#cbd5e1"
            strokeWidth={0.35}
            strokeDasharray="1.2 1.2"
            vectorEffect="non-scaling-stroke"
          />
          {safetyFloor > 0 ? (
            <line
              x1={0}
              y1={floorY}
              x2={w}
              y2={floorY}
              stroke="#38bdf8"
              strokeWidth={0.4}
              strokeDasharray="1.5 1.2"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {pts.slice(0, -1).map((p, i) => {
            const n = pts[i + 1]!;
            const bad = p.bal < 0 || n.bal < 0;
            return (
              <line
                key={p.c.date}
                x1={p.x}
                y1={p.y}
                x2={n.x}
                y2={n.y}
                stroke={bad ? "#F04438" : "#12B76A"}
                strokeWidth={1.35}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          {pts.map((p) => {
            const bad = p.bal < 0;
            const selected = p.c.date === selectedDate;
            return (
              <circle
                key={`pt-${p.c.date}`}
                cx={p.x}
                cy={p.y}
                r={selected ? 1.8 : bad ? 1.4 : 1.0}
                fill={bad ? "#F04438" : "#12B76A"}
                stroke="#fff"
                strokeWidth={0.45}
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer"
                onClick={() => onSelect(p.c.date)}
              >
                <title>
                  {parseYmd(p.c.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  : {money(p.bal)}
                </title>
              </circle>
            );
          })}
        </svg>
      </div>

      <div className="ml-10 mt-1 flex justify-between text-[10px] text-slate-400">
        <span>
          {parseYmd(series[0]!.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
        <span className="hidden sm:inline">{ticks.length ? "Tap a point to open that day" : null}</span>
        <span>
          {parseYmd(series[series.length - 1]!.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}

function MonthCategoryDonut({
  income,
  bills,
  taxes,
  utilities,
  lifestyle,
  buffer,
}: {
  income: number;
  bills: number;
  taxes: number;
  utilities: number;
  lifestyle: number;
  buffer: number;
}) {
  const slices = [
    { label: "Income", amount: income, color: "#12B76A" },
    { label: "Bills & commitments", amount: bills, color: "#F04438" },
    { label: "Taxes", amount: taxes, color: "#7A5AF8" },
    { label: "Utilities / services", amount: utilities, color: "#2E90FA" },
    { label: "Lifestyle", amount: lifestyle, color: "#F79009" },
    { label: "Buffer", amount: buffer, color: "#94A3B8" },
  ].filter((s) => s.amount > 0);

  const total = slices.reduce((s, x) => s + x.amount, 0) || 1;
  let angle = -90;
  const arcs = slices.map((s) => {
    const sweep = (s.amount / total) * 360;
    const start = angle;
    angle += sweep;
    return { ...s, start, sweep };
  });

  function arcPath(startDeg: number, sweepDeg: number, r = 36, cx = 50, cy = 50) {
    if (sweepDeg >= 359.9) {
      return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
    }
    const toRad = (d: number) => (d * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startDeg));
    const y1 = cy + r * Math.sin(toRad(startDeg));
    const x2 = cx + r * Math.cos(toRad(startDeg + sweepDeg));
    const y2 = cy + r * Math.sin(toRad(startDeg + sweepDeg));
    const large = sweepDeg > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  }

  return (
    <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        Cash flow this month
      </p>
      <div className="mt-3 flex items-center gap-3">
        <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0">
          <circle cx="50" cy="50" r="38" fill="#F8FAFC" />
          {arcs.map((a) => (
            <path key={a.label} d={arcPath(a.start, a.sweep)} fill={a.color} opacity={0.9} />
          ))}
          <circle cx="50" cy="50" r="20" fill="white" />
        </svg>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {slices.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-600">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: s.color }}
                />
                {s.label}
              </span>
              <span className="shrink-0 font-semibold text-slate-900">{money(s.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function KashuCalendar({
  forecast,
  onNeedHorizon,
  onSaveBalance,
  balanceBusy = false,
}: {
  forecast: KashuForecast;
  onNeedHorizon?: (days: 60 | 90) => void;
  onSaveBalance?: (balance: number) => Promise<void> | void;
  balanceBusy?: boolean;
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
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceDraft, setBalanceDraft] = useState(String(forecast.liquidBalance ?? ""));

  useEffect(() => {
    setBalanceDraft(String(forecast.liquidBalance ?? ""));
  }, [forecast.liquidBalance]);

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
    showLifestyle ? raw : raw.filter((e) => eventTone(e) !== "lifestyle");

  const cells: DayCell[] = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const total = Math.ceil((startPad + daysInMonth) / 7) * 7;
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
      });
    }
    return out;
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
      } satisfies DayCell;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, todayYmd, dayByDate, eventsByDate, showLifestyle]);

  const selected =
    cells.find((c) => c.date === selectedDate) ??
    weekCells.find((c) => c.date === selectedDate) ??
    cells.find((c) => c.date === todayYmd) ??
    null;

  const monthEvents = useMemo(() => {
    const start = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-01`;
    const end = toYmd(new Date(cursor.year, cursor.month + 1, 0));
    return forecast.radar.filter((ev) => ev.date >= start && ev.date <= end);
  }, [forecast.radar, cursor.year, cursor.month]);

  const monthTotals = useMemo(() => {
    let income = 0;
    let bills = 0;
    let taxes = 0;
    let utilities = 0;
    let lifestyle = 0;
    for (const ev of monthEvents) {
      const tone = eventTone(ev);
      if (tone === "income") income += ev.amount;
      else if (tone === "tax") taxes += ev.amount;
      else if (tone === "utility") utilities += ev.amount;
      else if (tone === "lifestyle") lifestyle += ev.amount;
      else bills += ev.amount;
    }
    return { income, bills, taxes, utilities, lifestyle };
  }, [monthEvents]);

  const headerStats = useMemo(() => {
    const inMonthDays = cells.filter((c) => c.inMonth && c.day);
    const eom = inMonthDays[inMonthDays.length - 1]?.day ?? null;
    const from = todayYmd;
    const to = addDaysYmd(todayYmd, 10);
    const upcomingBills = forecast.radar
      .filter((ev) => ev.date >= from && ev.date <= to && isBillEvent(ev))
      .sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
    const nextBill = upcomingBills[0] ?? null;
    const upcomingTotal = upcomingBills.reduce((s, e) => s + e.amount, 0);
    const paydayEv =
      forecast.radar.find(
        (ev) => isPayEvent(ev) && ev.date === forecast.nextPayday
      ) ?? forecast.radar.find((ev) => isPayEvent(ev) && ev.date >= todayYmd) ?? null;

    return {
      available: forecast.liquidBalance,
      safeToSpend: forecast.safeToSpend,
      eomLeftover: eom?.availableAboveFloor ?? monthEndFallback(cells),
      eomBalance: eom?.endingBalance ?? null,
      nextPayday: forecast.nextPayday,
      daysUntilPayday: forecast.daysUntilPayday,
      paydayAmount: paydayEv?.amount ?? null,
      upcomingTotal,
      nextBill,
      safetyFloor: forecast.safetyFloor,
    };
  }, [cells, forecast, todayYmd]);

  const next10 = useMemo(() => {
    const from = todayYmd;
    const to = addDaysYmd(todayYmd, 10);
    return forecast.radar
      .filter((ev) => ev.date >= from && ev.date <= to)
      .filter((ev) => showLifestyle || eventTone(ev) !== "lifestyle")
      .slice(0, 10);
  }, [forecast.radar, todayYmd, showLifestyle]);

  const recurring = useMemo(() => {
    const seen = new Map<string, KashuRadarEvent>();
    for (const ev of forecast.radar) {
      if (!isBillEvent(ev)) continue;
      const key = ev.title.toLowerCase();
      if (!seen.has(key) || (seen.get(key)!.amount < ev.amount)) {
        seen.set(key, ev);
      }
    }
    return [...seen.values()].sort((a, b) => b.amount - a.amount).slice(0, 8);
  }, [forecast.radar]);

  const kashuTake = useMemo(() => {
    if (forecast.timingScenarios[0]) {
      return forecast.timingScenarios[0].note;
    }
    if (headerStats.eomLeftover != null && headerStats.eomLeftover >= 0) {
      return `Great job — you're in a good zone. After upcoming bills, you'll have about ${money(headerStats.eomLeftover)} left above your floor at month-end.`;
    }
    if (forecast.collisions.length > 0) {
      return `Income may cover the month, but timing creates ${forecast.collisions.length} squeeze${forecast.collisions.length === 1 ? "" : "s"}. Open Timing for move suggestions.`;
    }
    return forecast.message;
  }, [forecast, headerStats.eomLeftover]);

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

  async function submitBalance() {
    if (!onSaveBalance) return;
    const n = Number(balanceDraft);
    if (!Number.isFinite(n) || n < 0) return;
    await onSaveBalance(n);
    setEditingBalance(false);
  }

  const displayCells = view === "week" ? weekCells : cells;

  return (
    <div className="space-y-4">
      {/* KPI strip — matches cash-flow calendar mock */}
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
        <div className="relative col-span-2 rounded-[1.25rem] border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-3 py-3 shadow-sm xl:col-span-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Available now
            </p>
            {onSaveBalance ? (
              <button
                type="button"
                onClick={() => setEditingBalance((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-white"
              >
                <Pencil className="h-3 w-3" />
                {editingBalance ? "Cancel" : "Edit"}
              </button>
            ) : null}
          </div>
          {editingBalance && onSaveBalance ? (
            <form
              className="mt-1.5 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submitBalance();
              }}
            >
              <label className="block text-[10px] font-semibold text-emerald-800">
                Today&apos;s actual account balance
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  autoFocus
                  value={balanceDraft}
                  onChange={(e) => setBalanceDraft(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-2.5 py-1.5 text-base font-bold text-slate-900 outline-none ring-emerald-400 focus:ring-2"
                  placeholder="812.37"
                />
              </label>
              <button
                type="submit"
                disabled={balanceBusy}
                className="w-full rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {balanceBusy ? "Saving…" : "Save balance"}
              </button>
            </form>
          ) : (
            <>
              <p className="mt-0.5 text-xl font-bold text-slate-900 sm:text-2xl">
                {money(headerStats.available, 2)}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-emerald-800/80">
                <Wallet className="h-3 w-3" />
                Safe to spend {money(headerStats.safeToSpend)}
              </p>
            </>
          )}
        </div>

        <StatCard
          label="Projected end of month"
          value={
            headerStats.eomBalance != null ? money(headerStats.eomBalance) : "—"
          }
          hint="If nothing changes"
          tone="sky"
        />
        <StatCard
          label="Next payday"
          value={
            headerStats.daysUntilPayday != null
              ? headerStats.daysUntilPayday === 0
                ? "Today"
                : `in ${headerStats.daysUntilPayday} days`
              : "—"
          }
          hint={
            headerStats.nextPayday
              ? `${parseYmd(headerStats.nextPayday).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}${headerStats.paydayAmount != null ? ` · +${money(headerStats.paydayAmount)}` : ""}`
              : "Set payday in Buffers"
          }
          tone="violet"
        />
        <StatCard
          label="Upcoming commitments"
          value={
            headerStats.nextBill
              ? money(headerStats.nextBill.amount)
              : money(headerStats.upcomingTotal)
          }
          hint={
            headerStats.nextBill
              ? headerStats.nextBill.title
              : "Next 10 days"
          }
          tone="rose"
        />
        <StatCard
          label="Safety floor"
          value={money(headerStats.safetyFloor)}
          hint="Your minimum buffer"
          tone="blue"
          icon={<Shield className="h-3.5 w-3.5" />}
        />
      </div>

      {forecast.timingScenarios.length > 0 ? (
        <TimingStrip scenarios={forecast.timingScenarios} />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Cash Flow Calendar</h2>
          <p className="text-sm text-slate-500">
            Paydays, bills, and running balance — tap a day for detail
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-full bg-white p-1 ring-1 ring-slate-200">
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
                    ? "bg-slate-900 text-white"
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
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition",
              showLifestyle
                ? "bg-amber-100 text-amber-900 ring-amber-300"
                : "bg-white text-slate-600 ring-slate-200"
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Lifestyle
          </button>
          <div className="inline-flex items-center gap-1 rounded-full bg-white p-1 ring-1 ring-slate-200">
            <button
              type="button"
              aria-label="Previous"
              onClick={() => (view === "week" ? shiftWeek(-1) : shiftMonth(-1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-[9rem] text-center text-sm font-semibold text-slate-900">
              {view === "week"
                ? `Week of ${parseYmd(weekCells[0]?.date ?? todayYmd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                : monthLabel(cursor.year, cursor.month)}
            </p>
            <button
              type="button"
              aria-label="Next"
              onClick={() => (view === "week" ? shiftWeek(1) : shiftMonth(1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          {view === "list" ? (
            <ListView
              cells={cells.filter((c) => c.inMonth)}
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
            />
          ) : (
            <>
              <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-[0_16px_48px_-32px_rgba(15,23,42,0.4)]">
                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/90">
                  {WEEKDAYS.map((d) => (
                    <div
                      key={d}
                      className="px-1 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {displayCells.map((cell) => {
                    const isSelected = cell.date === selectedDate;
                    const chips = cell.events.slice(0, view === "week" ? 5 : 3);
                    const extra = cell.events.length - chips.length;
                    return (
                      <button
                        key={cell.date}
                        type="button"
                        disabled={view === "month" && !cell.inMonth}
                        onClick={() => setSelectedDate(cell.date)}
                        className={cn(
                          "relative flex min-h-[5.75rem] flex-col gap-1 border-b border-r border-slate-100 p-1.5 text-left transition sm:min-h-[7rem] sm:p-2",
                          dayWash(cell),
                          (cell.inMonth || view === "week") && "hover:brightness-[0.98]",
                          isSelected && "z-[3] bg-white shadow-[inset_0_0_0_2px_#12B76A]",
                          cell.isToday && cell.inMonth && "font-semibold"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              "inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-[11px]",
                              cell.isToday && cell.inMonth
                                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                                : "text-slate-700"
                            )}
                          >
                            {parseYmd(cell.date).getDate()}
                          </span>
                          {cell.day && cell.day.endingBalance < 0 ? (
                            <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[8px] font-bold text-rose-700">
                              {moneyShort(cell.day.endingBalance)}
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
                              <span className="text-[9px] font-semibold text-slate-500">
                                +{extra} more
                              </span>
                            ) : null}
                            {cell.day ? (
                              <span
                                className={cn(
                                  "mt-auto text-[9px] font-semibold",
                                  cell.day.endingBalance < 0
                                    ? "text-rose-600"
                                    : cell.day.status === "yellow"
                                      ? "text-amber-700"
                                      : "text-slate-500"
                                )}
                              >
                                bal {moneyShort(cell.day.endingBalance)}
                              </span>
                            ) : (
                              <span className="mt-auto text-[9px] text-slate-300">—</span>
                            )}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {view === "month" ? (
                <RunningBalanceChart
                  cells={cells}
                  selectedDate={selectedDate}
                  onSelect={setSelectedDate}
                  safetyFloor={forecast.safetyFloor}
                />
              ) : null}
            </>
          )}

          <div className="flex flex-wrap gap-2 text-[10px]">
            {(
              [
                ["income", "Income"],
                ["bill", "Bills / commitments"],
                ["tax", "Taxes"],
                ["utility", "Utilities / services"],
                ["lifestyle", "Lifestyle"],
              ] as const
            ).map(([tone, label]) => (
              <span
                key={tone}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold text-white",
                  TONE_CHIP[tone].split(" ").slice(0, 2).join(" ")
                )}
              >
                {label}
              </span>
            ))}
          </div>

          {selected && (selected.inMonth || view !== "month") ? (
            <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {parseYmd(selected.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
                {selected.isToday ? " · Today" : ""}
              </p>
              {selected.day ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Cash flow
                    </p>
                    <ul className="mt-1.5 space-y-1 text-sm">
                      <li className="flex justify-between gap-2">
                        <span className="text-slate-500">Income</span>
                        <span className="font-semibold text-[#12B76A]">
                          +{money(selected.day.income)}
                        </span>
                      </li>
                      <li className="flex justify-between gap-2">
                        <span className="text-slate-500">Bills</span>
                        <span className="font-semibold text-[#F04438]">
                          −{money(selected.day.obligations)}
                        </span>
                      </li>
                      <li className="flex justify-between gap-2">
                        <span className="text-slate-500">Lifestyle</span>
                        <span className="font-semibold text-[#F79009]">
                          −{money(selected.day.lifestyleBurn)}
                        </span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Balance
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {money(selected.day.endingBalance)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {money(selected.day.availableAboveFloor)} above floor
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {selected.events.slice(0, 6).map((ev) => (
                      <div key={ev.id} className="flex items-center gap-2">
                        <EventBubble ev={ev} />
                        <span className="truncate text-[11px] text-slate-500">{ev.title}</span>
                      </div>
                    ))}
                    {selected.events.length === 0 ? (
                      <p className="text-sm text-slate-500">Quiet day</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No projection for this day yet.</p>
              )}
            </div>
          ) : null}
        </div>

        <aside className="space-y-3">
          <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Upcoming (next 10 days)
            </p>
            <ul className="mt-3 space-y-2">
              {next10.map((ev) => {
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
                      className="flex w-full items-center gap-2 rounded-xl px-1 py-1 text-left hover:bg-slate-50"
                    >
                      <span className="w-10 shrink-0 text-[10px] font-semibold text-slate-400">
                        {parseYmd(ev.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">
                        {ev.title}
                      </span>
                      <span className={cn("shrink-0 text-xs font-bold", TONE_TEXT[tone])}>
                        {tone === "income" ? "+" : "−"}
                        {moneyShort(ev.amount).replace("-", "")}
                      </span>
                    </button>
                  </li>
                );
              })}
              {next10.length === 0 ? (
                <li className="text-sm text-slate-500">
                  No pay or bills in the next 10 days — add commitments on Bills.
                </li>
              ) : null}
            </ul>
          </div>

          <MonthCategoryDonut
            income={monthTotals.income}
            bills={monthTotals.bills}
            taxes={monthTotals.taxes}
            utilities={monthTotals.utilities}
            lifestyle={monthTotals.lifestyle}
            buffer={forecast.safetyFloor}
          />

          <div className="rounded-[1.35rem] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800">
              <Sparkles className="h-3.5 w-3.5" />
              Kashu&apos;s take
            </p>
            <p className="mt-2 text-sm leading-relaxed text-emerald-950/90">{kashuTake}</p>
          </div>
        </aside>
      </div>

      {recurring.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Your recurring commitments
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recurring.map((ev) => (
              <div
                key={ev.id}
                className="min-w-[9.5rem] shrink-0 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
              >
                <p className="truncate text-xs font-semibold text-slate-800">{ev.title}</p>
                <p className={cn("mt-1 text-sm font-bold", TONE_TEXT[eventTone(ev)])}>
                  {money(ev.amount)}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Monthly · Around {parseYmd(ev.date).getDate()}
                  {ordinalSuffix(parseYmd(ev.date).getDate())}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TimingStrip({ scenarios }: { scenarios: KashuTimingScenario[] }) {
  const top = scenarios.slice(0, 2);
  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-emerald-50 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
        Timing intelligence
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {top.map((s) => (
          <li key={`${s.billId}-${s.moveToDay}`} className="text-sm text-slate-800">
            <span className="font-semibold text-emerald-800">
              {s.billTitle}: day {s.currentDueDay} → {s.moveToDay}
            </span>
            <span className="text-slate-600">
              {" "}
              · projected low becomes {money(s.projectedLow)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[11px] text-slate-500">
        Full recommendations live on the Timing tab — Kashu doesn&apos;t change payments for you.
      </p>
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

function ordinalSuffix(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function StatCard({
  label,
  value,
  hint,
  tone,
  icon,
  className,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "emerald" | "sky" | "rose" | "violet" | "blue";
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.25rem] border px-3 py-2.5 shadow-sm",
        tone === "emerald" && "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white",
        tone === "sky" && "border-sky-200 bg-gradient-to-br from-sky-50 to-white",
        tone === "rose" && "border-rose-200 bg-gradient-to-br from-rose-50 to-white",
        tone === "violet" && "border-violet-200 bg-gradient-to-br from-violet-50 to-white",
        tone === "blue" && "border-sky-200 bg-gradient-to-br from-sky-50 to-white",
        className
      )}
    >
      <p
        className={cn(
          "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider",
          tone === "emerald" && "text-emerald-700",
          tone === "sky" && "text-sky-700",
          tone === "rose" && "text-rose-700",
          tone === "violet" && "text-violet-700",
          tone === "blue" && "text-sky-800"
        )}
      >
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold text-slate-900 sm:text-xl">{value}</p>
      <p className="truncate text-[10px] text-slate-500">{hint}</p>
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
    <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white">
      <ul className="divide-y divide-slate-100">
        {withAction.map((cell) => (
          <li key={cell.date}>
            <button
              type="button"
              onClick={() => onSelect(cell.date)}
              className={cn(
                "flex w-full flex-col gap-2 px-4 py-3 text-left hover:bg-emerald-50/60 sm:flex-row sm:items-center",
                selectedDate === cell.date && "bg-emerald-50"
              )}
            >
              <div className="w-28 shrink-0">
                <p className="text-sm font-semibold text-slate-900">
                  {parseYmd(cell.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                {cell.day ? (
                  <p className="text-[11px] text-slate-500">
                    Bal {money(cell.day.endingBalance)}
                  </p>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {cell.events.map((ev) => (
                  <EventBubble key={ev.id} ev={ev} />
                ))}
                {cell.events.length === 0 ? (
                  <span className="text-xs text-slate-400">Quiet day</span>
                ) : null}
              </div>
            </button>
          </li>
        ))}
        {withAction.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-slate-500">
            No paydays or bills this month yet — add them on Bills or set payday in Buffers.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
