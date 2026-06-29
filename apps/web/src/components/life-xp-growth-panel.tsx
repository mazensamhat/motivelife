"use client";

import type { LifeXpGrowthPayload } from "@forward/shared";

export function LifeXpGrowthPanel({ growth }: { growth: LifeXpGrowthPayload }) {
  if (growth.dimensions.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-forward-300 bg-forward-50/50 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">Capability growth</p>
        <p className="mt-2 text-sm text-forward-600">
          Complete actions and coaching challenges — your growth story will live here permanently.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-forward-200 bg-white shadow-sm">
      <div className="border-b border-forward-100 px-5 py-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">Life XP™ growth</p>
        <h2 className="mt-1 text-lg font-semibold text-forward-900">{growth.headline}</h2>
        <p className="mt-1 text-sm text-forward-500">
          {growth.yearTotal.toLocaleString()} XP this year · {growth.monthTotal.toLocaleString()} this month
        </p>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
        {growth.dimensions.slice(0, 6).map((d) => (
          <div key={d.id} className="rounded-xl border border-forward-100 bg-forward-50/50 px-3 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-forward-800">{d.label}</p>
              <span className="text-[10px] uppercase text-forward-400">{d.capability}</span>
            </div>
            <p className="mt-1 text-xs text-forward-500">
              {d.yearXp} XP this year
              {d.deltaMonth !== 0 && (
                <span className={d.deltaMonth > 0 ? " text-brand-green" : " text-red-500"}>
                  {" "}
                  ({d.deltaMonth > 0 ? "+" : ""}
                  {d.deltaMonth} vs last month)
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      {growth.recentMilestones.length > 0 && (
        <div className="border-t border-forward-100 px-5 py-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">Recent gains</p>
          <ul className="mt-2 space-y-1.5">
            {growth.recentMilestones.slice(0, 5).map((m, i) => (
              <li key={`${m.createdAt}-${i}`} className="text-sm text-forward-600">
                <span className="font-medium text-brand-green">+{m.amount}</span> {m.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
