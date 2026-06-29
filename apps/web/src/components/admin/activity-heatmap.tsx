"use client";

function heatColor(value: number, max: number): string {
  if (max <= 0 || value <= 0) return "rgba(255,255,255,0.03)";
  const t = value / max;
  return `rgba(16, 185, 129, ${0.12 + t * 0.75})`;
}

export function ActivityHeatmap({
  heatmap,
  moduleLabels,
}: {
  heatmap: {
    days: string[];
    modules: string[];
    cells: Record<string, Record<string, number>>;
    max: number;
  };
  moduleLabels: Record<string, string>;
}) {
  return (
    <section className="rounded-xl border border-forward-800 bg-forward-900/60 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-forward-400">
        Module activity heatmap (14 days)
      </h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr>
              <th className="pb-2 pr-2 font-medium text-forward-500">Module</th>
              {heatmap.days.map((d) => (
                <th key={d} className="pb-2 px-0.5 font-medium text-forward-500">
                  {d.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.modules.map((mod) => (
              <tr key={mod}>
                <td className="py-1 pr-2 text-forward-300">{moduleLabels[mod] ?? mod}</td>
                {heatmap.days.map((day) => {
                  const val = heatmap.cells[mod]?.[day] ?? 0;
                  return (
                    <td
                      key={day}
                      className="p-0.5 text-center text-forward-200"
                      style={{ background: heatColor(val, heatmap.max) }}
                      title={`${moduleLabels[mod] ?? mod} · ${day}: ${val}`}
                    >
                      {val > 0 ? val : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
