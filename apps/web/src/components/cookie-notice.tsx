"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "ml-cookie-notice";

export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

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
          We use essential cookies to keep you signed in and run MotiveLife. Optional AI features may
          process data as described in our{" "}
          <Link href="/privacy" className="font-medium text-brand-blue hover:underline">
            Privacy Policy
          </Link>
          . We do not sell personal information.
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
