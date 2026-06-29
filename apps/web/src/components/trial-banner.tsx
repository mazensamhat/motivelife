"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function TrialBanner() {
  const [mode, setMode] = useState<"trial" | "expired" | null>(null);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/subscription/status")
      .then((r) => r.json())
      .then((data) => {
        const sub = data.subscription;
        if (!sub) return;
        if (sub.plan === "trial" && sub.isPremium && sub.trialDaysLeft != null) {
          setMode("trial");
          setDaysLeft(sub.trialDaysLeft);
        } else if (!sub.isPremium && sub.plan === "free") {
          setMode("expired");
        }
      })
      .catch(() => {});
  }, []);

  if (mode === "trial" && daysLeft != null) {
    return (
      <div className="rounded-xl border border-brand-purple/20 bg-brand-purple/5 px-4 py-3 text-sm">
        <p>
          <span className="font-semibold text-forward-900">MotiveLife Pro trial</span> — {daysLeft}{" "}
          day{daysLeft === 1 ? "" : "s"} left.{" "}
          <Link href="/settings" className="font-medium text-brand-purple hover:underline">
            Upgrade to Pro
          </Link>
        </p>
      </div>
    );
  }

  if (mode === "expired") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Your trial ended.{" "}
        <Link href="/settings" className="font-medium underline-offset-2 hover:underline">
          Upgrade to Pro — $14.99/mo
        </Link>{" "}
        for AI coaching, weekly letters, and full voice organize.
      </div>
    );
  }

  return null;
}
