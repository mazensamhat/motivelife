"use client";

import { cn } from "@/lib/utils";

export const VITALU_NAV = [
  { id: "overview", label: "Overview" },
  { id: "nutrition", label: "Nutrition" },
  { id: "workouts", label: "Workouts" },
  { id: "sleep", label: "Sleep" },
  { id: "activity", label: "Activity" },
  { id: "trends", label: "Trends" },
  { id: "goals", label: "Goals" },
  { id: "insights", label: "Insights" },
  { id: "devices", label: "Devices" },
  { id: "settings", label: "Settings" },
] as const;

export type VitaluNavId = (typeof VITALU_NAV)[number]["id"];

export function VitaluDashboardShell({
  section,
  onSection,
  accent,
  children,
}: {
  section: VitaluNavId;
  onSection: (id: VitaluNavId) => void;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col gap-4 lg:flex-row lg:gap-6">
      <aside className="shrink-0 lg:w-52">
        <nav
          className="flex gap-1 overflow-x-auto rounded-2xl border border-forward-100 bg-white/70 p-2 shadow-sm lg:flex-col lg:overflow-visible"
          aria-label="Vitalu sections"
        >
          {VITALU_NAV.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSection(item.id)}
                className={cn(
                  "whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm font-medium transition",
                  active ? "text-white shadow-sm" : "text-forward-600 hover:bg-forward-50 hover:text-forward-900"
                )}
                style={active ? { background: accent } : undefined}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 space-y-6">{children}</div>
    </div>
  );
}
