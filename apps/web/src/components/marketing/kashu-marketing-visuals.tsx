"use client";

import { KASHU_DEMO, KASHU_FORMULA } from "@/lib/kashu-marketing";
import { PRODUCT_SUITE } from "@/lib/product-suite";
import { cn } from "@/lib/utils";

const brand = PRODUCT_SUITE.kashu;

function money(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/** Full-bleed Safe to Spend hero visual for /cash-flow */
export function KashuSafeToSpendHeroVisual() {
  return (
    <div
      className="relative overflow-hidden rounded-none border-y border-emerald-400/20 sm:rounded-3xl sm:border"
      style={{
        background:
          "radial-gradient(ellipse at 20% 0%, rgba(16,185,129,0.28), transparent 55%), radial-gradient(ellipse at 90% 80%, rgba(15,118,110,0.35), transparent 50%), #04140f",
      }}
    >
      <div className="relative px-5 py-10 sm:px-10 sm:py-14">
        <p
          className="text-xs font-semibold uppercase tracking-[0.22em]"
          style={{ color: brand.primaryLight }}
        >
          {KASHU_FORMULA.eyebrow}
        </p>
        <p className="mt-3 font-display text-6xl font-semibold tracking-tight text-white sm:text-7xl">
          {money(KASHU_DEMO.safeToSpend)}
        </p>
        <p className="mt-2 text-sm font-medium text-emerald-100/90">Safe to Spend</p>
        <p className="mt-4 max-w-xl text-sm text-emerald-50/75 sm:text-base">{KASHU_DEMO.message}</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Balance", value: money(KASHU_DEMO.balance) },
            { label: "Reserved", value: money(KASHU_DEMO.reserved) },
            { label: "Safety floor", value: money(KASHU_DEMO.floor) },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/70">
                {item.label}
              </p>
              <p className="mt-1 text-xl font-semibold text-white">{item.value}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 font-mono text-xs text-emerald-200/60 sm:text-sm">
          {KASHU_FORMULA.equation} = SAFE TO SPEND
        </p>
      </div>
    </div>
  );
}

/** Compact radar strip for homepage teaser */
export function KashuRadarMiniVisual({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-emerald-200/40 bg-gradient-to-br from-emerald-950 via-teal-950 to-forward-950 p-5 text-white shadow-xl",
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
        Cash-Flow Radar
      </p>
      <p className="mt-2 font-display text-3xl font-semibold">{money(KASHU_DEMO.safeToSpend)}</p>
      <p className="text-sm text-emerald-100/70">Safe to Spend · demo</p>
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {KASHU_DEMO.radar.map((ev) => (
          <div
            key={`${ev.date}-${ev.title}`}
            className={cn(
              "w-28 shrink-0 rounded-2xl border p-3",
              ev.status === "yellow"
                ? "border-amber-300/40 bg-amber-400/15"
                : "border-emerald-300/30 bg-emerald-400/10"
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-100/60">
              {ev.date}
            </p>
            <p className="mt-1 truncate text-sm font-semibold">{ev.title}</p>
            <p className="mt-1 text-base font-semibold">
              {ev.amount > 0 ? "+" : ""}
              {money(ev.amount)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KashuPillarsVisual() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[
        { title: "Protect", tone: "Obligations reserved" },
        { title: "See ahead", tone: "Payday → 30 days" },
        { title: "Spend", tone: "Safe envelope only" },
      ].map((item) => (
        <div
          key={item.title}
          className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-5 text-center"
        >
          <p className="font-display text-xl font-semibold text-white">{item.title}</p>
          <p className="mt-1 text-sm text-emerald-100/70">{item.tone}</p>
        </div>
      ))}
    </div>
  );
}
