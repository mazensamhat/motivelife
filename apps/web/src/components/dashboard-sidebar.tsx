"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Settings, Shield } from "lucide-react";
import { Logo } from "./logo";
import { LogoMark } from "./logo-mark";
import { MotiveLifeScoreLabel } from "./motive-life-score-label";
import { NAV_ICON_MAP } from "./nav-icons";
import { LifeScoreRing, ThemedIcon } from "./themed-icon";
import { cn } from "@/lib/utils";
import { GENERATION_THEMES, type Generation, type GenerationTheme } from "@/lib/generation";

interface DashboardSidebarProps {
  theme: GenerationTheme;
  userName: string | null;
  profileGeneration: Generation;
  activeGeneration: Generation;
  onNavigate?: () => void;
  className?: string;
}

function isActive(pathname: string, href: string, nav: { href: string }[]) {
  const path = href.split("#")[0];
  if (path === "/dashboard") return pathname === "/dashboard";
  if (!pathname.startsWith(path)) return false;
  // When several nav items share a route (e.g. Career + Business → /career), highlight only the first match.
  const firstForPath = nav.find((item) => item.href.split("#")[0] === path);
  return firstForPath?.href === href;
}

export function DashboardSidebar({
  theme,
  userName,
  profileGeneration,
  activeGeneration,
  onNavigate,
  className,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isPreview = activeGeneration !== profileGeneration;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <aside
      className={cn(
        "flex h-full w-64 shrink-0 flex-col border-r border-white/5 bg-forward-950 text-white lg:sticky lg:top-0 lg:max-h-screen",
        className
      )}
      style={{ ["--gen-primary" as string]: theme.primary }}
    >
      <div className="border-b border-white/10 px-5 py-6">
        <Logo variant="dark" size="sidebar" showMark={false} href="/dashboard" />
        <div className="mt-5 flex flex-wrap gap-2">
          <p
            className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest"
            style={{
              backgroundColor: `${theme.primary}22`,
              color: theme.primaryLight,
              border: `1px solid ${theme.primary}44`,
            }}
          >
            {theme.label} · {theme.ageRange}
          </p>
          {isPreview && (
            <p className="inline-flex rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-cyan">
              Preview
            </p>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {theme.nav.map((item) => {
          const Icon = NAV_ICON_MAP[item.icon];
          const active = isActive(pathname, item.href, theme.nav);
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-2xl px-2.5 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-white/10 text-white shadow-inner"
                  : "text-forward-400 hover:bg-white/[0.06] hover:text-white"
              )}
              style={
                active
                  ? {
                      boxShadow: `inset 3px 0 0 0 ${theme.primary}, 0 0 20px -8px ${theme.primary}88`,
                    }
                  : undefined
              }
            >
              <ThemedIcon
                icon={Icon}
                active={active}
                primary={theme.primary}
                primaryLight={theme.primaryLight}
                primaryDark={theme.primaryDark}
                size="sm"
                variant="nav"
              />
              <span className="flex-1 tracking-wide">{item.label}</span>
              {item.badge && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                  style={{
                    background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`,
                  }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            "group mt-3 flex items-center gap-3 rounded-2xl px-2.5 py-2.5 text-sm font-medium transition-all duration-200",
            pathname.startsWith("/settings")
              ? "bg-white/10 text-white"
              : "text-forward-400 hover:bg-white/[0.06] hover:text-white"
          )}
          style={
            pathname.startsWith("/settings")
              ? {
                  boxShadow: `inset 3px 0 0 0 ${theme.primary}, 0 0 20px -8px ${theme.primary}88`,
                }
              : undefined
          }
        >
          <ThemedIcon
            icon={Settings}
            active={pathname.startsWith("/settings")}
            primary={theme.primary}
            primaryLight={theme.primaryLight}
            primaryDark={theme.primaryDark}
            size="sm"
            variant="nav"
          />
          <span className="flex-1 tracking-wide">Settings</span>
        </Link>
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-2.5">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold text-white shadow-md"
            style={{
              background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`,
            }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{userName ?? "User"}</p>
            <p className="truncate text-xs text-forward-400">
              {isPreview
                ? `Preview · ${GENERATION_THEMES[profileGeneration].label}`
                : `${theme.label} view`}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl p-2 text-forward-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function DashboardTopBar({
  theme,
  userName,
  lifeScore,
  isAdmin = false,
  onMenuClick,
}: {
  theme: GenerationTheme;
  userName: string | null;
  lifeScore: number;
  isAdmin?: boolean;
  onMenuClick?: () => void;
}) {
  const firstName = userName?.split(" ")[0] ?? "there";

  return (
    <header className="flex items-center justify-between gap-3 border-b border-forward-200 bg-white px-4 py-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="mt-1 rounded-xl p-2 text-forward-600 hover:bg-forward-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-col items-start gap-2">
          <LogoMark size={56} className="mb-0.5 sm:hidden" />
          <LogoMark size={64} className="mb-1 hidden sm:block" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-forward-900 sm:text-xl">
              {theme.greeting}, {firstName}!
            </h1>
            <p className="truncate text-sm text-forward-500">
              Your Daily Operating System
            </p>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <div className="hidden items-start gap-2 sm:flex">
          <MotiveLifeScoreLabel />
          <LifeScoreRing
            score={lifeScore}
            primary={theme.primary}
            primaryLight={theme.primaryLight}
            size={56}
          />
        </div>
        <div className="flex sm:hidden">
          <LifeScoreRing
            score={lifeScore}
            primary={theme.primary}
            primaryLight={theme.primaryLight}
            size={48}
          />
        </div>
        <button
          type="button"
          className="rounded-xl p-2 text-forward-500 hover:bg-forward-100"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>
        {isAdmin && (
          <Link
            href="/admin"
            className="rounded-xl p-2 text-forward-500 hover:bg-forward-100"
            title="Ops Console"
            aria-label="Ops Console"
          >
            <Shield className="h-5 w-5" />
          </Link>
        )}
      </div>
    </header>
  );
}
