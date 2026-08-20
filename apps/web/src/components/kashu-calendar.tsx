"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import type { KashuDayProjection, KashuForecast, KashuRadarEvent } from "@forward/shared";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

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

function statusRing(status: string | undefined) {
  if (status === "red") return "ring-red-300 bg-red-50/80";
  if (status === "yellow") return "ring-amber-300 bg-amber-50/70";
  if (status === "green") return "ring-emerald-200 bg-emerald-50/50";
  return "ring-forward-100 bg-white";
}

function isPayEvent(ev: KashuRadarEvent) {
  return ev.kind === "payday" || ev.kind === "income";
}

function isBillEvent(ev: KashuRadarEvent) {
  return ev.kind === "obligation" || ev.kind === "collision";
}

type DayCell = {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  day: KashuDayProjection | null;
  events: KashuRadarEvent[];
};

export function KashuCalendar({
  forecast,
  onNeedHorizon,
}: {
  forecast: KashuForecast;
  /** Ask parent to load a longer forecast when the visible month needs it. */
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
    const endYmd = toYmd(monthEnd);
    if (endYmd > forecastEnd && forecast.horizonDays < 90) {
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
      out.push({
        date: ymd,
        inMonth: date.getMonth() === cursor.month,
        isToday: ymd === todayYmd,
        day: dayByDate.get(ymd) ?? null,
        events: eventsByDate.get(ymd) ?? [],
      });
    }
    return out;
  }, [cursor.year, cursor.month, dayByDate, eventsByDate, todayYmd]);

  const selected =
    cells.find((c) => c.date === selectedDate) ??
    cells.find((c) => c.date === todayYmd) ??
    null;

  const monthStats = useMemo(() => {
    let income = 0;
    let obligations = 0;
    let lastLeftover: number | null = null;
    for (const c of cells) {
      if (!c.inMonth || !c.day) continue;
      income += c.day.income;
      obligations += c.day.obligations;
      lastLeftover = c.day.availableAboveFloor;
    }
    return { income, obligations, lastLeftover };
  }, [cells]);

  const payEvents = (selected?.events ?? []).filter(isPayEvent);
  const billEvents = (selected?.events ?? []).filter(isBillEvent);
  const otherEvents = (selected?.events ?? []).filter(
    (e) => !isPayEvent(e) && !isBillEvent(e)
  );

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-forward-900">Cash calendar</h2>
          <p className="text-sm text-forward-500">
            Paydays in green. Bills in red. Leftover updates as the month plays out.
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-white p-1 ring-1 ring-forward-200">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-forward-600 hover:bg-forward-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="min-w-[9.5rem] text-center text-sm font-semibold text-forward-900">
            {monthLabel(cursor.year, cursor.month)}
          </p>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-forward-600 hover:bg-forward-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
            Pay in
          </p>
          <p className="mt-0.5 text-lg font-semibold text-emerald-800">
            +{money(monthStats.income)}
          </p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-700">
            Bills out
          </p>
          <p className="mt-0.5 text-lg font-semibold text-red-800">
            −{money(monthStats.obligations)}
          </p>
        </div>
        <div className="rounded-2xl border border-forward-200 bg-white px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-forward-500">
            Leftover
          </p>
          <p className="mt-0.5 text-lg font-semibold text-forward-900">
            {monthStats.lastLeftover != null ? money(monthStats.lastLeftover) : "—"}
          </p>
          <p className="text-[10px] text-forward-400">above safety floor</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-forward-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-forward-100 bg-forward-50/80">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-forward-500"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const pays = cell.events.filter(isPayEvent);
            const bills = cell.events.filter(isBillEvent);
            const selected = cell.date === selectedDate;
            const projected = Boolean(cell.day);
            return (
              <button
                key={cell.date}
                type="button"
                disabled={!cell.inMonth}
                onClick={() => setSelectedDate(cell.date)}
                className={cn(
                  "relative flex min-h-[4.5rem] flex-col items-stretch gap-0.5 border-b border-r border-forward-100 p-1.5 text-left transition sm:min-h-[5.25rem]",
                  !cell.inMonth && "bg-forward-50/40 text-forward-300",
                  cell.inMonth && statusRing(cell.day?.status),
                  cell.inMonth && "hover:brightness-[0.98]",
                  selected && cell.inMonth && "z-[1] ring-2 ring-emerald-600 ring-inset",
                  cell.isToday && cell.inMonth && "font-bold"
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                    cell.isToday && cell.inMonth
                      ? "bg-emerald-700 text-white"
                      : "text-forward-700"
                  )}
                >
                  {parseYmd(cell.date).getDate()}
                </span>

                {cell.inMonth ? (
                  <div className="mt-auto flex flex-wrap items-center gap-0.5">
                    {pays.slice(0, 2).map((ev) => (
                      <span
                        key={ev.id}
                        title={`+${money(ev.amount)} ${ev.title}`}
                        className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white shadow-sm shadow-emerald-500/30"
                      >
                        <Plus className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                    ))}
                    {bills.slice(0, 2).map((ev) => (
                      <span
                        key={ev.id}
                        title={`−${money(ev.amount)} ${ev.title}`}
                        className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm shadow-rose-500/30"
                      >
                        <Minus className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                    ))}
                    {pays.length + bills.length > 4 ? (
                      <span className="text-[9px] font-semibold text-forward-500">
                        +{pays.length + bills.length - 4}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {cell.inMonth && projected && cell.day ? (
                  <span
                    className={cn(
                      "mt-0.5 text-[9px] font-semibold leading-none",
                      cell.day.availableAboveFloor < 0
                        ? "text-red-600"
                        : cell.day.status === "yellow"
                          ? "text-amber-700"
                          : "text-forward-500"
                    )}
                  >
                    {moneyShort(cell.day.availableAboveFloor)}
                  </span>
                ) : cell.inMonth && !projected ? (
                  <span className="mt-0.5 text-[9px] text-forward-300">—</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-forward-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Plus className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
          Payday / income
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white">
            <Minus className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
          Bill / commitment
        </span>
        <span>Number under the day = leftover above your safety floor</span>
      </div>

      {selected && selected.inMonth ? (
        <div className="rounded-2xl border border-forward-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-forward-500">
                {parseYmd(selected.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              {selected.day ? (
                <p className="mt-1 text-sm text-forward-700">
                  Ends at{" "}
                  <span className="font-semibold">{money(selected.day.endingBalance)}</span>
                  {" · "}
                  leftover{" "}
                  <span className="font-semibold">
                    {money(selected.day.availableAboveFloor)}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-forward-500">
                  Outside the current forecast window — open Radar and extend the horizon, or
                  wait for Kashu to project this far.
                </p>
              )}
            </div>
            {selected.day ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
                  selected.day.status === "red"
                    ? "bg-red-100 text-red-700"
                    : selected.day.status === "yellow"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                )}
              >
                {selected.day.status}
              </span>
            ) : null}
          </div>

          <div className="mt-3 space-y-2">
            {payEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/25">
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-forward-900">{ev.title}</p>
                  <p className="text-[11px] text-forward-500 capitalize">{ev.kind}</p>
                </div>
                <p className="shrink-0 text-sm font-bold text-emerald-700">
                  +{money(ev.amount)}
                </p>
              </div>
            ))}
            {billEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2.5"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-md shadow-rose-500/25">
                  <Minus className="h-4 w-4" strokeWidth={2.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-forward-900">{ev.title}</p>
                  <p className="text-[11px] text-forward-500">
                    {ev.kind}
                    {ev.fundingPayday ? ` · funded by ${ev.fundingPayday}` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-rose-700">
                  −{money(ev.amount)}
                </p>
              </div>
            ))}
            {otherEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-3 rounded-xl border border-forward-200 bg-forward-50 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-forward-900">{ev.title}</p>
                  <p className="text-[11px] capitalize text-forward-500">{ev.kind}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-forward-700">
                  {money(ev.amount)}
                </p>
              </div>
            ))}
            {selected.events.length === 0 && selected.day ? (
              <p className="rounded-xl bg-forward-50 px-3 py-3 text-sm text-forward-500">
                Quiet day — no payday or bill due. Lifestyle burn may still move the balance.
                {selected.day.lifestyleBurn > 0
                  ? ` (~${money(selected.day.lifestyleBurn)} burn)`
                  : ""}
              </p>
            ) : null}
            {selected.events.length === 0 && !selected.day ? (
              <p className="text-sm text-forward-500">No projected events for this day yet.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
