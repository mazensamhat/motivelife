import { cn } from "@/lib/utils";

const MILESTONES = [25, 50, 75, 100] as const;

export function GoalMilestoneRow({ progress }: { progress: number }) {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className="mt-3">
      <div className="flex justify-between gap-1 px-0.5">
        {MILESTONES.map((m) => {
          const reached = clamped >= m;
          return (
            <div key={m} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
                  reached ? "bg-brand-green text-white shadow-sm" : "bg-forward-100 text-forward-400"
                )}
                aria-hidden
              >
                {reached ? "✓" : m}
              </div>
              <span className="text-[9px] font-medium text-forward-400">{m}%</span>
            </div>
          );
        })}
      </div>
      <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-forward-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full brand-gradient transition-all"
          style={{ width: `${clamped}%` }}
        />
        {MILESTONES.slice(0, -1).map((m) => (
          <div
            key={m}
            className="absolute top-0 h-full w-px bg-forward-200/80"
            style={{ left: `${m}%` }}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}
