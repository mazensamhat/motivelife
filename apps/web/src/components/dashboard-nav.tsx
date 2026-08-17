"use client";

import Link from "next/link";
import { clientLogout } from "@/lib/auth-client";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";
import { Button } from "./button";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "DayO" },
  { href: "/my-life", label: "LifeVue" },
  { href: "/family-map", label: "KINZO AI" },
  { href: "/goals", label: "UPLIFT" },
  { href: "/vyra", label: "VYRA AI" },
  { href: "/memory", label: "MotiveIQ" },
  { href: "/dashboard#feed", label: "Signals" },
  { href: "/integrations", label: "Connect" },
  { href: "/settings", label: "Settings" },
];

export function DashboardNav({ userName }: { userName: string | null }) {
  const pathname = usePathname();

  async function logout() {
    await clientLogout();
  }

  return (
    <header className="border-b border-forward-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden gap-1 sm:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  (item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`))
                    ? "brand-gradient text-white shadow-sm"
                    : "text-forward-500 hover:bg-forward-100 hover:text-forward-900"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {userName && (
            <span className="hidden text-sm text-forward-500 sm:inline">{userName}</span>
          )}
          <Button variant="ghost" size="sm" onClick={logout}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
