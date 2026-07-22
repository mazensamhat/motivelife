"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { isNativeShell } from "@/lib/native-shell";

/** Vercel Analytics only on the public website — not inside the iOS WebView (5.1.2). */
export function WebAnalytics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(!isNativeShell());
  }, []);

  if (!enabled) return null;
  return <Analytics />;
}
