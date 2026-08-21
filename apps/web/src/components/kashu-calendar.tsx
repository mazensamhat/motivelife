"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Filter, Shield } from "lucide-react";
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

function moneyExactChip(n: number) {
  if (n >= 1000) return moneyShort(n).replace(/[$-]/g, "");
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
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

function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
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

function isTaxEvent(ev: KashuRadarEvent) {
  return /tax|windsor|city/i.test(ev.title);
}

function isUtilityEvent(ev: KashuRadarEvent) {
  return /sandpiper|enwin|enbridge|bell|phone|hydro|gas|util|energy/i.test(ev.title);
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
  if (!cell.inMonth) return "bg-slate-50/40 text-slate-300";
  const hasPay = cell.events.some(isPayEvent);
  const hasBill = cell.events.some(isBillEvent);
  // Keep washes translucent so the week cash road stays visible on top
  if (hasPay && hasBill) return "bg-gradient-to-br from-emerald-50/70 via-white/50 to-rose-50/60";
  if (hasPay) return "bg-emerald-50/55";
  if (hasBill) return "bg-rose-50/55";
  if (cell.day?.status === "red") return "bg-rose-50/25";
  if (cell.day?.status === "yellow") return "bg-amber-50/25";
  return "bg-white/35";
}

function eventEmoji(ev: KashuRadarEvent): string {
  const t = ev.title.toLowerCase();
  if (isPayEvent(ev)) return "🥳";
  if (/mortgage|rbc|rent|housing|landlord/.test(t)) return "🏠";
  if (/aviva|insurance/.test(t)) return "🛡️";
  if (/lincoln|auto|car|afs|lease/.test(t)) return "🚗";
  if (/bell|phone|mobile|rogers|telus/.test(t)) return "📱";
  if (/enwin|enbridge|sandpiper|hydro|gas|util|energy|water/.test(t)) return "⚡";
  if (/netflix|disney|hulu|streaming/.test(t)) return "📺";
  if (/fitness|gym|planet/.test(t)) return "💪";
  if (/tax|windsor|city/.test(t)) return "🏛️";
  if (/grocery|food|uber eats|doordash/.test(t)) return "🍔";
  if (/coffee|starbucks|tim/.test(t)) return "☕";
  if (eventTone(ev) === "life") return "✨";
  if (ev.amount >= 500) return "😮";
  return "📌";
}

function iconTone(ev: KashuRadarEvent): string {
  const t = ev.title.toLowerCase();
  if (isPayEvent(ev)) return "bg-[#12B76A] text-white";
  if (/mortgage|rbc|rent/.test(t)) return "bg-[#F04438] text-white";
  if (/aviva|insurance/.test(t)) return "bg-[#F63D68] text-white";
  if (/lincoln|auto|car|afs/.test(t)) return "bg-[#2E90FA] text-white";
  if (/bell|phone/.test(t)) return "bg-[#2E90FA] text-white";
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
  delayMs = 0,
}: {
  ev: KashuRadarEvent;
  compact?: boolean;
  delayMs?: number;
}) {
  const tone = eventTone(ev);
  const sign = tone === "pay" ? "+" : "−";
  const emoji = eventEmoji(ev);
  const label =
    isPayEvent(ev) && /bonus/i.test(ev.title)
      ? "Payday"
      : isPayEvent(ev)
        ? "Payday"
        : shortTitle(ev.title, compact ? 7 : 12);
  return (
    <span
      title={`${tone === "pay" ? "+" : "−"}${money(ev.amount)} ${ev.title}`}
      style={{ animationDelay: `${delayMs}ms` }}
      className={cn(
        "kashu-event-bubble inline-flex max-w-full items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-tight text-white shadow-md sm:text-[10px]",
        tone === "pay" &&
          "bg-gradient-to-r from-[#34D399] to-[#059669] shadow-emerald-400/35 ring-1 ring-emerald-300/50",
        tone === "bill" &&
          "bg-gradient-to-r from-[#FB7185] to-[#E11D48] shadow-rose-400/35 ring-1 ring-rose-300/40",
        tone === "life" &&
          "bg-gradient-to-r from-[#FBBF24] to-[#F97316] shadow-orange-400/35 ring-1 ring-amber-300/40"
      )}
    >
      <span className="text-[11px]" aria-hidden>
        {emoji}
      </span>
      {!compact ? <span className="min-w-0 truncate">{label}</span> : null}
      <span className="shrink-0 opacity-95">
        {sign}
        {moneyExactChip(ev.amount)}
      </span>
    </span>
  );
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
  const d = `${tx.description || ""}`.toUpperCase();
  const credit =
    tx.direction === "credit" ||
    tx.classification === "income" ||
    tx.classification === "refund";
  if (!credit || tx.amount < 400) return false;
  // Never treat family / e-transfers as payroll (screenshot: "My Wife")
  if (
    /\b(E-?TRANSFER|INTERAC|WIFE|HUSBAND|SPOUSE|VENMO|PAYPAL|TRANSFER)\b/i.test(d)
  ) {
    return false;
  }
  if (
    /COX|PAYROLL|SALARY|DIRECT[\s-]?DEPOSIT|WAGE|\bMSP\b|EMPLOYER|PAYCHEQ|PAYCHEQUE|PAYCHECK|ADP|CERIDIAN|GUSTO|DEPOSIT FROM/i.test(
      d
    )
  ) {
    return true;
  }
  if (tx.classification === "income" && tx.amount >= 800) return true;
  if (tx.direction === "credit" && tx.amount >= 1500) return true;
  return false;
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
 * Resolve a balance for every cell in a week row (empty days included).
 */
function balanceForCell(
  cell: DayCell,
  byDate: Map<string, number>,
  ordered: Array<{ date: string; bal: number }>
): number | null {
  const hit = byDate.get(cell.date);
  if (hit != null) return hit;
  if (!ordered.length) return null;
  // Nearest known day by date
  let best = ordered[0]!;
  let bestDist = Math.abs(
    new Date(`${cell.date}T12:00:00Z`).getTime() - new Date(`${best.date}T12:00:00Z`).getTime()
  );
  for (const o of ordered) {
    const dist = Math.abs(
      new Date(`${cell.date}T12:00:00Z`).getTime() - new Date(`${o.date}T12:00:00Z`).getTime()
    );
    if (dist < bestDist) {
      best = o;
      bestDist = dist;
    }
  }
  return best.bal;
}

function roadTone(bal: number, floor: number): string {
  if (bal < floor) return "#E11D48";
  if (bal < floor + 800 || bal < 1500) return "#F59E0B";
  return "#12B76A";
}

/**
 * Continuous week roads ON TOP of the grid — one unbroken polyline per Sun→Sat row.
 * Empty days keep the line (interpolated balance). No dots, no glow blur.
 */
function WeekRoadOverlay({
  cells,
  rows,
  eventsByDate,
  asOf,
  liquid,
  safetyFloor,
  onSelectDate,
  onExplain,
}: {
  cells: DayCell[];
  rows: number;
  eventsByDate: Map<string, KashuRadarEvent[]>;
  asOf: string;
  liquid: number;
  safetyFloor: number;
  onSelectDate?: (ymd: string) => void;
  onExplain?: (msg: string) => void;
}) {
  const series = useMemo(
    () => buildBalanceSeries(cells, eventsByDate, asOf, liquid),
    [cells, eventsByDate, asOf, liquid]
  );
  if (series.length < 2 || rows < 1) return null;

  const byDate = new Map(series.map((s) => [s.cell.date, s.bal]));
  const ordered = series.map((s) => ({ date: s.cell.date, bal: s.bal }));
  const values = series.map((p) => p.bal);
  const min = Math.min(...values, -2000);
  const max = Math.max(...values, 8000);
  const span = Math.max(max - min, 1);
  const floor = Math.max(0, safetyFloor);

  const byRow = new Map<number, Array<{ x: number; y: number; bal: number; date: string }>>();
  for (let r = 0; r < rows; r++) {
    const weekCells = cells.filter((c) => c.row === r).sort((a, b) => a.col - b.col);
    if (weekCells.length < 2) continue;
    const pts: Array<{ x: number; y: number; bal: number; date: string }> = [];
    for (const cell of weekCells) {
      const bal = balanceForCell(cell, byDate, ordered);
      if (bal == null) continue;
      const cellTop = (r / rows) * 100;
      const cellH = 100 / rows;
      const norm = (bal - min) / span;
      const x = ((cell.col + 0.5) / 7) * 100;
      // Keep road in the lower band of the week so event bubbles stay readable
      const y = cellTop + cellH * (0.9 - norm * 0.18);
      pts.push({ x, y, bal, date: cell.date });
    }
    // Must span the full week — if we somehow missed a col, skip row
    if (pts.length >= 2) byRow.set(r, pts);
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {[...byRow.entries()].map(([row, pts]) => {
        const sorted = [...pts].sort((a, b) => a.x - b.x);
        // One continuous polyline for the week (no gaps on empty days)
        const poly = sorted
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`)
          .join(" ");
        return (
          <g key={`road-${row}`}>
            {/* Soft white understroke so the road reads over any cell wash */}
            <path
              d={poly}
              fill="none"
              stroke="#ffffff"
              strokeWidth={0.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.95}
            />
            {sorted.slice(0, -1).map((a, i) => {
              const b = sorted[i + 1]!;
              const d = `M ${a.x.toFixed(3)} ${a.y.toFixed(3)} L ${b.x.toFixed(3)} ${b.y.toFixed(3)}`;
              return (
                <g key={`${a.date}-${b.date}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke={roadTone((a.bal + b.bal) / 2, floor)}
                    strokeWidth={0.55}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    className="pointer-events-auto cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDate?.(b.date);
                      const tone =
                        b.bal < floor
                          ? "short"
                          : b.bal < floor + 800
                            ? "thin"
                            : "healthy";
                      onExplain?.(
                        `Week ${a.date.slice(5)} → ${b.date.slice(5)}: ${tone}. ${moneyShort(a.bal)} → ${moneyShort(b.bal)}.`
                      );
                    }}
                  />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function buildBalanceSeries(
  cells: DayCell[],
  eventsByDate: Map<string, KashuRadarEvent[]>,
  asOf: string,
  liquid: number
): Array<{ cell: DayCell; bal: number }> {
  const inMonth = cells.filter((c) => c.inMonth).sort((a, b) => a.date.localeCompare(b.date));
  if (inMonth.length < 2) return [];

  const balances = new Map<string, number>();
  for (const c of inMonth) {
    if (c.day) balances.set(c.date, c.day.endingBalance);
  }

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

  let last: number | null = null;
  const filled: Array<{ cell: DayCell; bal: number }> = [];
  for (const c of inMonth) {
    const fromMap = balances.get(c.date);
    const fromDay = c.day?.endingBalance;
    const bal: number | null = fromMap != null ? fromMap : fromDay != null ? fromDay : last;
    if (bal == null) continue;
    last = bal;
    balances.set(c.date, bal);
    filled.push({ cell: c, bal });
  }
  return filled;
}

/**
 * Crisp Running Balance chart under the calendar.
 * Line stays in SVG; axis + peak labels are HTML so Fold/cover screens stay readable
 * (SVG text shrinks with viewBox width — unreadable ~4px on a cover).
 */
function RunningBalanceChart({
  cells,
  eventsByDate,
  asOf,
  liquid,
  safetyFloor,
  onSelectDate,
  onExplain,
}: {
  cells: DayCell[];
  eventsByDate: Map<string, KashuRadarEvent[]>;
  asOf: string;
  liquid: number;
  safetyFloor: number;
  onSelectDate?: (ymd: string) => void;
  onExplain?: (msg: string) => void;
}) {
  const series = useMemo(
    () => buildBalanceSeries(cells, eventsByDate, asOf, liquid),
    [cells, eventsByDate, asOf, liquid]
  );
  if (series.length < 2) return null;

  const values = series.map((p) => p.bal);
  const min = Math.min(...values, -2000);
  const max = Math.max(...values, 8000);
  const span = Math.max(max - min, 1);
  const floor = Math.max(0, safetyFloor);

  // Plot-only viewBox — no SVG text (HTML overlays stay at real CSS px)
  const W = 640;
  const H = 180;
  const padL = 8;
  const padR = 8;
  const padT = 22;
  const padB = 10;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const pts = series.map((p, i) => {
    const x = padL + (i / Math.max(series.length - 1, 1)) * plotW;
    const y = padT + (1 - (p.bal - min) / span) * plotH;
    return { x, y, bal: p.bal, date: p.cell.date };
  });

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${pts[pts.length - 1]!.x.toFixed(1)} ${(H - padB).toFixed(1)} L ${pts[0]!.x.toFixed(1)} ${(H - padB).toFixed(1)} Z`;

  const rawLabels = pts.filter((p, i) => {
    if (i === 0 || i === pts.length - 1) return Math.abs(p.bal) > 400;
    const prev = pts[i - 1]!;
    const next = pts[i + 1]!;
    const peak =
      p.bal >= prev.bal && p.bal >= next.bal && p.bal - Math.min(prev.bal, next.bal) > 600;
    const valley =
      p.bal <= prev.bal && p.bal <= next.bal && Math.max(prev.bal, next.bal) - p.bal > 600;
    return peak || valley;
  });
  const labels: typeof rawLabels = [];
  for (const p of rawLabels) {
    if (labels.some((q) => Math.abs(q.x - p.x) < 56)) continue;
    labels.push(p);
    if (labels.length >= 4) break;
  }

  const yTicks = [max, (max + min) / 2, min].map((v) => ({
    yPct: ((padT + (1 - (v - min) / span) * plotH) / H) * 100,
    label: moneyShort(Math.round(v / 100) * 100),
  }));

  const xIdx = [0, Math.floor(pts.length / 2), pts.length - 1];
  const xLabels = [...new Set(xIdx)].map((i) => pts[i]!).filter(Boolean);

  return (
    <div className="kashu-running-balance border-t border-slate-100 bg-white px-2 pb-4 pt-3 sm:px-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
            Running balance
          </p>
          <p className="text-sm text-slate-600">
            Green healthy · amber thin · red short · tap the line
          </p>
        </div>
        <span className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700">
          <span className="inline-flex items-center gap-1">
            <i className="h-2.5 w-4 rounded-full bg-[#12B76A]" /> ok
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="h-2.5 w-4 rounded-full bg-[#F59E0B]" /> thin
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="h-2.5 w-4 rounded-full bg-[#E11D48]" /> short
          </span>
        </span>
      </div>

      <div className="flex gap-2">
        <div
          className="relative flex w-12 shrink-0 flex-col justify-between py-1 text-right sm:w-14"
          aria-hidden
        >
          {yTicks.map((t) => (
            <span
              key={t.label}
              className="text-[11px] font-bold leading-none text-slate-700 sm:text-xs"
              style={{ position: "absolute", right: 0, top: `${t.yPct}%`, transform: "translateY(-50%)" }}
            >
              {t.label}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <svg
            className="h-48 w-full sm:h-52"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Projected running balance"
          >
            <defs>
              <linearGradient id="kashuBalFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#12B76A" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#12B76A" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {yTicks.map((t) => (
              <line
                key={`grid-${t.label}`}
                x1={padL}
                x2={W - padR}
                y1={(t.yPct / 100) * H}
                y2={(t.yPct / 100) * H}
                stroke="#e2e8f0"
                strokeWidth={1}
              />
            ))}
            <path d={areaPath} fill="url(#kashuBalFill)" />
            <path
              d={linePath}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {pts.slice(0, -1).map((a, i) => {
              const b = pts[i + 1]!;
              const d = `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
              return (
                <g key={`seg-${a.date}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke={roadTone((a.bal + b.bal) / 2, floor)}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={18}
                    strokeLinecap="round"
                    className="cursor-pointer"
                    onClick={() => {
                      onSelectDate?.(b.date);
                      onExplain?.(
                        `${a.date.slice(5)} → ${b.date.slice(5)}: ${moneyShort(a.bal)} → ${moneyShort(b.bal)}.`
                      );
                    }}
                  />
                </g>
              );
            })}
          </svg>

          {/* HTML peak/valley chips — real CSS pixels on Fold cover */}
          {labels.map((p) => (
            <button
              key={`lbl-${p.date}`}
              type="button"
              className="absolute -translate-x-1/2 -translate-y-full rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-extrabold shadow-sm sm:text-xs"
              style={{
                left: `${(p.x / W) * 100}%`,
                top: `${(p.y / H) * 100}%`,
                color: roadTone(p.bal, floor),
              }}
              onClick={() => {
                onSelectDate?.(p.date);
                onExplain?.(`${p.date.slice(5)}: ${moneyShort(p.bal)}.`);
              }}
            >
              {moneyShort(p.bal)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-1 flex justify-between gap-2 pl-14 pr-1 sm:pl-16">
        {xLabels.map((p) => (
          <span key={`x-${p.date}`} className="text-[11px] font-bold text-slate-700 sm:text-xs">
            {parseYmd(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        ))}
      </div>
    </div>
  );
}

function CashFlowDonut({
  events,
  safetyFloor,
}: {
  events: KashuRadarEvent[];
  safetyFloor: number;
}) {
  const slices = useMemo(() => {
    let income = 0;
    let bills = 0;
    let taxes = 0;
    let utilities = 0;
    for (const ev of events) {
      if (isPayEvent(ev)) {
        income += ev.amount;
        continue;
      }
      if (isTaxEvent(ev)) {
        taxes += ev.amount;
        continue;
      }
      if (isUtilityEvent(ev)) {
        utilities += ev.amount;
        continue;
      }
      if (isBillEvent(ev) || eventTone(ev) === "life") {
        bills += ev.amount;
      }
    }
    const buffer = Math.max(0, safetyFloor);
    return [
      { key: "Income", value: income, color: "#12B76A" },
      { key: "Bills", value: bills, color: "#F04438" },
      { key: "Taxes", value: taxes, color: "#9E77ED" },
      { key: "Utilities", value: utilities, color: "#0BA5EC" },
      { key: "Buffer", value: buffer, color: "#2E90FA" },
    ].filter((s) => s.value > 0);
  }, [events, safetyFloor]);

  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = 36;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="rounded-[1.35rem] border border-slate-200/80 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold text-slate-800">Cash Flow This Month</p>
      <p className="text-[10px] text-slate-500">Income · Bills · Taxes · Utilities · Buffer</p>
      <div className="mt-3 flex items-center gap-3">
        <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" stroke="#F1F5F9" strokeWidth="14" />
          {slices.map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.key}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                transform="rotate(-90 50 50)"
              />
            );
            offset += len;
            return el;
          })}
          <circle cx="50" cy="50" r="22" fill="white" />
          <text
            x="50"
            y="48"
            textAnchor="middle"
            className="fill-slate-500"
            style={{ fontSize: 7, fontWeight: 600 }}
          >
            Month
          </text>
          <text
            x="50"
            y="58"
            textAnchor="middle"
            className="fill-slate-900"
            style={{ fontSize: 9, fontWeight: 800 }}
          >
            {moneyShort(total)}
          </text>
        </svg>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {slices.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.key}
              </span>
              <span className="font-bold text-slate-900">{moneyShort(s.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RecurringStrip({ events }: { events: KashuRadarEvent[] }) {
  const cards = useMemo(() => {
    const map = new Map<
      string,
      { title: string; amount: number; sample: KashuRadarEvent; dueDay: number }
    >();
    for (const ev of events) {
      if (isPayEvent(ev)) continue;
      if (eventTone(ev) === "life" && !/netflix|fitness|planet/i.test(ev.title)) continue;
      const key = ev.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
      const dueDay = parseYmd(ev.date).getDate();
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { title: ev.title, amount: ev.amount, sample: ev, dueDay });
      } else if (ev.amount > prev.amount) {
        map.set(key, { ...prev, amount: ev.amount, sample: ev });
      }
    }
    return [...map.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [events]);

  if (!cards.length) return null;

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-bold text-slate-900">Your Recurring Commitments</p>
        <p className="text-[11px] text-slate-500">Matched from statements · updates on each scan</p>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {cards.map((c) => (
          <div
            key={c.title}
            className="min-w-[9.75rem] shrink-0 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/90"
          >
            <span
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-full text-base",
                iconTone(c.sample)
              )}
            >
              {eventEmoji(c.sample)}
            </span>
            <p className="mt-2 truncate text-xs font-bold text-slate-900">{c.title}</p>
            <p className="text-sm font-black text-[#F04438]">{money(c.amount)}</p>
            <p className="text-[10px] font-medium text-slate-400">
              Monthly · Around {ordinal(c.dueDay)}
            </p>
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
  const [roadExplain, setRoadExplain] = useState<string | null>(null);

  const dayByDate = useMemo(() => {
    const map = new Map<string, KashuDayProjection>();
    for (const d of forecast.days) map.set(d.date, d);
    return map;
  }, [forecast.days]);

  const eventsByDate = useMemo(() => {
    const asOfYmd = forecast.asOf.slice(0, 10);
    const map = new Map<string, KashuRadarEvent[]>();

    // Include forecast events for ALL dates (including past paydays as fallback).
    // Statement history below replaces past paydays with exact deposit amounts.
    for (const ev of forecast.radar) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }

    for (const ev of historyEvents) {
      if (ev.date > asOfYmd) continue; // future stays on forecast projection
      const list = map.get(ev.date) ?? [];
      let cleaned = list;
      // Statement payroll replaces any synthetic payday on that day
      if (ev.kind === "payday" || ev.kind === "income") {
        cleaned = list.filter((x) => x.kind !== "payday" && x.kind !== "income");
      }
      const dup = cleaned.some(
        (x) =>
          x.id === ev.id ||
          (x.kind === ev.kind &&
            Math.abs(x.amount - ev.amount) < 0.02 &&
            x.title.toLowerCase().slice(0, 16) === ev.title.toLowerCase().slice(0, 16))
      );
      if (!dup) cleaned = [...cleaned, ev];
      // One payroll chip per day max (keep largest — the real deposit)
      if (ev.kind === "payday") {
        const pays = cleaned.filter((x) => x.kind === "payday" || x.kind === "income");
        if (pays.length > 1) {
          const best = pays.reduce((a, b) => (a.amount >= b.amount ? a : b));
          map.set(
            ev.date,
            cleaned.filter(
              (x) => (x.kind !== "payday" && x.kind !== "income") || x.id === best.id
            )
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

  const monthEvents = useMemo(() => {
    const start = toYmd(new Date(cursor.year, cursor.month, 1));
    const end = toYmd(new Date(cursor.year, cursor.month + 1, 0));
    const out: KashuRadarEvent[] = [];
    for (const [date, list] of eventsByDate) {
      if (date < start || date > end) continue;
      for (const ev of list) {
        if (!showLifestyle && eventTone(ev) === "life") continue;
        out.push(ev);
      }
    }
    return out;
  }, [eventsByDate, cursor.year, cursor.month, showLifestyle]);

  const headerStats = useMemo(() => {
    const inMonthDays = cells.filter((c) => c.inMonth && c.day);
    const eom = inMonthDays[inMonthDays.length - 1]?.day ?? null;
    const from = todayYmd;
    const to = addDaysYmd(todayYmd, 10);
    let upcoming = 0;
    let topBill: KashuRadarEvent | null = null;
    for (const ev of forecast.radar) {
      if (ev.date >= from && ev.date <= to && isBillEvent(ev)) {
        upcoming += ev.amount;
        if (!topBill || ev.amount > topBill.amount) topBill = ev;
      }
    }
    const nextPayEv = forecast.nextPayday
      ? forecast.radar.find((e) => e.kind === "payday" && e.date === forecast.nextPayday)
      : undefined;
    return {
      available: forecast.safeToSpend,
      eomLeftover: eom?.availableAboveFloor ?? monthEndFallback(cells),
      nextPayday: forecast.nextPayday,
      daysUntilPayday: forecast.daysUntilPayday,
      nextPayAmount: nextPayEv?.amount ?? null,
      upcoming10: upcoming,
      topBillName: topBill ? shortTitle(topBill.title, 18) : null,
      safetyFloor: forecast.safetyFloor,
    };
  }, [cells, forecast, todayYmd]);

  const next10 = useMemo(() => {
    const from = todayYmd;
    const to = addDaysYmd(todayYmd, 10);
    return forecast.radar
      .filter((ev) => ev.date >= from && ev.date <= to)
      .filter((ev) => showLifestyle || eventTone(ev) !== "life")
      .slice(0, 12);
  }, [forecast.radar, todayYmd, showLifestyle]);

  const kashuTake = useMemo(() => {
    const daysLeft =
      forecast.daysUntilPayday != null && forecast.daysUntilPayday > 0
        ? forecast.daysUntilPayday
        : 7;
    const cushion = selected?.day?.availableAboveFloor ?? forecast.safeToSpend;
    const daily = cushion > 0 ? Math.floor(cushion / Math.max(daysLeft, 1)) : 0;
    if (forecast.status === "red" || (selected?.day && selected.day.status === "red")) {
      return `Heads up — things look tight near your safety floor. Hold off on extras and ride to payday. You've still got a plan.`;
    }
    if (headerStats.topBillName && headerStats.upcoming10 > 0) {
      return `Next up: ${headerStats.topBillName} is in your upcoming commitments. Safe cushion around ${money(Math.max(daily, 0))}/day until payday — you've got this.`;
    }
    if (forecast.nextPayday) {
      return `You're in a good zone. About ${money(Math.max(daily, 0))}/day feels comfortable until ${parseYmd(forecast.nextPayday).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`;
    }
    return forecast.message || "Add bills and payday so Kashu can coach your month.";
  }, [forecast, selected, headerStats]);

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
  const nextPayHint = headerStats.nextPayday
    ? `${parseYmd(headerStats.nextPayday).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}${headerStats.nextPayAmount != null ? ` · +${money(headerStats.nextPayAmount)}` : ""}`
    : "Set payday in Buffers";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <StatBubble
          emoji="💸"
          label="Available Now"
          value={money(headerStats.available)}
          hint="Safe to spend"
          tone="emerald"
          delayMs={0}
        />
        <StatBubble
          emoji="🏁"
          label="Projected End of Month"
          value={headerStats.eomLeftover != null ? money(headerStats.eomLeftover) : "—"}
          hint="If nothing changes"
          tone="sky"
          delayMs={60}
        />
        <StatBubble
          emoji="🎉"
          label="Next Payday"
          value={
            headerStats.daysUntilPayday != null
              ? headerStats.daysUntilPayday === 0
                ? "Today"
                : `in ${headerStats.daysUntilPayday}d`
              : "—"
          }
          hint={nextPayHint}
          tone="violet"
          delayMs={120}
        />
        <StatBubble
          emoji="🧾"
          label="Upcoming Commitments"
          value={money(headerStats.upcoming10)}
          hint={headerStats.topBillName ? headerStats.topBillName : "Next 10 days"}
          tone="rose"
          delayMs={180}
        />
        <StatBubble
          emoji="🛡️"
          label="Safety Floor"
          value={money(headerStats.safetyFloor)}
          hint="Your minimum buffer"
          tone="sky"
          icon={<Shield className="h-3.5 w-3.5" />}
          className="col-span-2 lg:col-span-1"
          delayMs={240}
        />
      </div>

      <CashMapTimeline
        events={forecast.radar.filter((ev) => showLifestyle || eventTone(ev) !== "life")}
        monthDays={new Date(cursor.year, cursor.month + 1, 0).getDate()}
        year={cursor.year}
        monthIndex={cursor.month}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Cash calendar</h2>
          <p className="text-sm text-slate-500">
            Floating bubbles on the map · <span className="font-semibold text-emerald-600">pay</span>
            {" · "}
            <span className="font-semibold text-rose-500">bills</span>
            {" · "}
            <span className="font-semibold text-amber-600">lifestyle</span>
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
                    ? "bg-emerald-700 text-white"
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div className="min-w-0 space-y-4">
          {view === "list" ? (
            <ListView
              cells={cells.filter((c) => c.inMonth)}
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
            />
          ) : (
            <div className="overflow-hidden rounded-[1.35rem] border border-slate-200/90 bg-white shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)]">
              <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80">
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
                          "relative flex min-h-[7rem] flex-col gap-1 border-b border-r border-slate-100/90 p-1.5 text-left transition sm:min-h-[8.25rem] sm:p-2",
                          dayWash(cell),
                          (cell.inMonth || view === "week") && "hover:brightness-[0.98]",
                          isSelected && "z-[3] bg-white/95 shadow-[inset_0_0_0_2px_#12B76A]",
                          cell.isToday && cell.inMonth && "font-semibold"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              "inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-[11px]",
                              cell.isToday && cell.inMonth
                                ? "bg-[#12B76A] text-white shadow-md shadow-emerald-600/25"
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
                            {chips.map((ev, i) => (
                              <EventBubble
                                key={ev.id}
                                ev={ev}
                                compact={view === "month" && chips.length > 3}
                                delayMs={40 + i * 45}
                              />
                            ))}
                            {extra > 0 ? (
                              <span className="kashu-event-bubble inline-flex w-fit rounded-full bg-slate-800/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
                                +{extra}
                              </span>
                            ) : null}
                            {cell.day && view === "month" ? (
                              <span
                                className={cn(
                                  "mt-auto pt-0.5 text-[9px] font-semibold tabular-nums",
                                  cell.day.availableAboveFloor < 0
                                    ? "text-rose-600"
                                    : "text-slate-400"
                                )}
                              >
                                {moneyShort(cell.day.availableAboveFloor)}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {view === "month" ? (
                  <WeekRoadOverlay
                    cells={cells}
                    rows={rows}
                    eventsByDate={eventsByDate}
                    asOf={forecast.asOf.slice(0, 10)}
                    liquid={forecast.days[0]?.startingBalance ?? forecast.liquidBalance}
                    safetyFloor={forecast.safetyFloor}
                    onSelectDate={setSelectedDate}
                    onExplain={setRoadExplain}
                  />
                ) : null}
              </div>
              {view === "month" ? (
                <RunningBalanceChart
                  cells={cells}
                  eventsByDate={eventsByDate}
                  asOf={forecast.asOf.slice(0, 10)}
                  liquid={forecast.days[0]?.startingBalance ?? forecast.liquidBalance}
                  safetyFloor={forecast.safetyFloor}
                  onSelectDate={setSelectedDate}
                  onExplain={setRoadExplain}
                />
              ) : null}
            </div>
          )}

          {roadExplain ? (
            <div className="kashu-panel rounded-[1.35rem] border border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-white to-amber-50 p-3 text-sm text-slate-800 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Cash road
              </p>
              <p className="mt-1 font-medium">{roadExplain}</p>
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-emerald-800 underline"
                onClick={() => setRoadExplain(null)}
              >
                Dismiss
              </button>
            </div>
          ) : null}

          {view === "month" ? <RecurringStrip events={forecast.radar} /> : null}

          {selected && (selected.inMonth || view !== "month") ? (
            <div className="rounded-[1.35rem] border border-slate-200/90 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {parseYmd(selected.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
                {selected.isToday ? " · Today" : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selected.events.length ? (
                  selected.events.map((ev) => <EventBubble key={ev.id} ev={ev} />)
                ) : (
                  <span className="text-sm text-slate-400">Quiet day</span>
                )}
              </div>
              {selected.day ? (
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                  <span>
                    Income{" "}
                    <strong className="text-emerald-600">+{money(selected.day.income)}</strong>
                  </span>
                  <span>
                    Bills{" "}
                    <strong className="text-rose-600">−{money(selected.day.obligations)}</strong>
                  </span>
                  <span>
                    Leftover{" "}
                    <strong className="text-sky-700">
                      {money(selected.day.availableAboveFloor)}
                    </strong>
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="space-y-3">
          <div className="rounded-[1.35rem] border border-slate-200/90 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-800">Upcoming</p>
            <p className="text-[10px] font-medium text-slate-500">Next 10 Days</p>
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
                      <span
                        className={cn(
                          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px]",
                          iconTone(ev)
                        )}
                      >
                        {eventEmoji(ev)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-slate-800">
                          {isPayEvent(ev) ? "Payday" : shortTitle(ev.title, 16)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {parseYmd(ev.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
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
              {next10.length === 0 ? (
                <li className="text-sm text-slate-500">
                  No pay or bills in the next 10 days — add commitments on Bills.
                </li>
              ) : null}
            </ul>
          </div>

          <CashFlowDonut events={monthEvents} safetyFloor={forecast.safetyFloor} />

          <div className="rounded-[1.35rem] border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Kashu&apos;s Take
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{kashuTake}</p>
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
  icon,
  emoji,
  className,
  delayMs = 0,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "emerald" | "sky" | "rose" | "violet";
  icon?: ReactNode;
  emoji?: string;
  className?: string;
  delayMs?: number;
}) {
  return (
    <div
      style={{ animationDelay: `${delayMs}ms` }}
      className={cn(
        "kashu-stat-orb relative overflow-hidden rounded-[1.35rem] border px-3 py-3 shadow-md",
        tone === "emerald" &&
          "border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/80",
        tone === "sky" && "border-sky-200/90 bg-gradient-to-br from-sky-50 via-white to-sky-100/70",
        tone === "rose" &&
          "border-rose-200/90 bg-gradient-to-br from-rose-50 via-white to-rose-100/70",
        tone === "violet" &&
          "border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white to-violet-100/60",
        className
      )}
    >
      <span
        className="kashu-stat-orb__glow pointer-events-none absolute -right-3 -top-3 h-14 w-14 rounded-full opacity-40 blur-xl"
        aria-hidden
        style={{
          background:
            tone === "emerald"
              ? "#34D399"
              : tone === "rose"
                ? "#FB7185"
                : tone === "violet"
                  ? "#A78BFA"
                  : "#38BDF8",
        }}
      />
      <p
        className={cn(
          "relative inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider",
          tone === "emerald" && "text-emerald-700",
          tone === "sky" && "text-sky-700",
          tone === "rose" && "text-rose-700",
          tone === "violet" && "text-violet-700"
        )}
      >
        {emoji ? <span aria-hidden>{emoji}</span> : icon}
        {label}
      </p>
      <p className="relative mt-0.5 text-lg font-black tracking-tight text-slate-900 sm:text-xl">
        {value}
      </p>
      <p className="relative truncate text-[10px] text-slate-500">{hint}</p>
    </div>
  );
}

/** Horizontal cash-map: payday → buffer zone → rent/bills (readable on Fold cover). */
function CashMapTimeline({
  events,
  monthDays,
  year,
  monthIndex,
}: {
  events: KashuRadarEvent[];
  monthDays: number;
  year: number;
  monthIndex: number;
}) {
  const inMonth = events.filter((ev) => {
    const d = parseYmd(ev.date);
    return d.getFullYear() === year && d.getMonth() === monthIndex;
  });
  const paydays = inMonth
    .filter(isPayEvent)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  // Dedupe one payday chip per calendar day
  const paydayUnique: KashuRadarEvent[] = [];
  for (const p of paydays) {
    if (paydayUnique.some((x) => x.date === p.date)) continue;
    paydayUnique.push(p);
  }
  const payday = paydayUnique[0] ?? null;
  const bigBill =
    inMonth
      .filter(isBillEvent)
      .slice()
      .sort((a, b) => b.amount - a.amount)[0] ?? null;
  const billCluster = inMonth.filter(
    (ev) => isBillEvent(ev) && (!bigBill || ev.id !== bigBill.id)
  );

  const dayPct = (ymd: string) => {
    const day = parseYmd(ymd).getDate();
    return ((day - 0.5) / monthDays) * 100;
  };

  const payDay = payday ? parseYmd(payday.date).getDate() : null;
  const rentDay = bigBill ? parseYmd(bigBill.date).getDate() : null;
  const bufferEndDay =
    rentDay != null && payDay != null && rentDay > payDay
      ? rentDay
      : paydayUnique[1]
        ? parseYmd(paydayUnique[1].date).getDate()
        : payDay != null
          ? Math.min(monthDays, payDay + 10)
          : null;
  const bufferLeft =
    payDay != null ? ((payDay + 1 - 0.5) / monthDays) * 100 : 12;
  const bufferWidth =
    payDay != null && bufferEndDay != null && bufferEndDay > payDay + 2
      ? ((bufferEndDay - payDay - 2) / monthDays) * 100
      : 18;

  // Fewer, larger date marks — readable on ~360px cover screens
  const ticks = [1, 8, 15, 22, monthDays].filter(
    (d, i, arr) => d >= 1 && d <= monthDays && arr.indexOf(d) === i
  );

  const keyRows: Array<{ date: string; label: string; amount: number; tone: string }> = [];
  for (const p of paydayUnique.slice(0, 3)) {
    keyRows.push({
      date: p.date,
      label: "Payday",
      amount: p.amount,
      tone: "text-emerald-800 bg-emerald-50 border-emerald-200",
    });
  }
  if (bigBill) {
    keyRows.push({
      date: bigBill.date,
      label: shortTitle(bigBill.title, 18),
      amount: bigBill.amount,
      tone: "text-rose-800 bg-rose-50 border-rose-200",
    });
  }
  for (const ev of billCluster.slice(0, 2)) {
    keyRows.push({
      date: ev.date,
      label: shortTitle(ev.title, 16),
      amount: ev.amount,
      tone: "text-amber-900 bg-amber-50 border-amber-200",
    });
  }
  keyRows.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="kashu-cash-map overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
            Cash map
          </p>
          <p className="text-base font-semibold text-slate-900 sm:text-lg">
            See the timing. Use the buffer.
          </p>
          <p className="text-xs text-slate-600 sm:text-sm">
            Dates below stay readable on a small screen.
          </p>
        </div>
        <p className="text-xs font-semibold text-slate-600 sm:text-sm">
          {monthLabel(year, monthIndex)}
        </p>
      </div>

      <div className="relative mt-4 h-32 sm:h-36">
        {/* Date rail — HTML text at real CSS size */}
        <div className="absolute inset-x-0 top-0 h-7">
          {ticks.map((d) => (
            <span
              key={d}
              className="absolute text-xs font-extrabold tabular-nums text-slate-700 sm:text-sm"
              style={{
                left: `${((d - 0.5) / monthDays) * 100}%`,
                transform: "translateX(-50%)",
              }}
            >
              {d}
            </span>
          ))}
        </div>

        {payDay != null && bufferEndDay != null && bufferEndDay > payDay ? (
          <div
            className="kashu-buffer-zone absolute top-9 h-14 rounded-xl border border-dashed border-emerald-300/90 bg-emerald-100/50"
            style={{ left: `${bufferLeft}%`, width: `${Math.max(bufferWidth, 8)}%` }}
            title="Buffer zone — time to breathe between payday and the big bill"
          >
            <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-1 text-center text-[10px] font-bold uppercase tracking-wide text-emerald-900 sm:text-xs">
              Buffer
            </span>
          </div>
        ) : null}

        <div className="absolute inset-x-0 top-[5.25rem] h-1.5 rounded-full bg-slate-200" />

        {paydayUnique.map((p, i) => (
          <div
            key={p.id}
            className="kashu-map-pin absolute top-8 flex w-[4.25rem] -translate-x-1/2 flex-col items-center"
            style={{ left: `${dayPct(p.date)}%`, animationDelay: `${80 + i * 70}ms` }}
          >
            <span className="kashu-map-pin__orb inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#34D399] to-[#059669] text-base shadow-md ring-2 ring-white">
              🥳
            </span>
            <span className="mt-1 h-2.5 w-0.5 bg-emerald-500/70" />
            <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white sm:text-[11px]">
              {i === 0 ? "Pay" : "Pay"}
            </span>
          </div>
        ))}

        {bigBill ? (
          <div
            className="kashu-map-pin absolute top-8 flex w-[4.5rem] -translate-x-1/2 flex-col items-center"
            style={{ left: `${dayPct(bigBill.date)}%`, animationDelay: "160ms" }}
          >
            <span className="kashu-map-pin__orb inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#FB7185] to-[#E11D48] text-base shadow-md ring-2 ring-white">
              {eventEmoji(bigBill)}
            </span>
            <span className="mt-1 h-2.5 w-0.5 bg-rose-500/70" />
            <span className="max-w-[4.75rem] truncate rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white sm:text-[11px]">
              {shortTitle(bigBill.title, 8)}
            </span>
          </div>
        ) : null}

        {billCluster.slice(0, 2).map((ev, i) => (
          <div
            key={ev.id}
            className="kashu-map-pin absolute top-10 flex w-12 -translate-x-1/2 flex-col items-center"
            style={{ left: `${dayPct(ev.date)}%`, animationDelay: `${220 + i * 70}ms` }}
          >
            <span className="kashu-map-pin__orb inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#FBBF24] to-[#F97316] text-xs shadow-md ring-2 ring-white">
              {eventEmoji(ev)}
            </span>
          </div>
        ))}
      </div>

      {/* Explicit date list — always legible on Fold front screen */}
      {keyRows.length > 0 ? (
        <ul className="kashu-cash-map-legend mt-3 space-y-2 border-t border-slate-100 pt-3">
          {keyRows.map((row) => (
            <li
              key={`${row.date}-${row.label}`}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
                row.tone
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight">{row.label}</p>
                <p className="text-xs font-semibold opacity-80">
                  {parseYmd(row.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <p className="shrink-0 text-sm font-extrabold tabular-nums">
                {money(row.amount)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          No paydays or bills this month yet — add them on Bills.
        </p>
      )}
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
                "flex w-full flex-col gap-2 px-4 py-3 text-left hover:bg-emerald-50/50 sm:flex-row sm:items-center",
                selectedDate === cell.date && "bg-emerald-50/70"
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
