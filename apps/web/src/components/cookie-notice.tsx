"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNativeShell } from "@/lib/native-shell";

const STORAGE_KEY = "ml-cookie-notice";

/**
 * Web-only notice. Hidden in the iOS/Android native shell (App Store 5.1.2 —
 * cookie prompts without ATT look like tracking consent).
 * Copy clarifies: essential cookies only, no advertising / cross-app tracking.
 */
export function CookieNotice() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isNativeShell()) return;
    if (document.documentElement.classList.contains("motivelife-native-shell")) return;
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  const onAuthPage = pathname === "/login" || pathname === "/register";

  if (!visible || onAuthPage) return null;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-forward-200 bg-white p-4 shadow-lg sm:px-6"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-forward-700">
          We use <strong>essential cookies only</strong> to keep you signed in and run MotiveLife.
          We do <strong>not</strong> use cookies for advertising or to track you across other
          companies&apos; apps or websites. See our{" "}
          <Link href="/privacy" className="font-medium text-brand-blue hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg bg-forward-900 px-4 py-2 text-sm font-medium text-white hover:bg-forward-800"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
