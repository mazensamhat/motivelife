"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "./card";

interface Stats {
  completedToday: number;
  completedWeek: number;
  activeGoals: number;
  livesMovedForward: number;
}

export function ProgressSnapshot() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/progress")
      .then((r) => r.json())
      .then((d) => setStats(d.stats));
  }, []);

  if (!stats) {
    return <div className="h-20 animate-pulse rounded-xl bg-forward-100" />;
  }

  const items = [
    { label: "Done today", value: stats.completedToday },
    { label: "Done this week", value: stats.completedWeek },
    { label: "Active goals", value: stats.activeGoals },
    { label: "Lives moved forward", value: stats.livesMovedForward },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="p-4">
          <CardTitle>{item.label}</CardTitle>
          <p className="mt-1 text-2xl font-semibold text-forward-900">{item.value}</p>
        </Card>
      ))}
    </div>
  );
}
