"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ViewportProvider } from "@/components/viewport-provider";
import { ChiefOfStaffFeedbackProvider } from "./chief-of-staff-feedback";
import { DashboardMobileNav } from "./dashboard-mobile-nav";
import { DashboardSidebar, DashboardTopBar } from "./dashboard-sidebar";
import { ModuleUsageTracker } from "./module-usage-tracker";
import { VoiceCaptureProvider } from "./voice-capture-provider";
import { NativeIapSessionBridge } from "./native-iap-session-bridge";
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
  const familyMapImmersive = pathname.startsWith("/family-map");

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const scroller = document.querySelector<HTMLElement>("[data-dashboard-scroll]");
    const prevBody = document.body.style.overflow;
    const prevMain = scroller?.style.overflow ?? "";
    document.body.style.overflow = "hidden";
    if (scroller) scroller.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      if (scroller) scroller.style.overflow = prevMain;
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
    <ViewportProvider>
      <ChiefOfStaffFeedbackProvider>
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
            {familyMapImmersive ? (
              <div className="hidden lg:block">
                <DashboardTopBar
                  theme={theme}
                  userName={userName}
                  lifeScore={lifeScore}
                  isAdmin={isAdmin}
                  onMenuClick={() => setMobileOpen(true)}
                />
              </div>
            ) : (
              <DashboardTopBar
                theme={theme}
                userName={userName}
                lifeScore={lifeScore}
                isAdmin={isAdmin}
                onMenuClick={() => setMobileOpen(true)}
              />
            )}
            <main
              data-dashboard-scroll
              {...(familyMapImmersive
                ? { "data-family-map-immersive": "true" }
                : {})}
              className={
                familyMapImmersive
                  ? "relative min-h-0 flex-1 overflow-hidden overscroll-none p-0 pb-[calc(3.65rem+env(safe-area-inset-bottom))] lg:pb-0"
                  : "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain p-3 pb-[calc(7.5rem+env(safe-area-inset-bottom))] max-[380px]:p-2 sm:p-6 sm:pb-[calc(7.5rem+env(safe-area-inset-bottom))] lg:pb-6"
              }
            >
              {children}
            </main>
            <DashboardMobileNav />
            <VoiceCaptureProvider />
            <NativeIapSessionBridge />
          </div>
        </div>
      </ChiefOfStaffFeedbackProvider>
    </ViewportProvider>
  );
}
