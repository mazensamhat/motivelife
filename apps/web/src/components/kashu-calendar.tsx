"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Heart,
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
  if (isBillEvent(ev)) return "bill";
  if (isLifestyleEvent(ev) || ev.kind === "lifestyle") return "life";
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
  col: number;
  row: number;
};

function dayWash(cell: DayCell): string {
  if (!cell.inMonth) return "bg-slate-50/80 text-slate-300";
  const hasPay = cell.events.some(isPayEvent);
  const hasBill = cell.events.some(isBillEvent);
  const hasLife = cell.events.some((e) => eventTone(e) === "life");
  if (hasPay && hasBill) return "bg-gradient-to-br from-emerald-50 via-white to-rose-50";
  if (hasPay) return "bg-emerald-50/70";
  if (hasBill) return "bg-rose-50/80";
  if (hasLife) return "bg-amber-50/70";
  if (cell.day?.status === "red") return "bg-rose-50/40";
  if (cell.day?.status === "yellow") return "bg-amber-50/35";
  return "bg-white";
}

function eventEmoji(ev: KashuRadarEvent): string {
  const t = ev.title.toLowerCase();
  if (isPayEvent(ev)) return "🥳";
  if (/mortgage|rbc/.test(t)) return "🏠";
  if (/aviva|insurance/.test(t)) return "🛡️";
  if (/lincoln|auto|car|afs/.test(t)) return "🚗";
  if (/bell|phone/.test(t)) return "📱";
  if (/enwin|enbridge|sandpiper|hydro|gas|util|energy/.test(t)) return "⚡";
  if (/netflix/.test(t)) return "📺";
  if (/fitness|gym|planet/.test(t)) return "💪";
  if (/tax|windsor|city/.test(t)) return "🏛️";
  if (eventTone(ev) === "life") return "✨";
  return "🧾";
}

function iconTone(ev: KashuRadarEvent): string {
  const t = ev.title.toLowerCase();
  if (isPayEvent(ev)) return "bg-[#12B76A] text-white";
  if (/mortgage|rbc/.test(t)) return "bg-[#F04438] text-white";
  if (/aviva|insurance/.test(t)) return "bg-[#F63D68] text-white";
  if (/lincoln|auto|afs/.test(t)) return "bg-[#2E90FA] text-white";
  if (/bell|phone/.test(t)) return "bg-[#7A5AF8] text-white";
  if (/sandpiper|enwin|enbridge|energy|util|hydro|gas/.test(t)) return "bg-[#0BA5EC] text-white";
  if (/netflix/.test(t)) return "bg-[#F79009] text-white";
  if (/fitness|gym|planet/.test(t)) return "bg-[#EF6820] text-white";
  if (/tax|windsor|city/.test(t)) return "bg-[#9E77ED] text-white";
  if (eventTone(ev) === "life") return "bg-[#F79009] text-white";
  return "bg-rose-500 text-white";
}

function EventBubble({
  ev,
  compact = false,
}: {
  ev: KashuRadarEvent;
  compact?: boolean;
}) {
  const tone = eventTone(ev);
  const sign = tone === "pay" ? "+" : "";
  const emoji = eventEmoji(ev);
  const label =
    isPayEvent(ev) && /bonus/i.test(ev.title)
      ? "Payday (Bonus)"
      : isPayEvent(ev)
        ? "Payday"
        : shortTitle(ev.title, compact ? 8 : 14);
  return (
    <span
      title={`${tone === "pay" ? "+" : "−"}${money(ev.amount)} ${ev.title}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-xl bg-white px-1 py-0.5 text-[9px] font-semibold leading-tight text-slate-800 shadow-sm ring-1 ring-slate-200/90 sm:text-[10px]",
        tone === "pay" && "ring-emerald-200"
      )}
    >
      <span
        className={cn(
          "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px]",
          iconTone(ev)
        )}
        aria-hidden
      >
        {emoji}
      </span>
      {!compact ? (
        <span className="min-w-0 truncate">
          {label}{" "}
          <span
            className={cn(
              "font-bold",
              tone === "pay" && "text-[#12B76A]",
              tone === "bill" && "text-[#F04438]",
              tone === "life" && "text-[#F79009]"
            )}
          >
            {`${sign}$${moneyExactChip(ev.amount)}`}
          </span>
        </span>
      ) : (
        <span
          className={cn(
            "font-bold",
            tone === "pay" && "text-[#12B76A]",
            tone === "bill" && "text-[#F04438]",
            tone === "life" && "text-[#F79009]"
          )}
        >
          {`${sign}$${moneyExactChip(ev.amount)}`}
        </span>
      )}
    </span>
  );
}

function moneyExactChip(n: number) {
  if (n >= 1000) return moneyShort(n).replace(/[$-]/g, "");
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

type HistoryTx = {
  id: string;
  postedAt: string;
  description: string;
  amount: number;
  direction: string;
  classification: string | null;
};

function isPayrollHistory(tx: HistoryTx): boolean {
  const d = (tx.description || "").toUpperCase();
  const credit =
    tx.direction === "credit" ||
    tx.classification === "income" ||
    tx.classification === "refund";
  if (!credit || tx.amount < 500) return false;
  // Real Cox / payroll only — ignore tiny credits and refunds labeled income
  if (/COX|PAYROLL|SALARY|DIRECT DEPOSIT|WAGE|\bMSP\b/.test(d)) return true;
  return tx.classification === "income" && tx.amount >= 2500;
}

function historyToRadar(tx: HistoryTx): KashuRadarEvent | null {
  const date = tx.postedAt.slice(0, 10);
  if (isPayrollHistory(tx)) {
    // Exact statement deposit — one chip, real amount (not a guessed average)
    const bonus = tx.amount >= 5000;
    return {
      id: `hist-${tx.id}`,
      date,
      kind: "payday",
      title: bonus ? "Payday (Bonus)" : "Payday",
      amount: tx.amount,
      balanceAfter: 0,
      status: "green",
      priority: "MANDATORY",
    };
  }

  const isIncome =
    tx.direction === "credit" ||
    tx.classification === "income" ||
    tx.classification === "refund";
  if (isIncome) return null; // never show non-payroll credits as Payday

  const kind: KashuRadarEvent["kind"] =
    tx.classification === "lifestyle" ? "lifestyle" : "obligation";
  return {
    id: `hist-${tx.id}`,
    date,
    kind,
    title: tx.description || "Transaction",
    amount: tx.amount,
    balanceAfter: 0,
    status: "green",
    priority: kind === "lifestyle" ? "LIFESTYLE" : "MANDATORY",
  };
}

/**
 * Concept running-balance chart — green above $0, red below, with Y-axis labels.
 */
function RunningBalanceChart({
  cells,
  eventsByDate,
  asOf,
  liquid,
  safetyFloor,
}: {
  cells: DayCell[];
  eventsByDate: Map<string, KashuRadarEvent[]>;
  asOf: string;
  liquid: number;
  safetyFloor: number;
}) {
  const inMonth = cells.filter((c) => c.inMonth).sort((a, b) => a.date.localeCompare(b.date));
  if (inMonth.length < 2) return null;

  // Reconstruct daily ending balance across the visible month
  const balances = new Map<string, number>();
  for (const c of inMonth) {
    if (c.day) balances.set(c.date, c.day.endingBalance);
  }
  // Walk backward from asOf for days without projection
  let cursorBal = liquid;
  const past = inMonth.filter((c) => c.date < asOf).reverse();
  for (const c of past) {
    const evs = eventsByDate.get(c.date) ?? c.events;
    for (const ev of [...evs].reverse()) {
      if (isPayEvent(ev)) cursorBal -= ev.amount;
      else cursorBal += ev.amount;
    }
    if (!balances.has(c.date)) balances.set(c.date, Math.round(cursorBal));
  }

  const series = inMonth.map((c) => ({
    date: c.date,
    bal: balances.get(c.date) ?? c.day?.endingBalance ?? null,
  })).filter((p): p is { date: string; bal: number } => p.bal != null);

  if (series.length < 2) return null;

  const values = series.map((p) => p.bal);
  const min = Math.min(...values, -2000);
  const max = Math.max(...values, 8000);
  const span = Math.max(max - min, 1);
  const w = 100;
  const h = 42;
  const axisTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    t,
    label: moneyShort(min + span * (1 - t)),
  }));

  const pts = series.map((p, i) => {
    const x = (i / Math.max(series.length - 1, 1)) * w;
    const y = ((max - p.bal) / span) * (h - 4) + 2;
    return { x, y, bal: p.bal, date: p.date };
  });

  const segments: { d: string; pos: boolean }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    segments.push({
      d: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
      pos: a.bal >= 0 && b.bal >= 0,
    });
  }

  const labels = pts.filter((p, i) => {
    if (i === 0 || i === pts.length - 1) return Math.abs(p.bal) > 200;
    const prev = pts[i - 1]!;
    const next = pts[i + 1]!;
    const peak = p.bal >= prev.bal && p.bal >= next.bal && p.bal - Math.min(prev.bal, next.bal) > 500;
    const valley = p.bal <= prev.bal && p.bal <= next.bal && Math.max(prev.bal, next.bal) - p.bal > 500;
    return peak || valley;
  });

  return (
    <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">Running cash flow</p>
          <p className="text-[11px] text-slate-500">Green = above zero · Red = dipped negative</p>
        </div>
        <p className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-100">
          You&apos;ve got this! 💪
        </p>
      </div>
      <div className="flex gap-2">
        <div className="flex h-36 w-9 flex-col justify-between py-1 text-right text-[9px] font-bold text-slate-400">
          {axisTicks.map((tick) => (
            <span key={tick.t}>{tick.label}</span>
          ))}
        </div>
        <div className="relative h-36 min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="h-full w-full overflow-visible"
            preserveAspectRatio="none"
            aria-hidden
          >
            <line
              x1={0}
              x2={w}
              y1={((max - 0) / span) * (h - 4) + 2}
              y2={((max - 0) / span) * (h - 4) + 2}
              stroke="#cbd5e1"
              strokeWidth={0.2}
              strokeDasharray="1.2 1.2"
              vectorEffect="non-scaling-stroke"
            />
            {segments.map((s, i) => (
              <path
                key={i}
                d={s.d}
                fill="none"
                stroke={s.pos ? "#12B76A" : "#F04438"}
                strokeWidth={1.25}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {pts.map((p) => (
              <circle
                key={p.date}
                cx={p.x}
                cy={p.y}
                r={1.05}
                fill={p.bal >= 0 ? "#12B76A" : "#F04438"}
                stroke="#fff"
                strokeWidth={0.4}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {labels.slice(0, 7).map((p) => (
            <span
              key={p.date}
              className={cn(
                "pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md bg-white px-1 py-0.5 text-[9px] font-black shadow-sm ring-1 ring-slate-200",
                p.bal < 0 ? "text-rose-600" : "text-slate-800"
              )}
              style={{ left: `${p.x}%`, top: `${(p.y / h) * 100}%` }}
            >
              {moneyShort(p.bal)}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#12B76A]" /> Income (Payday)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#F04438]" /> Bills / Commitments
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#9E77ED]" /> Taxes
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#0BA5EC]" /> Utilities
        </span>
      </div>
    </div>
  );
}

function RecurringStrip({ events }: { events: KashuRadarEvent[] }) {
  const cards = useMemo(() => {
    const map = new Map<string, { title: string; amount: number; sample: KashuRadarEvent }>();
    for (const ev of events) {
      if (isPayEvent(ev)) continue;
      if (eventTone(ev) === "life" && !/netflix|fitness|planet/i.test(ev.title)) continue;
      const key = ev.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
      const prev = map.get(key);
      if (!prev || ev.amount > prev.amount) {
        map.set(key, { title: ev.title, amount: ev.amount, sample: ev });
      }
    }
    return [...map.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [events]);

  if (!cards.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">Your recurring commitments</p>
          <p className="text-[11px] text-slate-500">Matched from statements · updates on each scan</p>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {cards.map((c) => (
          <div
            key={c.title}
            className="min-w-[9.5rem] shrink-0 rounded-2xl bg-white p-3 ring-1 ring-slate-200 shadow-sm"
          >
            <span
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full text-base",
                iconTone(c.sample)
              )}
            >
              {eventEmoji(c.sample)}
            </span>
            <p className="mt-2 truncate text-xs font-bold text-slate-900">{c.title}</p>
            <p className="text-sm font-black text-[#F04438]">{money(c.amount)}</p>
            <p className="text-[10px] font-medium text-slate-400">Monthly · auto-matched</p>
          </div>
        ))}
      </div>
    </div>
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
  const [showLifestyle, setShowLifestyle] = useState(false);
  const [historyEvents, setHistoryEvents] = useState<KashuRadarEvent[]>([]);

  const dayByDate = useMemo(() => {
    const map = new Map<string, KashuDayProjection>();
    for (const d of forecast.days) map.set(d.date, d);
    return map;
  }, [forecast.days]);

  const eventsByDate = useMemo(() => {
    const asOf = forecast.asOf.slice(0, 10);
    const map = new Map<string, KashuRadarEvent[]>();

    // Past days: statement history is source of truth for pay (exact Cox amounts).
    // Future days: forecast radar (one projected payday).
    for (const ev of forecast.radar) {
      if (ev.date < asOf && (ev.kind === "payday" || ev.kind === "income")) {
        continue;
      }
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }

    for (const ev of historyEvents) {
      if (ev.date >= asOf) continue;
      const list = map.get(ev.date) ?? [];
      // Drop any leftover synthetic payday on this past day
      const cleaned = list.filter((x) => x.kind !== "payday" && x.kind !== "income");
      const dup = cleaned.some(
        (x) =>
          x.id === ev.id ||
          (x.kind === ev.kind &&
            Math.abs(x.amount - ev.amount) < 0.02 &&
            x.title.toLowerCase().slice(0, 16) === ev.title.toLowerCase().slice(0, 16))
      );
      if (!dup) cleaned.push(ev);
      // One payroll chip per day max (keep largest — the real deposit)
      if (ev.kind === "payday") {
        const pays = cleaned.filter((x) => x.kind === "payday");
        if (pays.length > 1) {
          const best = pays.reduce((a, b) => (a.amount >= b.amount ? a : b));
          map.set(
            ev.date,
            cleaned.filter((x) => x.kind !== "payday" || x.id === best.id)
          );
          continue;
        }
      }
      map.set(ev.date, cleaned);
    }

    // Hard rule: never show two paydays on one day
    for (const [date, list] of map) {
      const pays = list.filter((x) => x.kind === "payday" || x.kind === "income");
      if (pays.length <= 1) continue;
      const best = pays.reduce((a, b) => (a.amount >= b.amount ? a : b));
      map.set(
        date,
        list.filter((x) => (x.kind !== "payday" && x.kind !== "income") || x.id === best.id)
      );
    }
    return map;
  }, [forecast.radar, forecast.asOf, historyEvents]);

  const todayYmd = toYmd(new Date());
  const forecastEnd = forecast.days[forecast.days.length - 1]?.date ?? forecast.asOf;

  // Load statement txs for the visible month so January… look filled
  useEffect(() => {
    const monthStart = toYmd(new Date(cursor.year, cursor.month, 1));
    const monthEnd = toYmd(new Date(cursor.year, cursor.month + 1, 0));
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/kashu/transactions?calendar=1&from=${monthStart}&to=${monthEnd}&limit=400`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { transactions?: HistoryTx[] };
        if (cancelled) return;
        const evs = (data.transactions ?? [])
          .map(historyToRadar)
          .filter((e): e is KashuRadarEvent => e != null);
        setHistoryEvents(evs);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cursor.year, cursor.month]);

  useEffect(() => {
    if (!onNeedHorizon) return;
    const monthEnd = new Date(cursor.year, cursor.month + 1, 0);
    if (toYmd(monthEnd) > forecastEnd && forecast.horizonDays < 90) {
      onNeedHorizon(90);
    }
  }, [cursor.year, cursor.month, forecastEnd, forecast.horizonDays, onNeedHorizon]);

  const filterEvents = (raw: KashuRadarEvent[]) =>
    showLifestyle
      ? raw
      : raw.filter((e) => eventTone(e) !== "life");

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
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <StatBubble
          label="Available now"
          value={money(headerStats.available)}
          hint="Safe to spend"
          tone="emerald"
        />
        <StatBubble
          label="Projected month end"
          value={
            headerStats.eomLeftover != null ? money(headerStats.eomLeftover) : "—"
          }
          hint="If nothing changes"
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
          hint={
            forecast.nextPayday
              ? `${forecast.nextPayday}${
                  forecast.radar.find(
                    (e) => e.kind === "payday" && e.date === forecast.nextPayday
                  )
                    ? ` · +${money(
                        forecast.radar.find(
                          (e) => e.kind === "payday" && e.date === forecast.nextPayday
                        )!.amount
                      )}`
                    : ""
                }`
              : "Set payday in Buffers"
          }
          tone="violet"
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
          tone="amber"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Cash calendar</h2>
          <p className="text-sm text-slate-500">
            Tap a day · <span className="font-semibold text-[#12B76A]">Green pay</span>
            {" · "}
            <span className="font-semibold text-[#F04438]">Red bills</span>
            {" · "}
            <span className="font-semibold text-[#F79009]">Orange lifestyle</span>
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-4">
          {view === "list" ? (
            <ListView
              cells={cells.filter((c) => c.inMonth)}
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
            />
          ) : (
            <>
              <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)]">
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
                <div className="relative">
                  <div className="relative z-[3] grid grid-cols-7">
                  {displayCells.map((cell) => {
                    const isSelected = cell.date === selectedDate;
                    const chips = cell.events.slice(0, view === "week" ? 6 : 4);
                    const extra = cell.events.length - chips.length;
                    return (
                      <button
                        key={cell.date}
                        type="button"
                        disabled={view === "month" && !cell.inMonth}
                        onClick={() => setSelectedDate(cell.date)}
                        className={cn(
                          "relative flex min-h-[7rem] flex-col gap-1 border-b border-r border-slate-100 p-1.5 text-left transition sm:min-h-[8.25rem] sm:p-2",
                          dayWash(cell),
                          (cell.inMonth || view === "week") && "hover:brightness-[0.98]",
                          isSelected &&
                            "z-[3] bg-white shadow-[inset_0_0_0_2px_#12B76A]",
                          cell.isToday && cell.inMonth && "font-semibold"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              "inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-[11px]",
                              cell.isToday && cell.inMonth
                                ? "bg-[#12B76A] text-white shadow-md shadow-emerald-600/30"
                                : "text-slate-700"
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
                                compact={view === "month" && chips.length > 3}
                              />
                            ))}
                            {extra > 0 ? (
                              <span className="text-[9px] font-semibold text-slate-500">
                                +{extra} more
                              </span>
                            ) : null}
                            {cell.isToday && cell.day ? (
                              <span className="mt-auto inline-flex items-center gap-1 rounded-full bg-sky-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
                                <Wallet className="h-2.5 w-2.5" />
                                Leftover {moneyShort(cell.day.availableAboveFloor)}
                              </span>
                            ) : cell.day ? (
                              <span
                                className={cn(
                                  "mt-auto text-[9px] font-semibold",
                                  cell.day.availableAboveFloor < 0
                                    ? "text-rose-600"
                                    : cell.day.status === "yellow"
                                      ? "text-amber-700"
                                      : "text-slate-500"
                                )}
                              >
                                {moneyShort(cell.day.availableAboveFloor)}
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
              </div>
              {view === "month" ? (
                <div className="space-y-4">
                  <RunningBalanceChart
                    cells={cells}
                    eventsByDate={eventsByDate}
                    asOf={forecast.asOf.slice(0, 10)}
                    liquid={forecast.days[0]?.startingBalance ?? forecast.safeToSpend}
                    safetyFloor={forecast.safetyFloor}
                  />
                  <RecurringStrip events={forecast.radar} />
                </div>
              ) : null}
            </>
          )}

          {selected && (selected.inMonth || view !== "month") ? (
            <div className="grid gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {parseYmd(selected.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                  {selected.isToday ? " · Today" : ""}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Cash flow
                </p>
                {selected.day ? (
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
                    <li className="mt-1 flex justify-between gap-2 border-t border-slate-100 pt-1.5">
                      <span className="font-semibold text-slate-800">Net</span>
                      <span className="font-bold text-slate-900">
                        {money(
                          selected.day.income -
                            selected.day.obligations -
                            selected.day.lifestyleBurn
                        )}
                      </span>
                    </li>
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No projection for this day yet.</p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Balance impact
                </p>
                {selected.day ? (
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Yesterday end</span>
                      <span className="font-semibold">
                        {prevDay ? money(prevDay.endingBalance) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Ends today</span>
                      <span className="font-semibold">
                        {money(selected.day.endingBalance)}
                      </span>
                    </div>
                    <div className="rounded-xl bg-sky-50 px-3 py-2 ring-1 ring-sky-100">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">
                        Leftover above floor
                      </p>
                      <p className="text-lg font-bold text-sky-900">
                        {money(selected.day.availableAboveFloor)}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 space-y-1.5">
                  {selected.events.slice(0, 5).map((ev) => (
                    <div key={ev.id} className="flex items-center gap-2">
                      <EventBubble ev={ev} />
                      <span className="truncate text-[11px] text-slate-500">{ev.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-3 text-white shadow-lg shadow-violet-700/20">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-100">
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

        <aside className="space-y-3">
          <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
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
                      <span
                        className={cn(
                          "shrink-0 text-xs font-bold",
                          tone === "pay" && "text-[#12B76A]",
                          tone === "life" && "text-[#F79009]",
                          tone === "bill" && "text-[#F04438]"
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
                <li className="text-sm text-slate-500">
                  No pay or bills in the next week — add commitments on Bills.
                </li>
              ) : null}
            </ul>
          </div>

          <div className="rounded-[1.35rem] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Safe to Spend
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-950">
              {money(forecast.safeToSpend)}
            </p>
            <p className="mt-1 text-xs text-emerald-900/75">{forecast.message}</p>
          </div>

          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#12B76A] px-2 py-1 font-semibold text-white">
              <Plus className="h-3 w-3" /> Pay
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F04438] px-2 py-1 font-semibold text-white">
              <Minus className="h-3 w-3" /> Bills
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F79009] px-2 py-1 font-semibold text-white">
              <Heart className="h-3 w-3" /> Lifestyle
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 font-semibold text-sky-800">
              Chart = leftover
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
  tone: "emerald" | "sky" | "rose" | "violet" | "amber";
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
        tone === "amber" && "border-amber-200 bg-gradient-to-br from-amber-50 to-white",
        className
      )}
    >
      <p
        className={cn(
          "text-[10px] font-bold uppercase tracking-wider",
          tone === "emerald" && "text-emerald-700",
          tone === "sky" && "text-sky-700",
          tone === "rose" && "text-rose-700",
          tone === "violet" && "text-violet-700",
          tone === "amber" && "text-amber-800"
        )}
      >
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold text-slate-900 sm:text-xl">{value}</p>
      <p className="text-[10px] text-slate-500">{hint}</p>
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
                "flex w-full flex-col gap-2 px-4 py-3 text-left hover:bg-violet-50/60 sm:flex-row sm:items-center",
                selectedDate === cell.date && "bg-violet-50"
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
                    Leftover {money(cell.day.availableAboveFloor)}
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
