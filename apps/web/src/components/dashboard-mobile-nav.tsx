"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChiefOfStaffFeedback } from "./chief-of-staff-feedback";
import { SuiteNavGlyph } from "./nav-icons";
import { PRODUCT_SUITE } from "@/lib/product-suite";
import type { NavIconKey } from "@/lib/generation";

const TABS: Array<{
  href: string;
  label: string;
  icon: NavIconKey;
  match: (p: string) => boolean;
}> = [
  {
    href: "/dashboard",
    label: PRODUCT_SUITE.dayo.shortLabel,
    icon: "home",
    match: (p) => p === "/dashboard",
  },
  {
    href: "/my-life",
    label: PRODUCT_SUITE.lifevue.shortLabel,
    icon: "life_hub",
    match: (p) =>
      ["/my-life", "/health", "/career", "/learning", "/relationships", "/habits"].some((x) =>
        p.startsWith(x)
      ),
  },
  {
    href: "/family-map",
    label: PRODUCT_SUITE.kinzo.shortLabel,
    icon: "family",
    match: (p) => p.startsWith("/family-map"),
  },
  {
    href: "/kashu",
    label: PRODUCT_SUITE.kashu.shortLabel,
    icon: "kashu",
    match: (p) => p.startsWith("/kashu") || p.startsWith("/money"),
  },
  {
    href: "/vyra",
    label: PRODUCT_SUITE.vyra.shortLabel,
    icon: "ai",
    match: (p) => p.startsWith("/vyra"),
  },
];

export function DashboardMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-forward-200 bg-white/95 pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Primary navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {TABS.map((tab) => {
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
              <SuiteNavGlyph icon={tab.icon} active={active} size="sm" tone="light" />
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
      Tell {PRODUCT_SUITE.vyra.label}
    </button>
  );
}
