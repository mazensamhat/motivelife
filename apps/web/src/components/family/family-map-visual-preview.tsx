"use client";

import { useEffect, useMemo, useState } from "react";

type Member = {
  id: string;
  name: string;
  short: string;
  relationship: string;
  status: string;
  place: string;
  duration: string;
  color: string;
  x: number;
  y: number;
  driving?: boolean;
  insight?: string | null;
};

const MEMBERS: Member[] = [
  {
    id: "mazen",
    name: "Mazen",
    short: "M",
    relationship: "You",
    status: "At Home",
    place: "Home",
    duration: "Now",
    color: "#6f42c1",
    x: 58,
    y: 56,
  },
  {
    id: "inaam",
    name: "Inaam",
    short: "I",
    relationship: "Wife",
    status: "Driving",
    place: "Tecumseh Rd",
    duration: "Now",
    color: "#12b886",
    x: 36,
    y: 44,
    driving: true,
  },
  {
    id: "zeinab",
    name: "Zeinab",
    short: "Z",
    relationship: "Daughter",
    status: "At Remington Park",
    place: "Remington Park",
    duration: "55 min",
    color: "#228be6",
    x: 74,
    y: 30,
    insight: "Zeinab has been at Remington Park longer than usual.",
  },
  {
    id: "hamoudi",
    name: "Hamoudi",
    short: "H",
    relationship: "Son",
    status: "At Mic Mac Park",
    place: "Mic Mac Park",
    duration: "2h 11m",
    color: "#1c7ed6",
    x: 20,
    y: 64,
  },
  {
    id: "mahdi",
    name: "Mahdi",
    short: "Mh",
    relationship: "Son",
    status: "At Home",
    place: "Home",
    duration: "Now",
    color: "#37b24d",
    x: 54,
    y: 62,
  },
];

/**
 * Cleaner map-first mock matching founder ChatGPT comps:
 * top chrome + pills, map people, bottom sheet (person → intel → carousel → nav).
 * Preview only — no side panel.
 */
export function FamilyMapVisualPreview() {
  const [selectedId, setSelectedId] = useState("zeinab");
  const [filter, setFilter] = useState<"all" | "traffic" | "places">("all");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 40);
    return () => window.clearTimeout(t);
  }, []);

  const selected = useMemo(
    () => MEMBERS.find((m) => m.id === selectedId) ?? MEMBERS[2]!,
    [selectedId]
  );

  return (
    <div className="min-h-dvh bg-[#edf1f6] text-forward-900">
      <div
        className={`mx-auto flex min-h-dvh max-w-[430px] flex-col bg-[#f4f6fa] shadow-[0_0_40px_rgba(10,25,48,0.12)] transition duration-500 sm:my-0 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="bg-amber-50 px-3 py-1.5 text-center text-[10px] font-medium text-amber-900">
          Preview mock · not production · details stay at the bottom
        </div>

        {/* App top bar */}
        <header className="flex items-center justify-between bg-white px-4 py-3">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-forward-700"
            aria-label="Menu"
          >
            <span className="text-lg leading-none">☰</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1 rounded-full bg-forward-50 px-3 py-1.5 text-sm font-semibold text-forward-900"
          >
            MyMotiveFamily
            <span className="text-[10px] text-forward-400">▾</span>
          </button>
          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-forward-50 text-forward-700"
            aria-label="Notifications"
          >
            🔔
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white">
              3
            </span>
          </button>
        </header>

        {/* Filter pills */}
        <div className="flex gap-2 bg-white px-4 pb-3">
          {(
            [
              ["all", "All family"],
              ["traffic", "Traffic"],
              ["places", "Places"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                filter === id
                  ? "bg-[#1b2a4a] text-white"
                  : "bg-forward-50 text-forward-600 ring-1 ring-forward-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Map */}
        <div className="relative min-h-[42vh] flex-1 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(165deg, #d7e3c8 0%, #e5ebdf 28%, #e8eef5 55%, #dce6f0 100%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(rgba(40,60,40,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(40,60,40,0.08) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div className="absolute left-0 right-0 top-[40%] h-[3px] bg-white/75" />
          <div className="absolute left-0 right-0 top-[63%] h-[2px] bg-white/55" />
          <div className="absolute bottom-0 left-[30%] top-0 w-[3px] bg-white/70" />
          <div className="absolute bottom-0 left-[70%] top-0 w-[2px] bg-white/50" />

          <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-2xl bg-white/95 px-2.5 py-1.5 text-xs shadow-md">
            <span aria-hidden>⛅</span>
            <span className="font-semibold">22°</span>
            <span className="text-forward-500">Partly cloudy</span>
          </div>

          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <path
              d="M 18 72 C 24 58, 30 50, 36 44"
              fill="none"
              stroke="#12b886"
              strokeWidth="0.65"
              strokeDasharray="1.6 1.3"
              opacity="0.9"
            />
          </svg>

          {MEMBERS.map((m) => {
            const active = m.id === selectedId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(m.id)}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${m.x}%`, top: `${m.y}%` }}
              >
                <span
                  className={`absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 ${
                    active ? "h-[4.5rem] w-[4.5rem]" : "h-14 w-14"
                  }`}
                  style={{ background: m.color }}
                />
                <span
                  className={`mx-auto flex items-center justify-center rounded-full font-bold text-white shadow-lg ring-[3px] ring-white transition ${
                    active ? "h-11 w-11 text-sm" : "h-9 w-9 text-xs"
                  }`}
                  style={{ background: m.color }}
                >
                  {m.short}
                </span>
                <span className="mt-1.5 block w-max max-w-[8.5rem] -translate-x-[20%] rounded-xl bg-white px-2 py-1 text-left text-[10px] leading-snug shadow-md">
                  <span className="font-semibold text-forward-900">{m.name}</span>
                  <span className="block text-forward-600">
                    {m.status}
                    <span className="text-forward-400"> · {m.duration}</span>
                  </span>
                </span>
              </button>
            );
          })}

          <div className="absolute bottom-4 right-3 z-20 flex flex-col gap-2">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-forward-600 shadow-md"
              aria-label="Compass"
            >
              ◎
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700 shadow-md"
              aria-label="Re-center"
            >
              ➤
            </button>
          </div>
        </div>

        {/* Bottom sheet */}
        <section className="relative z-30 -mt-4 rounded-t-[1.75rem] bg-white px-4 pb-2 pt-2 shadow-[0_-12px_40px_-16px_rgba(10,25,48,0.28)]">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-forward-200" />

          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-semibold tracking-tight text-forward-950">
                  {selected.name} Samhat
                </h2>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: selected.driving ? "#12b886" : selected.color }}
                />
              </div>
              <p className="mt-0.5 text-sm text-forward-500">
                {selected.status}
                <span className="text-forward-300"> · </span>
                {selected.duration}
              </p>
            </div>
            <div className="flex gap-2">
              {[
                { label: "Chat", icon: "💬" },
                { label: "Call", icon: "📞" },
                { label: "Go", icon: "➤" },
              ].map((a) => (
                <button
                  key={a.label}
                  type="button"
                  title={a.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-sm shadow-sm ring-1 ring-violet-100"
                >
                  {a.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Family Intelligence insight */}
          <div className="mt-3 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 px-3.5 py-3 ring-1 ring-violet-100/80">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-700">
              <span aria-hidden>✦</span>
              Family Intelligence
            </div>
            <p className="mt-1.5 text-sm leading-snug text-forward-800">
              {selected.insight ??
                (selected.driving
                  ? `${selected.name} is on the move — live speed on the map.`
                  : `${selected.name} looks settled at ${selected.place}.`)}
            </p>
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-violet-700"
            >
              View insight →
            </button>
          </div>

          {/* Family carousel */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {MEMBERS.map((m) => {
              const active = m.id === selectedId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={`relative min-w-[6.6rem] shrink-0 rounded-2xl px-2.5 py-2.5 text-left transition ${
                    active
                      ? "bg-sky-50 ring-2 ring-sky-400"
                      : "bg-forward-50 ring-1 ring-forward-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ background: m.color }}
                    >
                      {m.short}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-forward-900">
                        {m.name}
                      </p>
                      <p className="truncate text-[10px] text-forward-500">
                        {m.driving ? "Driving" : m.place}
                      </p>
                    </div>
                  </div>
                  <p className="mt-1 text-[10px] text-forward-400">{m.duration}</p>
                  {active ? (
                    <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-sky-500" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        {/* Bottom nav */}
        <nav className="grid grid-cols-5 border-t border-forward-100 bg-white px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 text-[10px] font-semibold text-forward-400">
          {(
            [
              ["Map", "🗺", true],
              ["Driving", "🚗", false],
              ["Inbox", "✉️", false],
              ["Places", "📍", false],
              ["More", "···", false],
            ] as const
          ).map(([label, icon, active]) => (
            <button
              key={label}
              type="button"
              className={`flex flex-col items-center gap-0.5 py-1 ${
                active ? "text-violet-700" : ""
              }`}
            >
              <span className="relative text-base leading-none">
                {icon}
                {label === "Inbox" ? (
                  <span className="absolute -right-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-violet-600 px-0.5 text-[8px] text-white">
                    3
                  </span>
                ) : null}
              </span>
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
