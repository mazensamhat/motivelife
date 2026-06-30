"use client";

import { useState } from "react";
import type { LifeCircleMemberPayload } from "@forward/shared";
import {
  formatCircleCheerMessage,
  formatCircleHelloMessage,
  formatCircleNudgeMessage,
  relationshipLabel,
} from "@/lib/life-circle";
import { Button } from "./button";
import { Flame, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function LifeCirclePanel({
  members,
  userName,
  userCompletedToday,
}: {
  members: LifeCircleMemberPayload[];
  userName?: string | null;
  userCompletedToday?: boolean;
}) {
  const linked = members.filter(
    (m): m is LifeCircleMemberPayload & { activity: NonNullable<LifeCircleMemberPayload["activity"]> } =>
      Boolean(m.linkedUserId && m.activity)
  );
  if (linked.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-brand-cyan" />
        <p className="text-xs font-bold uppercase tracking-widest text-brand-cyan">My Life Circle</p>
      </div>
      {linked.map((member) => (
        <CircleMemberRow
          key={member.id}
          member={member}
          userName={userName}
          userCompletedToday={userCompletedToday}
        />
      ))}
    </div>
  );
}

function CircleMemberRow({
  member,
  userName,
  userCompletedToday,
}: {
  member: LifeCircleMemberPayload & { activity: NonNullable<LifeCircleMemberPayload["activity"]> };
  userName?: string | null;
  userCompletedToday?: boolean;
}) {
  const [sent, setSent] = useState<string | null>(null);
  const activity = member.activity!;

  async function sendMessage(kind: "hello" | "cheer" | "nudge", text: string) {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text });
        setSent(kind);
        setTimeout(() => setSent(null), 2000);
        return;
      } catch {
        /* fallback */
      }
    }
    await navigator.clipboard.writeText(text);
    setSent(kind);
    setTimeout(() => setSent(null), 2000);
  }

  const cheer = activity.completedToday && !userCompletedToday;
  const nudge = userCompletedToday && !activity.completedToday;

  return (
    <div className="rounded-xl border border-brand-cyan/25 bg-gradient-to-r from-brand-cyan/5 to-brand-blue/5 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
              member.relationship === "FAMILY"
                ? "bg-brand-purple/15 text-brand-purple"
                : "bg-brand-cyan/15 text-brand-cyan"
            )}
          >
            {member.relationship === "FAMILY" ? "♥" : "★"}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-forward-900">{activity.name}</p>
              <span className="rounded-full bg-forward-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-forward-500">
                {relationshipLabel(member.relationship)}
              </span>
            </div>
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
          <Button
            size="sm"
            variant="ghost"
            className="text-brand-purple"
            onClick={() => sendMessage("hello", formatCircleHelloMessage(activity.name, userName ?? null))}
          >
            {sent === "hello" ? "Sent!" : "Say hello"}
          </Button>
          {cheer && (
            <Button
              size="sm"
              variant="ghost"
              className="text-brand-cyan"
              onClick={() => sendMessage("cheer", formatCircleCheerMessage(activity.name, userName ?? null))}
            >
              {sent === "cheer" ? "Sent!" : "Cheer"}
            </Button>
          )}
          {nudge && (
            <Button
              size="sm"
              variant="ghost"
              className="text-brand-blue"
              onClick={() => sendMessage("nudge", formatCircleNudgeMessage(activity.name, userName ?? null))}
            >
              {sent === "nudge" ? "Sent!" : "Nudge"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
