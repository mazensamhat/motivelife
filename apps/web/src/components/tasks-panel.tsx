"use client";

import { useEffect, useState } from "react";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import { Input, Select } from "./input";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  isMission: boolean;
  dueDate: string | null;
  goal?: { id: string; title: string; domain: string } | null;
}

interface Goal {
  id: string;
  title: string;
}

export function TasksPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [goalId, setGoalId] = useState("");
  const [priority, setPriority] = useState("MEDIUM");

  async function load() {
    const [tasksRes, goalsRes] = await Promise.all([
      fetch("/api/tasks"),
      fetch("/api/goals"),
    ]);
    const tasksData = await tasksRes.json();
    const goalsData = await goalsRes.json();
    setTasks(tasksData.tasks ?? []);
    setGoals(goalsData.goals ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        goalId: goalId || undefined,
        priority,
      }),
    });
    setTitle("");
    setGoalId("");
    setShowForm(false);
    load();
  }

  async function updateTask(id: string, data: { status?: string; isMission?: boolean }) {
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    load();
  }

  const pending = tasks.filter((t) => t.status === "TODO" || t.status === "IN_PROGRESS");
  const done = tasks.filter((t) => t.status === "DONE");

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-forward-100" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <CardHeading>Tasks</CardHeading>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add task"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={createTask} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Update resume summary"
                required
              />
            </div>
            {goals.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Link to goal</label>
                <Select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                  <option value="">None</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">Priority</label>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </Select>
            </div>
            <Button type="submit">Create task</Button>
          </form>
        </Card>
      )}

      <TaskList
        title="To do"
        tasks={pending}
        onComplete={(id) => updateTask(id, { status: "DONE" })}
        onSetMission={(id) => updateTask(id, { isMission: true })}
      />

      {done.length > 0 && (
        <TaskList title="Completed" tasks={done} done />
      )}
    </div>
  );
}

function TaskList({
  title,
  tasks,
  done,
  onComplete,
  onSetMission,
}: {
  title: string;
  tasks: Task[];
  done?: boolean;
  onComplete?: (id: string) => void;
  onSetMission?: (id: string) => void;
}) {
  if (tasks.length === 0) {
    return (
      <Card>
        <p className="text-sm text-forward-500">No {title.toLowerCase()} tasks.</p>
      </Card>
    );
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-forward-500">{title}</h3>
      <div className="space-y-2">
        {tasks.map((task) => (
          <Card key={task.id} className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-start gap-3">
              {!done && onComplete && (
                <button
                  onClick={() => onComplete(task.id)}
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-forward-300 hover:border-accent hover:bg-accent/10"
                  aria-label="Complete task"
                />
              )}
              {done && (
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-success/10 text-success">
                  ✓
                </span>
              )}
              <div>
                <p className={done ? "text-forward-400 line-through" : "font-medium text-forward-900"}>
                  {task.title}
                  {task.isMission && (
                    <span className="ml-2 rounded bg-forward-900 px-1.5 py-0.5 text-xs text-white">
                      Mission
                    </span>
                  )}
                </p>
                {task.goal && (
                  <p className="text-xs text-forward-400">{task.goal.title}</p>
                )}
              </div>
            </div>
            {!done && onSetMission && !task.isMission && (
              <Button size="sm" variant="ghost" onClick={() => onSetMission(task.id)}>
                Set as mission
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
