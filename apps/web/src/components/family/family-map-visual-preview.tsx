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
  x: number; // % on mock map
  y: number;
  driving?: boolean;
  photo?: boolean;
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
    color: "#7c5cff",
    x: 62,
    y: 58,
    photo: false,
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
    x: 34,
    y: 42,
    driving: true,
    photo: true,
  },
  {
    id: "zeinab",
    name: "Zeinab",
    short: "Z",
    relationship: "Daughter",
    status: "At Remington Park",
    place: "Remington Park",
    duration: "55 min",
    color: "#1c7ed6",
    x: 72,
    y: 28,
    photo: false,
  },
  {
    id: "hamoudi",
    name: "Hamoudi",
    short: "H",
    relationship: "Son",
    status: "At Mic Mac Park",
    place: "Mic Mac Park",
    duration: "2h 11m",
    color: "#228be6",
    x: 22,
    y: 62,
    photo: false,
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
    x: 58,
    y: 64,
    photo: true,
  },
];

/**
 * High-fidelity visual mock inspired by founder ChatGPT comps:
 * map-first, people strip + details on the BOTTOM only (no side panel).
 * Preview-only — not wired to live family data.
 */
export function FamilyMapVisualPreview() {
  const [selectedId, setSelectedId] = useState("zeinab");
  const [sheetOpen, setSheetOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const [alertOn, setAlertOn] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 50);
    return () => window.clearTimeout(t);
  }, []);

  const selected = useMemo(
    () => MEMBERS.find((m) => m.id === selectedId) ?? MEMBERS[2]!,
    [selectedId]
  );

  function selectMember(id: string) {
    setSelectedId(id);
    setSheetOpen(true);
  }

  return (
    <div className="min-h-dvh bg-[#e8eef5] text-forward-900">
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col sm:max-w-xl">
        {/* Preview banner — not live product */}
        <div
          className={`z-30 border-b border-amber-200/80 bg-amber-50 px-4 py-2 text-center text-[11px] font-medium text-amber-900 transition ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        >
          Preview mock only · not deployed to your Family Map · details stay at the{" "}
          <strong>bottom</strong>
        </div>

        {/* Phone-ish map stage */}
        <div
          className={`relative flex min-h-0 flex-1 flex-col transition duration-700 ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="relative min-h-[70vh] flex-1 overflow-hidden bg-[#d5e0ec] sm:min-h-[75vh]">
            {/* Fake streets */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(160deg, #cfdceb 0%, #d9e4f0 40%, #e4ebf3 100%)",
              }}
            />
            <div
              className="absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(26,45,74,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(26,45,74,0.07) 1px, transparent 1px)",
                backgroundSize: "36px 36px",
              }}
            />
            {/* Arterials */}
            <div className="absolute left-0 right-0 top-[38%] h-[3px] bg-white/70" />
            <div className="absolute left-0 right-0 top-[62%] h-[2px] bg-white/55" />
            <div className="absolute bottom-0 left-[28%] top-0 w-[3px] bg-white/65" />
            <div className="absolute bottom-0 left-[68%] top-0 w-[2px] bg-white/50" />
            <p className="absolute left-[30%] top-[34%] text-[10px] font-semibold tracking-wide text-forward-500/80">
              TECUMSEH RD E
            </p>
            <p className="absolute left-[8%] top-[58%] rotate-[-90deg] text-[10px] font-semibold text-forward-500/70">
              HOWARD AVE
            </p>
            <p className="absolute bottom-[22%] right-[10%] rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-medium text-forward-600">
              Costco
            </p>
            <p className="absolute left-[12%] top-[22%] rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-medium text-forward-600">
              Mic Mac Park
            </p>
            <p className="absolute right-[8%] top-[18%] rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-medium text-forward-600">
              Remington Park
            </p>

            {/* Weather */}
            <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1.5 text-xs shadow-sm backdrop-blur">
              <span aria-hidden>⛅</span>
              <span className="font-semibold">22°</span>
              <span className="text-forward-500">Partly cloudy</span>
            </div>

            {/* Map tools */}
            <div className="absolute right-3 top-3 z-20 flex flex-col gap-2">
              {["Traffic", "Layers", "Expand"].map((label) => (
                <button
                  key={label}
                  type="button"
                  className="rounded-full bg-white/90 px-3 py-2 text-[11px] font-semibold text-forward-700 shadow-sm backdrop-blur"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Header chip */}
            <div className="absolute left-1/2 top-14 z-20 w-[min(92%,20rem)] -translate-x-1/2 rounded-2xl bg-white/92 px-3 py-2 text-center shadow-md backdrop-blur">
              <p className="font-display text-sm font-semibold text-forward-950">
                Family Map
              </p>
              <p className="text-[11px] text-forward-500">
                Live location · Updated now
              </p>
            </div>

            {/* Driving trail for Inaam */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path
                d="M 18 70 C 22 58, 28 48, 34 42"
                fill="none"
                stroke="#12b886"
                strokeWidth="0.7"
                strokeDasharray="1.8 1.4"
                opacity="0.85"
              />
            </svg>

            {/* Member markers */}
            {MEMBERS.map((m) => {
              const active = m.id === selectedId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectMember(m.id)}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 text-left"
                  style={{ left: `${m.x}%`, top: `${m.y}%` }}
                >
                  {/* accuracy / glow rings */}
                  <span
                    className="absolute left-1/2 top-1/2 -z-10 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30"
                    style={{ background: m.color }}
                  />
                  <span
                    className={`absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 ${
                      active ? "h-24 w-24" : "h-20 w-20"
                    }`}
                    style={{ background: m.color }}
                  />
                  <span
                    className={`flex items-center justify-center rounded-full text-xs font-bold text-white shadow-lg ring-2 ring-white transition ${
                      active ? "h-12 w-12 scale-110" : "h-10 w-10"
                    }`}
                    style={{ background: m.color }}
                  >
                    {m.photo ? (
                      <span className="text-[10px] opacity-90">●</span>
                    ) : (
                      m.short
                    )}
                  </span>
                  <span className="absolute left-1/2 top-[118%] z-20 w-max max-w-[9.5rem] -translate-x-1/2 rounded-lg bg-white px-2 py-1 text-[10px] leading-snug shadow-md">
                    <span className="font-semibold text-forward-900">{m.name}</span>
                    <span className="block text-forward-600">
                      {m.status}
                      {m.duration !== "Now" ? `, ${m.duration}` : ", Now"}
                    </span>
                  </span>
                </button>
              );
            })}

            {/* Re-center */}
            <button
              type="button"
              className="absolute bottom-[7.5rem] left-3 z-20 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold text-sky-700 shadow-md"
            >
              ⌖ Re-center
            </button>
          </div>

          {/* BOTTOM family strip — people first */}
          <div className="relative z-30 -mt-3 rounded-t-3xl bg-white px-3 pb-2 pt-3 shadow-[0_-8px_30px_-12px_rgba(10,25,48,0.25)]">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forward-400">
                Family
              </p>
              <button
                type="button"
                className="text-[11px] font-semibold text-violet-600"
              >
                + Add place
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {MEMBERS.map((m) => {
                const active = m.id === selectedId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectMember(m.id)}
                    className={`min-w-[7.2rem] shrink-0 rounded-2xl px-2.5 py-2 text-left transition ${
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
                          <span
                            className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                            style={{ background: m.color }}
                          />
                          {m.driving ? "Driving" : m.duration}
                        </p>
                      </div>
                    </div>
                    <p className="mt-1 truncate text-[10px] text-forward-600">
                      {m.place}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* BOTTOM detail sheet — never a side panel */}
          {sheetOpen ? (
            <div className="relative z-40 border-t border-forward-100 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_40px_-20px_rgba(10,25,48,0.35)]">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-forward-200" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white shadow"
                    style={{ background: selected.color }}
                  >
                    {selected.short}
                  </span>
                  <div>
                    <p className="font-display text-lg font-semibold leading-tight text-forward-950">
                      {selected.name} Samhat
                    </p>
                    <p className="text-xs text-forward-500">
                      {selected.relationship} · {selected.status}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="rounded-full bg-forward-50 px-2.5 py-1 text-xs font-semibold text-forward-600"
                >
                  Close
                </button>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {["Message", "Call", "Navigate"].map((a) => (
                  <button
                    key={a}
                    type="button"
                    className="rounded-xl bg-forward-900 py-2.5 text-xs font-semibold text-white"
                  >
                    {a}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl bg-forward-50 px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-forward-900">
                    Place alert
                  </p>
                  <p className="text-[11px] text-forward-500">
                    Notify me if {selected.name} leaves {selected.place}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={alertOn}
                  onClick={() => setAlertOn((v) => !v)}
                  className={`relative h-6 w-11 rounded-full transition ${
                    alertOn ? "bg-sky-500" : "bg-forward-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                      alertOn ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-forward-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-forward-400">
                    Recent
                  </p>
                  <p className="mt-1 text-xs leading-snug text-forward-800">
                    Cabana Rd E
                    <span className="block text-forward-500">8:10 – 8:35</span>
                  </p>
                </div>
                <div className="rounded-xl bg-forward-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-forward-400">
                    Drive today
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold text-forward-950">
                    97
                  </p>
                  <p className="text-[11px] text-forward-500">
                    1 hard brake · Good
                  </p>
                </div>
              </div>

              <p className="mt-3 text-center text-[10px] text-forward-400">
                Intelligence lives here under the map — not in a side panel
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="relative z-40 w-full border-t border-forward-100 bg-white py-3 text-center text-xs font-semibold text-sky-700"
            >
              Show {selected.name}’s details
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
