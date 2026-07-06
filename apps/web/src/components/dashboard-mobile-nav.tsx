"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, CalendarDays, Home, MessageSquarePlus, Sparkles, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChiefOfStaffFeedback } from "./chief-of-staff-feedback";

const TABS = [
  { href: "/dashboard", label: "Home", icon: Home, match: (p: string) => p === "/dashboard" },
  {
    href: "/dashboard",
    hash: "command-center",
    label: "Calendar",
    icon: CalendarDays,
    match: (p: string) => p === "/dashboard" || p.startsWith("/integrations"),
  },
  { href: "/money", label: "Money", icon: Wallet, match: (p: string) => p.startsWith("/money") },
  {
    href: "/memory",
    label: "Life Graph",
    icon: Briefcase,
    match: (p: string) => p.startsWith("/memory") || p.startsWith("/goals"),
  },
] as const;

function tabHref(tab: (typeof TABS)[number]) {
  return "hash" in tab && tab.hash ? `${tab.href}#${tab.hash}` : tab.href;
}

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
              href={tabHref(tab)}
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
        <Link
          href="/dashboard#coach"
          className={cn(
            "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium transition",
            pathname === "/dashboard" ? "text-forward-500" : "text-forward-500"
          )}
        >
          <Sparkles size={20} />
          <span className="truncate">AI Coach</span>
        </Link>
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
