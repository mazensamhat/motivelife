"use client";

import type { ExpenseBreakdown } from "@forward/shared";
import { cn } from "@/lib/utils";

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function ExpenseBreakdownChart({
  breakdown,
  className,
}: {
  breakdown: ExpenseBreakdown;
  className?: string;
}) {
  const { monthlyIncome, categories } = breakdown;
  const outflows = categories.filter((c) => c.key !== "available" && c.amount > 0);
  const available = categories.find((c) => c.key === "available");

  if (monthlyIncome <= 0 && outflows.length === 0) {
    return (
      <p className="text-sm text-forward-500">
        Complete your financial profile and add monthly items to see your expense breakdown.
      </p>
    );
  }

  let cursor = 0;
  const donutGradient =
    monthlyIncome > 0
      ? outflows
          .map((slice) => {
            const start = cursor;
            cursor += slice.percentOfIncome;
            return `${slice.color} ${start}% ${cursor}%`;
          })
          .join(", ")
      : "";

  const availablePct = available?.percentOfIncome ?? 0;
  const fullGradient =
    monthlyIncome > 0 && availablePct > 0
      ? `${donutGradient}${donutGradient ? ", " : ""}#00ff87 ${cursor}% 100%`
      : donutGradient;

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {monthlyIncome > 0 && fullGradient ? (
          <div className="relative h-44 w-44 shrink-0">
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: `conic-gradient(${fullGradient})` }}
            />
            <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-forward-400">
                Income
              </p>
              <p className="text-lg font-bold tabular-nums text-forward-900">
                {formatMoney(monthlyIncome)}
              </p>
              {available ? (
                <p className="text-xs font-medium text-brand-green">
                  {formatMoney(available.amount)} free
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <ul className="min-w-0 flex-1 space-y-2">
          {categories
            .filter((c) => c.amount > 0)
            .map((slice) => (
              <li key={slice.key}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="truncate text-forward-700">{slice.label}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-forward-900">
                    {formatMoney(slice.amount)}
                    {monthlyIncome > 0 ? (
                      <span className="ml-1 text-xs font-normal text-forward-400">
                        {slice.percentOfIncome}%
                      </span>
                    ) : null}
                  </span>
                </div>
                {monthlyIncome > 0 ? (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-forward-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, slice.percentOfIncome)}%`,
                        backgroundColor: slice.color,
                      }}
                    />
                  </div>
                ) : null}
              </li>
            ))}
        </ul>
      </div>

      {monthlyIncome > 0 ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-forward-400">
            Monthly cash flow
          </p>
          <div className="flex h-4 overflow-hidden rounded-full bg-forward-100">
            {outflows.map((slice) => (
              <div
                key={slice.key}
                className="h-full transition-all"
                style={{
                  width: `${(slice.amount / monthlyIncome) * 100}%`,
                  backgroundColor: slice.color,
                }}
                title={`${slice.label}: ${formatMoney(slice.amount)}`}
              />
            ))}
            {available && available.amount > 0 ? (
              <div
                className="h-full bg-brand-green/80"
                style={{ width: `${(available.amount / monthlyIncome) * 100}%` }}
                title={`Available: ${formatMoney(available.amount)}`}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
