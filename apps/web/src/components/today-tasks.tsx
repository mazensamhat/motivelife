"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "./button";
import { Card } from "./card";

interface Task {
  id: string;
  title: string;
  status: string;
  isMission: boolean;
  priority: string;
}

export function TodayTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    const pending = (data.tasks ?? []).filter(
      (t: Task) => t.status === "TODO" || t.status === "IN_PROGRESS"
    );
    setTasks(pending.slice(0, 5));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function complete(id: string) {
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "DONE" }),
    });
    load();
  }

  if (loading) {
    return <div className="h-24 animate-pulse rounded-xl bg-forward-100" />;
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <p className="text-sm text-forward-500">No pending tasks. Add one to get moving.</p>
        <Link href="/tasks" className="mt-3 inline-block">
          <Button size="sm">Add task</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <Card key={task.id} className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => complete(task.id)}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-forward-300 hover:border-accent"
              aria-label="Complete"
            />
            <span className="text-sm font-medium text-forward-900">
              {task.title}
              {task.isMission && (
                <span className="ml-2 rounded bg-forward-900 px-1.5 py-0.5 text-xs text-white">
                  Mission
                </span>
              )}
            </span>
          </div>
        </Card>
      ))}
      <Link href="/tasks" className="text-sm text-accent hover:underline">
        View all tasks →
      </Link>
    </div>
  );
}
