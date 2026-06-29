import { HabitsPanel } from "@/components/habits-panel";

export default function HabitsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-forward-900">Habits</h1>
      <p className="mt-1 text-forward-500">
        Daily and weekly routines with streaks — anchored to your goals.
      </p>
      <div className="mt-8">
        <HabitsPanel />
      </div>
    </div>
  );
}
