"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DashboardSidebar, DashboardTopBar } from "./dashboard-sidebar";
import { ModuleUsageTracker } from "./module-usage-tracker";
import { VoiceCaptureProvider } from "./voice-capture-provider";
import type { Generation, GenerationTheme } from "@/lib/generation";

export function DashboardShell({
  theme,
  profileGeneration,
  generation,
  userName,
  userEmail,
  lifeScore,
  isAdmin = false,
  children,
}: {
  theme: GenerationTheme;
  profileGeneration: Generation;
  generation: Generation;
  userName: string | null;
  userEmail: string;
  lifeScore: number;
  isAdmin?: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const sidebarProps = {
    theme,
    userName,
    profileGeneration,
    activeGeneration: generation,
    onNavigate: () => setMobileOpen(false),
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <ModuleUsageTracker />

      {/* Desktop: fixed-height sidebar — stays put while main scrolls */}
      <div className="hidden h-full shrink-0 lg:flex">
        <DashboardSidebar {...sidebarProps} className="h-full" />
      </div>

      {mobileOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 flex lg:hidden">
            <DashboardSidebar {...sidebarProps} className="h-full shadow-2xl" />
          </div>
        </>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <DashboardTopBar
          theme={theme}
          userName={userName}
          lifeScore={lifeScore}
          isAdmin={isAdmin}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          {children}
        </main>
        <VoiceCaptureProvider />
      </div>
    </div>
  );
}
