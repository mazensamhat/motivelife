"use client";

function BarList({
  items,
  labelKey,
  valueKey,
}: {
  items: Record<string, string | number>[];
  labelKey: string;
  valueKey: string;
}) {
  const max = Math.max(...items.map((i) => Number(i[valueKey]) || 0), 1);
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={String(item[labelKey])} className="grid grid-cols-[1fr_minmax(0,2fr)_3rem] items-center gap-2 text-sm">
          <span className="truncate text-forward-300">{String(item[labelKey] ?? "—")}</span>
          <div className="h-2 overflow-hidden rounded-full bg-forward-800">
            <div
              className="h-full rounded-full bg-emerald-400/80"
              style={{ width: `${((Number(item[valueKey]) || 0) / max) * 100}%` }}
            />
          </div>
          <span className="text-right font-mono text-forward-200">{item[valueKey]}</span>
        </div>
      ))}
    </div>
  );
}

export { BarList };
