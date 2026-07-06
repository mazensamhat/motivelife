"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";

type AutoPilotActionRow = {
  id: string;
  title: string;
  kind: string;
  startIso: string;
  endIso: string;
  status: string;
  createdAt: string;
};

export function AutoPilotHistoryPanel() {
  const [actions, setActions] = useState<AutoPilotActionRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/calendar/auto-pilot/history")
      .then((r) => (r.ok ? r.json() : { actions: [] }))
      .then((data) => {
        setActions(data.actions ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || actions.length === 0) return null;

  return (
    <div className="mt-3 border-t border-brand-cyan/20 pt-3">
      <div className="mb-2 flex items-center gap-2">
        <History size={14} className="text-forward-500" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-forward-500">
          Recent Auto-Pilot actions
        </p>
      </div>
      <ul className="space-y-1.5">
        {actions.map((action) => {
          const start = new Date(action.startIso);
          const time = start.toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });
          return (
            <li
              key={action.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-white/60 px-2.5 py-1.5 text-xs"
            >
              <span className="font-medium text-forward-800">{action.title}</span>
              <span className="text-forward-500">{time}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
