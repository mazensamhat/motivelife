"use client";

import { useEffect, useState } from "react";

type SubscriptionStatus = {
  plan: "trial" | "plus" | "free";
  isPremium: boolean;
  trialDaysLeft: number | null;
};

export function useSubscriptionStatus() {
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/subscription/status")
      .then((r) => r.json())
      .then((data) => {
        const s = data.subscription;
        if (!s) return;
        setSub({
          plan: s.plan,
          isPremium: Boolean(s.isPremium),
          trialDaysLeft: s.trialDaysLeft ?? null,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isTrial = sub?.plan === "trial" && sub.isPremium;

  return { ...sub, isTrial, loading };
}
