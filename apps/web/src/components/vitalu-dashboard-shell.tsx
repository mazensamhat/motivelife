"use client";

import { cn } from "@/lib/utils";
import { ProductSuiteIcon } from "@/components/product-icons";

export const VITALU_NAV = [
  { id: "overview", label: "Overview", icon: "◈" },
  { id: "nutrition", label: "Nutrition", icon: "◎" },
  { id: "workouts", label: "Workouts", icon: "✦" },
  { id: "sleep", label: "Sleep", icon: "☾" },
  { id: "activity", label: "Activity", icon: "↗" },
  { id: "trends", label: "Trends", icon: "⌁" },
  { id: "goals", label: "Goals", icon: "◎" },
  { id: "insights", label: "Insights", icon: "✧" },
  { id: "devices", label: "Devices", icon: "⬡" },
  { id: "settings", label: "Settings", icon: "⚙" },
] as const;

export type VitaluNavId = (typeof VITALU_NAV)[number]["id"];

/** Left rail matching the Vitalu console template (soft mint active pill + Vyra card). */
export function VitaluDashboardShell({
  section,
  onSection,
  children,
  vyraHint,
}: {
  section: VitaluNavId;
  onSection: (id: VitaluNavId) => void;
  children: React.ReactNode;
  vyraHint?: string;
}) {
  return (
    <div className="vitalu-console flex min-h-[70vh] flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-6">
      <aside className="vitalu-rail flex shrink-0 flex-col lg:sticky lg:top-3 lg:w-[15.5rem] lg:self-start">
        <div className="hidden items-center gap-2.5 px-1 pb-4 lg:flex">
          <span className="vitalu-mark flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--vitalu-mint-soft)]">
            <ProductSuiteIcon id="vitalu" className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold tracking-tight text-[var(--vitalu-ink)]">Vitalu</p>
            <p className="truncate text-[11px] leading-snug text-[var(--vitalu-muted)]">
              Your Health. Your Plan. Your Life.
            </p>
          </div>
        </div>

        <nav
          className="vitalu-nav flex gap-1 overflow-x-auto rounded-[1.35rem] border border-[var(--vitalu-line)] bg-white p-2 shadow-[var(--vitalu-shadow)] lg:flex-col lg:overflow-visible"
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
                  "vitalu-nav-item flex items-center gap-2.5 whitespace-nowrap rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold transition",
                  active
                    ? "bg-[var(--vitalu-mint-soft)] text-[var(--vitalu-mint-ink)]"
                    : "text-[var(--vitalu-ink-soft)] hover:bg-[var(--vitalu-wash)]"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[13px]",
                    active ? "bg-white/80 text-[var(--vitalu-mint)]" : "bg-[var(--vitalu-wash)] text-[var(--vitalu-muted)]"
                  )}
                  aria-hidden
                >
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => onSection("insights")}
          className="vitalu-vyra-card mt-3 hidden rounded-[1.35rem] border border-[var(--vitalu-line)] bg-gradient-to-br from-white via-[#f7f4ff] to-[#eefcf4] p-3.5 text-left shadow-[var(--vitalu-shadow)] transition hover:border-[var(--vitalu-mint)]/40 lg:block"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--vitalu-lavender)] text-lg shadow-sm">
              ✧
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--vitalu-ink)]">Vyra AI</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--vitalu-muted)]">
                {vyraHint ?? "You’re doing great! Keep the momentum going."}
              </p>
            </div>
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--vitalu-mint)]" aria-hidden />
          </div>
        </button>
      </aside>

      <div className="vitalu-main min-w-0 flex-1 space-y-5">{children}</div>
    </div>
  );
}
