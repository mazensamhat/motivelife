"use client";

import { Sparkles } from "lucide-react";
import { UpgradeButton } from "./upgrade-button";
import { useSubscriptionStatus } from "@/hooks/use-subscription-status";
import { cn } from "@/lib/utils";

const COPY = {
  mission: {
    headline: "You're building real momentum.",
    body: "Keep your chief of staff, weekly letters, and voice coach after trial — lock in Pro now.",
  },
  momentum: {
    headline: "Streaks like this are why people stay on Pro.",
    body: "Don't lose Momentum Engine coaching and streak freezes when your trial ends.",
  },
  "weekly-letter": {
    headline: "Sunday letters are a Pro superpower.",
    body: "Your AI weekly review, voice recap, and next-week mission — stay subscribed to keep them.",
  },
} as const;

export function PremiumUpgradeNudge({
  context,
  className,
}: {
  context: keyof typeof COPY;
  className?: string;
}) {
  const { isTrial, trialDaysLeft, loading } = useSubscriptionStatus();

  if (loading || !isTrial) return null;

  const { headline, body } = COPY[context];
  const days =
    trialDaysLeft != null
      ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in trial`
      : null;

  return (
    <div
      className={cn(
        "rounded-xl border border-brand-purple/25 bg-gradient-to-r from-brand-purple/8 to-brand-cyan/5 px-4 py-3 text-sm",
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-purple" />
        <div className="min-w-0">
          <p className="font-semibold text-forward-900">{headline}</p>
          <p className="mt-1 text-forward-600">{body}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <UpgradeButton>Upgrade to MyMotiveLife Pro — $14.99/mo</UpgradeButton>
            <a
              href="/family"
              className="font-medium text-brand-blue underline-offset-2 hover:underline"
            >
              or MyMotiveFamily — $19.99/mo
            </a>
            {days ? <span className="text-forward-500">{days}</span> : null}
          </p>
        </div>
      </div>
    </div>
  );
}
