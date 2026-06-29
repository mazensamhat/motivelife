"use client";

import { useState } from "react";
import type { AccountabilityPartner, PartnerActivityPayload } from "@forward/shared";
import {
  formatPartnerCheerMessage,
  formatPartnerNudgeMessage,
} from "@/lib/accountability-partner";
import { Button } from "./button";
import { Flame, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function PartnerActivityPanel({
  partner,
  activity,
  userName,
  userCompletedToday,
}: {
  partner: AccountabilityPartner;
  activity: PartnerActivityPayload;
  userName?: string | null;
  userCompletedToday?: boolean;
}) {
  const [sent, setSent] = useState(false);

  if (!partner.linkedUserId) return null;

  async function sendMessage(text: string) {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text });
        setSent(true);
        setTimeout(() => setSent(false), 2000);
        return;
      } catch {
        /* fallback */
      }
    }
    await navigator.clipboard.writeText(text);
    setSent(true);
    setTimeout(() => setSent(false), 2000);
  }

  const cheer = activity.completedToday && !userCompletedToday;
  const nudge = userCompletedToday && !activity.completedToday;

  return (
    <div className="rounded-xl border border-brand-cyan/25 bg-gradient-to-r from-brand-cyan/5 to-brand-blue/5 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-cyan/15 text-brand-cyan">
            <Users className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-cyan">
              Accountability partner
            </p>
            <p className="mt-0.5 text-sm font-semibold text-forward-900">{activity.name}</p>
            <p className="mt-1 text-xs text-forward-600">
              {activity.completedToday ? (
                <span className="text-brand-green">Completed Life Engine today</span>
              ) : activity.atRisk ? (
                <span className="text-amber-600">Streak at risk today</span>
              ) : (
                <span>Hasn&apos;t checked in yet today</span>
              )}
              {activity.currentStreak > 0 && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <Flame className="h-3 w-3 text-orange-500" />
                  {activity.currentStreak}-day streak
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {cheer && (
            <Button
              size="sm"
              variant="ghost"
              className="text-brand-cyan"
              onClick={() =>
                sendMessage(formatPartnerCheerMessage(activity.name, userName ?? null))
              }
            >
              {sent ? "Sent!" : "Cheer them on"}
            </Button>
          )}
          {nudge && (
            <Button
              size="sm"
              variant="ghost"
              className={cn("text-brand-blue")}
              onClick={() =>
                sendMessage(formatPartnerNudgeMessage(activity.name, userName ?? null))
              }
            >
              {sent ? "Sent!" : "Nudge partner"}
            </Button>
          )}
        </div>
      </div>

      {cheer && (
        <p className="mt-2 text-xs text-forward-600">
          {activity.name} already moved today — match their energy.
        </p>
      )}
      {nudge && (
        <p className="mt-2 text-xs text-forward-600">
          You&apos;re done — help {activity.name} keep their streak alive.
        </p>
      )}
    </div>
  );
}
