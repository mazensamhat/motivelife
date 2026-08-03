"use client";

import { LOCK_COPY } from "@/lib/marketing-copy";
import { Lock, Sparkles } from "lucide-react";
import { buttonClassName } from "@/components/button";

/**
 * Life360-style lock for Family Intelligence on the free map tier.
 * Live map stays fully usable — only intelligence modules show this.
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
  const copy = canUpgrade ? LOCK_COPY.familyIntelOwner : LOCK_COPY.familyIntelMemberWaiting;

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
            {headline || copy.title}
          </p>
          <p className="mt-1 text-xs leading-snug text-forward-600">{body || copy.body}</p>
          {copy.note ? (
            <p className="mt-1 text-[11px] text-forward-500">{copy.note}</p>
          ) : null}
          {canUpgrade && copy.cta ? (
            <button
              type="button"
              onClick={() => void startCheckout()}
              className={buttonClassName({
                className: "mt-2.5 w-full sm:w-auto",
              })}
            >
              {copy.cta}
            </button>
          ) : !canUpgrade ? (
            <p className="mt-2 text-[11px] font-medium text-forward-700">{copy.body}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
