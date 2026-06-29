"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { pathToModule } from "@/lib/adaptive-modules";

export function ModuleUsageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const moduleId = pathToModule(pathname);
    if (!moduleId) return;

    fetch("/api/module-usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId }),
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
