"use client";

import { FAMILY_PLAN_PRICE_LABEL, FAMILY_PLAN_NAME } from "@/lib/subscription-display";
import { Lock, Sparkles } from "lucide-react";
import { buttonClassName } from "@/components/button";

/**
 * Upsell for Family Intelligence features on the free map tier.
 */
export function FamilyUpgradeCard({
  headline,
  body,
  canUpgrade,
  compact = false,
  onUpgraded,
}: {
  headline: string;
  body: string;
  canUpgrade: boolean;
  compact?: boolean;
  onUpgraded?: () => void;
}) {
  async function startCheckout() {
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "family" }),
      });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !data?.url) {
        window.alert(data?.error ?? "Could not start checkout.");
        return;
      }
      onUpgraded?.();
      window.location.href = data.url;
    } catch {
      window.alert("Could not start checkout. Check your connection.");
    }
  }

  return (
    <div
      className={`rounded-2xl border border-forward-200 bg-forward-50 ${
        compact ? "px-3 py-2.5" : "px-4 py-3.5"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forward-900 text-white">
          <Lock className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-forward-900">
            <Sparkles className="h-3.5 w-3.5 text-brand-blue" />
            {headline || "Unlock Family Intelligence"}
          </p>
          <p className="mt-1 text-xs leading-snug text-forward-600">
            {body ||
              `Free forever: live location + speed. ${FAMILY_PLAN_NAME} (${FAMILY_PLAN_PRICE_LABEL} via Stripe) unlocks history, Drive Score, Inbox, and AI insights — and includes Pro for the owner.`}
          </p>
          {canUpgrade ? (
            <button
              type="button"
              onClick={() => void startCheckout()}
              className={buttonClassName({
                className: "mt-2.5 w-full sm:w-auto",
              })}
            >
              Unlock {FAMILY_PLAN_NAME} · {FAMILY_PLAN_PRICE_LABEL}
            </button>
          ) : (
            <p className="mt-2 text-[11px] font-medium text-forward-700">
              Ask the household owner to upgrade — then intelligence unlocks for everyone.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
