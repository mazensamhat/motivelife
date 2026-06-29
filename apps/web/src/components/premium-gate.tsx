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

  useEffect(() => {
    fetch("/api/subscription/status")
      .then((r) => r.json())
      .then((data) => setAllowed(Boolean(data.subscription?.isPremium)))
      .catch(() => setAllowed(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-24 animate-pulse rounded-xl bg-forward-100" />;
  if (allowed) return children;

  return (
    <div className="rounded-xl border border-forward-200 bg-forward-50 px-4 py-4 text-sm">
      <p className="font-semibold text-forward-900">MotiveLife Pro required</p>
      <p className="mt-1 text-forward-600">
        Your trial ended. {feature} and Life XP growth stay available on Pro.
      </p>
      <Link href="/settings" className="mt-3 inline-block">
        <Button size="sm">Upgrade in Settings</Button>
      </Link>
    </div>
  );
}
