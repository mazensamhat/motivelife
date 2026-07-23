"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { isNativeShell } from "@/lib/native-shell";
import { SubscriptionLegalDisclosure } from "./subscription-legal-disclosure";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
    __MOTIVELIFE_NATIVE_IAP__?: boolean;
  }
}

function postNative(msg: Record<string, unknown>) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(msg));
}

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
  const [nativeIap, setNativeIap] = useState(false);

  useEffect(() => {
    setNativeShell(isNativeShell());
    setNativeIap(Boolean(window.__MOTIVELIFE_NATIVE_IAP__));

    function onIap(e: Event) {
      const detail = (e as CustomEvent).detail as { type?: string; ok?: boolean; error?: string };
      if (detail?.type !== "iap_result") return;
      setLoading(false);
      if (!detail.ok) setError(detail.error ?? "Purchase did not complete.");
    }
    window.addEventListener("motivelife-iap", onIap as EventListener);
    return () => window.removeEventListener("motivelife-iap", onIap as EventListener);
  }, []);

  async function checkout() {
    setLoading(true);
    setError("");
    try {
      if (isNativeShell()) {
        // Prefer StoreKit via native shell when RevenueCat keys are configured.
        if (window.__MOTIVELIFE_NATIVE_IAP__) {
          let userId: string | undefined;
          try {
            const status = await fetch("/api/subscription/status");
            const data = (await status.json()) as { userId?: string };
            userId = data.userId;
          } catch {
            // continue without user id
          }
          postNative({ type: "iap_purchase", userId });
          return;
        }
        setError(
          "In-app purchase is being set up. If you already subscribed on the web, sign in with the same account."
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
      if (!window.__MOTIVELIFE_NATIVE_IAP__) setLoading(false);
    }
  }

  return (
    <span className="inline-flex max-w-full flex-col gap-1">
      <button
        type="button"
        onClick={checkout}
        disabled={loading}
        className={cn(
          "font-semibold text-brand-purple hover:underline disabled:opacity-60",
          size === "md" &&
            "rounded-xl bg-brand-purple px-4 py-2 text-sm text-white hover:bg-brand-purple/90 hover:no-underline",
          className
        )}
      >
        {loading
          ? nativeIap
            ? "Opening App Store…"
            : "Opening checkout…"
          : nativeShell
            ? "Upgrade with App Store"
            : children}
      </button>
      {error ? <span className="text-xs text-amber-700">{error}</span> : null}
      <SubscriptionLegalDisclosure compact />
    </span>
  );
}
