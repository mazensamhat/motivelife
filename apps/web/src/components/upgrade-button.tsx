"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { isNativeShell } from "@/lib/native-shell";

export function UpgradeButton({
  children,
  className,
  size = "sm",
}: {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nativeShell, setNativeShell] = useState(false);

  useEffect(() => {
    setNativeShell(isNativeShell());
  }, []);

  async function checkout() {
    setLoading(true);
    setError("");
    try {
      // App Store 3.1.1: do not open Stripe checkout inside the iOS app.
      // StoreKit IAP is required before in-app purchases can resume here.
      if (isNativeShell()) {
        setError(
          "In-app purchase is coming soon. Manage MotiveLife Pro on the web at mymotivelife.com, or contact help@mymotivelife.com."
        );
        return;
      }
      const res = await fetch("/api/subscription/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Checkout unavailable — open Settings to upgrade.");
    } catch {
      setError("Could not start checkout.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={checkout}
        disabled={loading}
        className={cn(
          "font-semibold text-brand-purple hover:underline disabled:opacity-60",
          size === "md" && "rounded-xl bg-brand-purple px-4 py-2 text-sm text-white hover:bg-brand-purple/90 hover:no-underline",
          className
        )}
      >
        {loading ? "Opening checkout…" : nativeShell ? "MotiveLife Pro (web)" : children}
      </button>
      {error ? <span className="text-xs text-amber-700">{error}</span> : null}
    </span>
  );
}
