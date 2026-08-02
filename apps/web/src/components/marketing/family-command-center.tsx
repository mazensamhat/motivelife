"use client";

import { FAMILY_FLOW_DEMO, FAMILY_NOW_DEMO } from "@/lib/family-marketing";

/** Dominant visual for MyMotiveFamily — live command center, not a tracker grid. */
export function FamilyCommandCenter() {
  return (
    <div className="family-command-stage relative isolate overflow-hidden rounded-none border-y border-white/10 bg-forward-950 sm:rounded-3xl sm:border">
      <div className="family-map-plane absolute inset-0" aria-hidden />
      <div className="family-map-grid absolute inset-0 opacity-40" aria-hidden />

      {/* Avatar pins */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <span className="family-pin family-pin-a">D</span>
        <span className="family-pin family-pin-b">M</span>
        <span className="family-pin family-pin-c">Mo</span>
        <span className="family-pin family-pin-d">Ma</span>
        <span className="family-route-pulse" />
      </div>

      <div className="relative z-10 grid gap-4 p-4 sm:gap-5 sm:p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
        <div className="family-intel-panel landing-fade-up space-y-4 rounded-2xl border border-white/10 bg-forward-950/75 p-5 backdrop-blur-md sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-cyan">
            {FAMILY_NOW_DEMO.title}
          </p>
          <ul className="space-y-3">
            {FAMILY_NOW_DEMO.members.map((m) => (
              <li key={m.name} className="flex items-start gap-3 text-sm text-forward-100">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white">
                  {m.name.slice(0, 1)}
                </span>
                <span>
                  <span className="font-semibold text-white">{m.name}</span>
                  <span className="text-forward-300"> — {m.status}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-white/10 pt-4 text-sm font-medium text-white">
            {FAMILY_NOW_DEMO.everyoneHome}
          </p>
          <p className="text-sm text-brand-yellow/95">{FAMILY_NOW_DEMO.alert}</p>
          <p className="text-sm text-brand-cyan/95">{FAMILY_NOW_DEMO.tip}</p>
        </div>

        <div className="family-intel-panel landing-fade-up landing-fade-up-delay-1 space-y-4 rounded-2xl border border-white/10 bg-forward-950/70 p-5 backdrop-blur-md sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-green">
            {FAMILY_FLOW_DEMO.title}
          </p>
          <p className="font-display text-xl font-semibold text-white sm:text-2xl">
            {FAMILY_FLOW_DEMO.everyone}
          </p>
          <ul className="space-y-2.5 text-sm text-forward-200">
            {FAMILY_FLOW_DEMO.legs.map((leg) => (
              <li key={leg.name}>
                <span className="font-semibold text-white">{leg.name}</span>{" "}
                <span className="text-forward-300">{leg.detail}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-xl border border-brand-orange/30 bg-brand-orange/10 p-3 text-sm text-forward-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-orange">
              Upcoming conflict
            </p>
            <p className="mt-1.5 leading-relaxed">{FAMILY_FLOW_DEMO.conflict}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
