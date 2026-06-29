"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./logo";
import { Button } from "./button";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Today" },
  { href: "/career", label: "Career" },
  { href: "/money", label: "Money" },
  { href: "/habits", label: "Habits" },
  { href: "/health", label: "Health" },
  { href: "/learning", label: "Learn" },
  { href: "/dashboard#life-gps", label: "Goals" },
  { href: "/tasks", label: "Tasks" },
  { href: "/memory", label: "Memory" },
  { href: "/integrations", label: "Connect" },
];

export function DashboardNav({ userName }: { userName: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
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
                  pathname === item.href
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
