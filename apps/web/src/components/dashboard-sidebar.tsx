"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { clientLogout } from "@/lib/auth-client";
import { usePathname } from "next/navigation";
import { NotificationsBell } from "./notifications-bell";
import { LogOut, Menu, Shield } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { LogoMark } from "./logo-mark";
import { MotiveLifeScoreLabel } from "./motive-life-score-label";
import { SuiteNavGlyph, productIdForNav } from "./nav-icons";
import { LifeScoreRing } from "./themed-icon";
import { cn } from "@/lib/utils";
import { useAppLocale } from "@/components/locale-provider";
import { localizeNavGroups, localizeNavItems } from "@/lib/locale-nav";
import { GENERATION_THEMES, NAV_GROUPS, NAV_SECONDARY_KEYS, type Generation, type GenerationTheme, type NavItem } from "@/lib/generation";
import { PRODUCT_SUITE } from "@/lib/product-suite";

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

function SidebarNavLink({
  item,
  active,
  theme,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  theme: GenerationTheme;
  onNavigate?: () => void;
}) {
  const productId = productIdForNav(item.icon);
  const accent = productId ? PRODUCT_SUITE[productId] : null;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      data-tour={item.href.startsWith("/settings") ? "settings-link" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-2xl px-2.5 py-2.5 text-sm font-medium transition-all duration-200",
        active
          ? "bg-white/10 text-white shadow-inner"
          : "text-forward-400 hover:bg-white/[0.06] hover:text-white"
      )}
      style={
        active
          ? {
              boxShadow: `inset 3px 0 0 0 ${accent?.primary ?? theme.primary}, 0 0 20px -8px ${accent?.primary ?? theme.primary}88`,
            }
          : undefined
      }
    >
      <SuiteNavGlyph icon={item.icon} active={active} size="sm" />
      <span className="flex-1 tracking-wide">
        <span className="block">{item.label}</span>
        {item.subtitle ? (
          <span className="block text-[10px] font-normal text-forward-500">{item.subtitle}</span>
        ) : null}
      </span>
      {item.badge && (
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
          style={{
            background: `linear-gradient(135deg, ${accent?.primary ?? theme.primary} 0%, ${accent?.primaryDark ?? theme.primaryDark} 100%)`,
          }}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function SidebarNavGroup({
  group,
  items,
  pathname,
  theme,
  nav,
  onNavigate,
}: {
  group: { label: string; defaultOpen?: boolean };
  items: NavItem[];
  pathname: string;
  theme: GenerationTheme;
  nav: NavItem[];
  onNavigate?: () => void;
}) {
  const groupActive = items.some((item) => isActive(pathname, item.href, nav));
  const [open, setOpen] = useState(group.defaultOpen ?? groupActive);

  useEffect(() => {
    if (groupActive) setOpen(true);
  }, [groupActive, pathname]);

  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="group/nav">
      <summary className="cursor-pointer list-none px-2 py-1.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="text-[10px] font-bold uppercase tracking-widest text-forward-500">{group.label}</span>
      </summary>
      <div className="mt-1 space-y-1">
        {items.map((item) => (
          <SidebarNavLink
            key={`${item.href}-${item.label}`}
            item={item}
            active={isActive(pathname, item.href, nav)}
            theme={theme}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </details>
  );
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
  const { t } = useAppLocale();
  const isPreview = activeGeneration !== profileGeneration;
  const nav = useMemo(() => localizeNavItems(theme.nav, t), [theme.nav, t]);
  const navGroups = useMemo(() => localizeNavGroups(NAV_GROUPS, t), [t]);

  async function logout() {
    await clientLogout();
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
        <BrandLogo
          href="/dashboard"
          size="sidebar"
          variant="dark"
          priority
          className="block w-full max-w-[220px]"
        />
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

      <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => {
          const items = group.keys
            .map((key) => nav.find((n) => n.icon === key))
            .filter((n): n is NavItem => Boolean(n));
          if (items.length === 0) return null;

          return (
            <SidebarNavGroup
              key={group.label}
              group={group}
              items={items}
              pathname={pathname}
              theme={theme}
              nav={nav}
              onNavigate={onNavigate}
            />
          );
        })}

        {NAV_SECONDARY_KEYS.map((key) => {
          const item = nav.find((n) => n.icon === key);
          if (!item) return null;
          return (
            <SidebarNavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href, nav)}
              theme={theme}
              onNavigate={onNavigate}
            />
          );
        })}
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
            aria-label={t("common.signOut")}
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
  const { greeting, t } = useAppLocale();
  const [timeGreeting, setTimeGreeting] = useState(() => greeting());

  useEffect(() => {
    setTimeGreeting(greeting());
    const id = window.setInterval(() => setTimeGreeting(greeting()), 60_000);
    return () => window.clearInterval(id);
  }, [greeting]);

  return (
    <header className="flex items-center justify-between gap-3 border-b border-forward-200 bg-white px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
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
          <Link href="/dashboard" className="shrink-0" aria-label="MotiveLife home">
            <LogoMark size={56} className="mb-0.5 sm:hidden" />
            <LogoMark size={64} className="mb-1 hidden sm:block" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-forward-900 sm:text-xl">
              {timeGreeting}, {firstName}!
            </h1>
            <p className="truncate text-sm text-forward-500">{t("tagline.suite")}</p>
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
        <NotificationsBell />
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
