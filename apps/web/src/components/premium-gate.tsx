"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LockedModulePreview } from "./locked-module-preview";
import { LifeProLockedPreview } from "./life-pro-locked-preview";
import { LOCK_COPY } from "@/lib/marketing-copy";

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

  const copy = eligibleForMemberPro ? LOCK_COPY.memberTwin : LOCK_COPY.lifePro;
  const body = eligibleForMemberPro
    ? `${feature} and your private Digital Twin stay behind Twin Pro — only you see it.`
    : `${copy.body} ${feature} unlocks with Pro.`;
  const note = eligibleForMemberPro
    ? `Family Map stays free. ${memberProPriceLabel}.`
    : copy.note;
  const cta = eligibleForMemberPro
    ? `Unlock Twin — ${memberProPriceLabel}`
    : copy.cta;

  return (
    <LockedModulePreview
      title={copy.title}
      body={body}
      note={note}
      cta={cta}
      onUnlock={() => {
        window.location.href = "/settings";
      }}
    >
      <LifeProLockedPreview />
    </LockedModulePreview>
  );
}
