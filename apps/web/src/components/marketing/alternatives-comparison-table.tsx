"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  ComparisonCategory,
  ComparisonCell,
  ComparisonColumn,
  ComparisonFilter,
  ComparisonRow,
} from "@/lib/alternatives/types";

function CellContent({ cell, ours }: { cell: ComparisonCell; ours?: boolean }) {
  return (
    <span className={ours && cell.strong ? "font-semibold text-forward-950" : undefined}>
      {cell.text}
      {cell.comingSoon ? (
        <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-blue">
          Coming soon
        </span>
      ) : null}
    </span>
  );
}

type Props = {
  filters: ComparisonFilter[];
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
};

export function AlternativesComparisonTable({ filters, columns, rows: allRows }: Props) {
  const [filter, setFilter] = useState<"all" | ComparisonCategory>("all");
  const [, startTransition] = useTransition();

  const rows = useMemo(
    () => (filter === "all" ? allRows : allRows.filter((r) => r.category === filter)),
    [filter, allRows]
  );

  const hint = filters.find((f) => f.id === filter)?.hint ?? "";

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap gap-x-1 gap-y-2 border-b border-forward-200"
        role="tablist"
        aria-label="Filter comparison features"
      >
        {filters.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => startTransition(() => setFilter(f.id))}
              className={`relative px-3 py-2.5 text-sm font-medium transition-colors sm:px-4 ${
                active ? "text-brand-blue" : "text-forward-500 hover:text-forward-800"
              }`}
            >
              {f.label}
              {active ? (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-blue alt-filter-ink" />
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-forward-500" aria-live="polite">
        {hint}{" "}
        <span className="text-forward-400">
          ({rows.length} {rows.length === 1 ? "row" : "rows"})
        </span>
      </p>

      <div className="alt-table-shell overflow-hidden rounded-2xl border border-forward-200 bg-white shadow-[0_20px_60px_-40px_rgba(10,25,48,0.45)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-forward-200 bg-forward-50/90 text-xs font-semibold uppercase tracking-[0.14em] text-forward-500">
                <th className="sticky left-0 z-20 bg-forward-50 px-4 py-4 sm:px-5">Capability</th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className={`px-4 py-4 sm:px-5 ${
                      col.ours ? "bg-brand-blue/[0.08] text-brand-blue" : ""
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.id}
                  className="alt-row border-b border-forward-100 last:border-b-0"
                  style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-white px-4 py-3.5 font-medium text-forward-800 sm:px-5"
                  >
                    {row.capability}
                  </th>
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={`px-4 py-3.5 sm:px-5 ${
                        col.ours
                          ? "bg-brand-blue/[0.04] text-forward-800"
                          : "text-forward-600"
                      }`}
                    >
                      <CellContent cell={row.cells[col.id] ?? { text: "—" }} ours={col.ours} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
