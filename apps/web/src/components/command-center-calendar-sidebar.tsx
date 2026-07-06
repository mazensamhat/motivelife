"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, StickyNote } from "lucide-react";
import type {
  CommandCenterAgendaDay,
  CommandCenterTimelinePayload,
  LifeArea,
  WeeklyHeatMapDay,
} from "@forward/shared";
import { cn } from "@/lib/utils";

const AREA_DOT: Record<LifeArea, string> = {
  career: "bg-brand-blue",
  health: "bg-brand-green",
  money: "bg-amber-500",
  relationships: "bg-rose-400",
  learning: "bg-violet-500",
  home: "bg-forward-400",
  business: "bg-orange-500",
  mindset: "bg-brand-cyan",
};

function formatEventTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function MiniMonthCalendar({
  agenda,
  heatMap,
  selectedIso,
  onSelect,
}: {
  agenda: CommandCenterAgendaDay[];
  heatMap?: WeeklyHeatMapDay[];
  selectedIso: string;
  onSelect: (iso: string) => void;
}) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const eventDays = useMemo(() => new Set(agenda.filter((d) => d.events.length > 0).map((d) => d.dateIso)), [agenda]);
  const heatByDay = useMemo(() => new Map(heatMap?.map((d) => [d.dateIso, d.percent]) ?? []), [heatMap]);

  const first = new Date(viewYear, viewMonth, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthLabel = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function isoForDay(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    return d.toISOString().slice(0, 10);
  }

  const todayIso = today.toISOString().slice(0, 10);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (viewMonth === 0) {
              setViewMonth(11);
              setViewYear((y) => y - 1);
            } else setViewMonth((m) => m - 1);
          }}
          className="rounded-lg p-1 text-forward-400 hover:bg-forward-100"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-xs font-semibold uppercase tracking-wider text-forward-600">{monthLabel}</p>
        <button
          type="button"
          onClick={() => {
            if (viewMonth === 11) {
              setViewMonth(0);
              setViewYear((y) => y + 1);
            } else setViewMonth((m) => m + 1);
          }}
          className="rounded-lg p-1 text-forward-400 hover:bg-forward-100"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-forward-400">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day == null) return <span key={`pad-${i}`} />;
          const iso = isoForDay(day);
          const hasEvents = eventDays.has(iso);
          const load = heatByDay.get(iso);
          const isSelected = iso === selectedIso;
          const isToday = iso === todayIso;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              className={cn(
                "relative flex h-8 flex-col items-center justify-center rounded-lg text-xs tabular-nums transition",
                isSelected
                  ? "bg-brand-blue text-white"
                  : isToday
                    ? "bg-brand-cyan/15 font-semibold text-brand-blue"
                    : "text-forward-700 hover:bg-forward-100"
              )}
            >
              {day}
              {hasEvents ? (
                <span
                  className={cn(
                    "absolute bottom-0.5 h-1 w-1 rounded-full",
                    isSelected ? "bg-white" : load != null && load >= 72 ? "bg-amber-500" : "bg-brand-green"
                  )}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CommandCenterCalendarSidebar({
  data,
  className,
}: {
  data: CommandCenterTimelinePayload;
  className?: string;
}) {
  const agenda = data.calendarAgenda ?? [];
  const todayIso = new Date().toISOString().slice(0, 10);
  const [selectedIso, setSelectedIso] = useState(todayIso);

  const selectedDay =
    agenda.find((d) => d.dateIso === selectedIso) ??
    agenda.find((d) => d.isToday) ??
    agenda[0];

  return (
    <aside
      className={cn(
        "flex flex-col rounded-xl border border-forward-200 bg-forward-50/80",
        className
      )}
    >
      <div className="border-b border-forward-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <StickyNote size={16} className="text-brand-blue" />
          <p className="text-xs font-semibold uppercase tracking-widest text-forward-600">
            Calendar & notes
          </p>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {agenda.length > 0 ? (
          <MiniMonthCalendar
            agenda={agenda}
            heatMap={data.weeklyHeatMap}
            selectedIso={selectedIso}
            onSelect={setSelectedIso}
          />
        ) : (
          <p className="text-sm text-forward-500">
            Connect a calendar to see your schedule and AI prep notes here.
          </p>
        )}

        {data.weeklyHeatMap?.length ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-forward-400">
              Week load
            </p>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {data.weeklyHeatMap.map((day) => {
                const color =
                  day.percent >= 90 ? "bg-red-500" : day.percent >= 72 ? "bg-amber-500" : "bg-brand-green";
                return (
                  <button
                    key={day.dateIso}
                    type="button"
                    onClick={() => setSelectedIso(day.dateIso)}
                    className="text-center"
                  >
                    <div
                      className={cn(
                        "mx-auto h-6 w-full rounded-md opacity-90",
                        color,
                        day.dateIso === selectedIso && "ring-2 ring-brand-blue ring-offset-1",
                        day.isToday && day.dateIso !== selectedIso && "ring-1 ring-brand-cyan"
                      )}
                      title={`${day.dayLabel}: ${day.percent}%`}
                    />
                    <p className="mt-0.5 text-[9px] font-medium text-forward-500">{day.dayLabel}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {selectedDay ? (
          <div>
            <p className="text-xs font-semibold text-forward-800">{selectedDay.dayLabel}</p>
            {selectedDay.events.length === 0 ? (
              <p className="mt-2 text-sm text-forward-500">No events scheduled.</p>
            ) : (
              <ul className="mt-2 space-y-3">
                {selectedDay.events.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-lg border border-forward-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-start gap-2">
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", AREA_DOT[event.lifeArea])} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium tabular-nums text-forward-400">
                          {formatEventTime(event.startIso)}
                        </p>
                        <p className="font-medium text-forward-900">{event.title}</p>
                        {event.note ? (
                          <p className="mt-1.5 text-xs leading-relaxed text-forward-600">{event.note}</p>
                        ) : null}
                        {event.prepPercent != null ? (
                          <div className="mt-2">
                            <div className="flex justify-between text-[10px] text-forward-500">
                              <span>Prep</span>
                              <span className="font-semibold tabular-nums">{event.prepPercent}%</span>
                            </div>
                            <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-forward-100">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  event.prepPercent >= 80
                                    ? "bg-brand-green"
                                    : event.prepPercent >= 60
                                      ? "bg-brand-blue"
                                      : "bg-amber-500"
                                )}
                                style={{ width: `${event.prepPercent}%` }}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {data.tomorrowHighlight ? (
          <div className="rounded-lg border border-brand-blue/20 bg-brand-blue/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-blue">
              Tomorrow highlight
            </p>
            <p className="mt-1 text-sm font-medium text-forward-900">{data.tomorrowHighlight.title}</p>
            <p className="mt-1 text-xs text-forward-600">
              Preparation {data.tomorrowHighlight.prepPercent}%
            </p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
