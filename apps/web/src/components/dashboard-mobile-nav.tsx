"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, MessageSquare, MessageSquarePlus, Mic, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChiefOfStaffFeedback } from "./chief-of-staff-feedback";

const TABS = [
  { href: "/dashboard", label: "Today", icon: Home, match: (p: string) => p === "/dashboard" },
  {
    href: "/my-life",
    label: "My Life",
    icon: LayoutGrid,
    match: (p: string) =>
      ["/my-life", "/money", "/health", "/career", "/learning", "/relationships", "/habits"].some(
        (x) => p.startsWith(x)
      ),
  },
  {
    href: "/dashboard#voice",
    label: "Voice",
    icon: Mic,
    match: () => false,
  },
  {
    href: "/dashboard#coach",
    label: "AI",
    icon: MessageSquare,
    match: (p: string) => p.startsWith("/memory"),
  },
  { href: "/settings", label: "More", icon: Settings, match: (p: string) => p.startsWith("/settings") },
] as const;

export function DashboardMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-forward-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label="Primary navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium transition",
                active ? "text-[var(--gen-primary,#0072ff)]" : "text-forward-500"
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.25 : 2} />
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Compact feedback entry in menus / settings */
export function FeedbackNavButton({ className }: { className?: string }) {
  const { openFeedback } = useChiefOfStaffFeedback();
  return (
    <button
      type="button"
      onClick={() => openFeedback()}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-forward-200 bg-white px-3 py-2 text-sm font-medium text-forward-700 transition hover:border-forward-300 hover:bg-forward-50",
        className
      )}
    >
      <MessageSquarePlus size={16} />
      Tell your Chief of Staff
    </button>
  );
}
