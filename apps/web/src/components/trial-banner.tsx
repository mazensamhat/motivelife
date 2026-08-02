"use client";

import { useEffect, useState } from "react";
import { UpgradeButton } from "./upgrade-button";

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
          <span className="font-semibold text-forward-900">MyMotiveLife Pro trial</span> — {daysLeft}{" "}
          day{daysLeft === 1 ? "" : "s"} left.{" "}
          <UpgradeButton className="inline font-medium">
            Subscribe to Pro — $14.99/mo
          </UpgradeButton>
          {" · "}
          <a href="/family" className="font-medium text-brand-blue underline-offset-2 hover:underline">
            MyMotiveFamily $19.99/mo
          </a>
        </p>
      </div>
    );
  }

  if (mode === "expired") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Your trial ended.{" "}
        <UpgradeButton className="font-medium underline-offset-2 hover:underline">
          Upgrade to Pro — $14.99/mo
        </UpgradeButton>
        {" or "}
        <a href="/family" className="font-medium underline-offset-2 hover:underline">
          MyMotiveFamily — $19.99/mo
        </a>{" "}
        for AI coaching plus household Family Intelligence.
      </div>
    );
  }

  return null;
}
