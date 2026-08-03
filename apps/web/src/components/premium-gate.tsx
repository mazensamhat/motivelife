"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "./button";

export function PremiumGate({
  children,
  feature = "Adaptive coaching loops",
}: {
  children: ReactNode;
  feature?: string;
}) {
  const [allowed, setAllowed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [eligibleForMemberPro, setEligibleForMemberPro] = useState(false);
  const [memberProPriceLabel, setMemberProPriceLabel] = useState("+$5 CAD/month");

  useEffect(() => {
    fetch("/api/subscription/status")
      .then((r) => r.json())
      .then((data) => {
        setAllowed(Boolean(data.subscription?.isPremium));
        setEligibleForMemberPro(Boolean(data.eligibleForMemberPro));
        if (typeof data.memberProPriceLabel === "string") {
          setMemberProPriceLabel(data.memberProPriceLabel);
        }
      })
      .catch(() => setAllowed(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-24 animate-pulse rounded-xl bg-forward-100" />;
  if (allowed) return children;

  return (
    <div className="rounded-xl border border-forward-200 bg-forward-50 px-4 py-4 text-sm">
      <p className="font-semibold text-forward-900">MyMotiveLife Pro required</p>
      <p className="mt-1 text-forward-600">
        {eligibleForMemberPro
          ? `${feature} and your private Digital Twin stay behind Pro. As a family member, unlock Twin Pro for ${memberProPriceLabel} — Family Map stays free.`
          : `Your trial ended. ${feature} and Life XP growth stay available on Pro — or choose MyMotiveFamily ($19.99/mo) for Pro plus household intelligence.`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/settings">
          <Button size="sm">
            {eligibleForMemberPro ? `Upgrade Twin — ${memberProPriceLabel}` : "Upgrade in Settings"}
          </Button>
        </Link>
        {!eligibleForMemberPro ? (
          <Link href="/family">
            <Button size="sm" variant="secondary">
              MyMotiveFamily
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
