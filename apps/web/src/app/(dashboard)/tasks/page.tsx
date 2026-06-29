import { TasksPanel } from "@/components/tasks-panel";

export default function TasksPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-forward-900">Tasks</h1>
      <p className="mt-1 text-forward-500">Actions that move your goals forward.</p>
      <div className="mt-8">
        <TasksPanel />
      </div>
    </div>
  );
}
