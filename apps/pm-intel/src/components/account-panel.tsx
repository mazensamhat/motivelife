"use client";

import { pillClass, tempClass } from "@/lib/format";
import type { StoreScore } from "@/lib/types";

export function AccountPanel({ store }: { store: StoreScore | null }) {
  if (!store) {
    return (
      <section className="rounded-3xl border border-line bg-white p-6 text-muted">
        Select a store to open the 360.
      </section>
    );
  }

  const b = store.breakdown;

  return (
    <section className="rounded-3xl border border-line bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,.06)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-cyan">Account 360</p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-navy">{store.storeName}</h2>
          <p className="text-sm text-muted">
            {store.dealerGroup || "Independent rooftop"} · PM {store.pmName}
          </p>
        </div>
        <div className="flex gap-2">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${pillClass(store.label)}`}>
            {store.label} {store.score}
          </span>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${tempClass(store.temperature.label)}`}>
            {store.temperature.label}
          </span>
        </div>
      </div>

      <p className="mt-4 rounded-2xl bg-ice px-4 py-3 text-sm text-navy">{store.nextAction}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Stat label="Last engagement" value={store.lastEngagement.date || "—"} hint={store.lastEngagement.type || ""} />
        <Stat label="Days since" value={String(store.lastEngagement.daysSince ?? "—")} hint="From recap as-of date" />
        <Stat label="90-day visits" value={String(store.counts.last90)} hint="Target 3" />
        <Stat
          label="Scored impressions"
          value={String(store.temperature.readings)}
          hint="Blanks before Mar 2026 ignored"
        />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <Bar label="Recency" points={b.recency.points} max={b.recency.max} />
        <Bar label="Cadence" points={b.cadence.points} max={b.cadence.max} />
        <Bar label="Type mix" points={b.mix.points} max={b.mix.max} />
        <Bar
          label="Temperature"
          points={b.temperature.applied ? b.temperature.points || 0 : 0}
          max={b.temperature.max}
          muted={!b.temperature.applied}
        />
      </div>
      <p className="mt-2 text-xs text-muted">{b.temperature.reason}</p>

      <h3 className="mt-6 font-[family-name:var(--font-display)] text-lg font-bold text-navy">Timeline</h3>
      <ol className="mt-3 max-h-[420px] space-y-3 overflow-auto pr-1">
        {store.engagements.map((row) => (
          <li key={row.id} className="rounded-2xl border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm text-navy">{row.date}</strong>
              <span className="text-xs text-muted">
                {row.activityType} · {row.createdBy}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink">{row.subject}</p>
            <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${tempClass(row.temperature.label)}`}>
              {row.temperature.label}
            </span>
            {row.temperature.impression ? (
              <p className="mt-2 text-sm leading-6 text-navy-2">{row.temperature.impression}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper px-3 py-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="font-[family-name:var(--font-display)] text-xl font-extrabold text-navy">{value}</div>
      <div className="text-xs text-muted">{hint}</div>
    </div>
  );
}

function Bar({ label, points, max, muted }: { label: string; points: number; max: number; muted?: boolean }) {
  const pct = Math.round((points / Math.max(max, 1)) * 100);
  return (
    <div className={`rounded-2xl border border-line p-3 ${muted ? "opacity-60" : ""}`}>
      <div className="flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span>
          {muted ? "excluded" : `${points}/${max}`}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-ice">
        <div className="h-full rounded-full bg-blue" style={{ width: `${muted ? 0 : pct}%` }} />
      </div>
    </div>
  );
}
