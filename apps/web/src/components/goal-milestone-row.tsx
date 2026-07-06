import { cn } from "@/lib/utils";

const PERCENT_MILESTONES = [25, 50, 75, 100] as const;

export type GoalTaskMilestone = {
  id: string;
  title: string;
  done: boolean;
};

export function GoalMilestoneRow({
  progress,
  taskMilestones,
}: {
  progress: number;
  taskMilestones?: GoalTaskMilestone[];
}) {
  const tasks = taskMilestones?.filter((t) => t.title.trim()) ?? [];
  const useTasks = tasks.length >= 2;
  const clamped = Math.min(100, Math.max(0, progress));

  if (useTasks) {
    const doneCount = tasks.filter((t) => t.done).length;
    const taskProgress = Math.round((doneCount / tasks.length) * 100);
    return (
      <div className="mt-3">
        <div className="mb-2 flex items-center justify-between text-[10px] text-forward-400">
          <span>Task milestones</span>
          <span>
            {doneCount}/{tasks.length} done
          </span>
        </div>
        <div className="space-y-1.5">
          {tasks.slice(0, 6).map((task) => (
            <div key={task.id} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                  task.done ? "bg-brand-green text-white" : "bg-forward-100 text-forward-400"
                )}
                aria-hidden
              >
                {task.done ? "✓" : "·"}
              </span>
              <span className={cn("min-w-0 truncate", task.done ? "text-forward-400 line-through" : "text-forward-700")}>
                {task.title}
              </span>
            </div>
          ))}
        </div>
        <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-forward-100">
          <div
            className="absolute inset-y-0 left-0 rounded-full brand-gradient transition-all"
            style={{ width: `${taskProgress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex justify-between gap-1 px-0.5">
        {PERCENT_MILESTONES.map((m) => {
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
        {PERCENT_MILESTONES.slice(0, -1).map((m) => (
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
