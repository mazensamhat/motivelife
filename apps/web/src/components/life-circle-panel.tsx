"use client";

import Link from "next/link";
import { useState } from "react";
import type { LifeCircleMemberPayload, LifeEngineStreakPayload } from "@forward/shared";
import {
  formatCircleCheerMessage,
  formatCircleHelloMessage,
  formatCircleNudgeMessage,
  initialsForName,
  moodEmoji,
  relationshipLabel,
} from "@/lib/life-circle";
import { Button } from "./button";
import { Flame, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type CircleNode = {
  id: string;
  name: string;
  relationship: LifeCircleMemberPayload["relationship"];
  linked: boolean;
  avatarUrl?: string | null;
  activity?: LifeCircleMemberPayload["activity"];
};

function memberStatus(member: CircleNode): string {
  if (!member.linked) return "Invite pending";
  if (member.activity?.statusLabel) return member.activity.statusLabel;
  if (member.activity?.completedToday) return "Moved life forward today";
  if (member.activity?.atRisk) return "Streak at risk";
  return "Checking in soon";
}

function positionOnRing(index: number, total: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  const radius = 42;
  return {
    left: `${50 + radius * Math.cos(angle)}%`,
    top: `${50 + radius * Math.sin(angle)}%`,
  };
}

function AvatarBubble({
  name,
  avatarUrl,
  relationship,
  linked,
  selected,
  completedToday,
  mood,
  size = "md",
  onClick,
}: {
  name: string;
  avatarUrl?: string | null;
  relationship?: LifeCircleMemberPayload["relationship"];
  linked?: boolean;
  selected?: boolean;
  completedToday?: boolean;
  mood?: string | null;
  size?: "lg" | "md";
  onClick?: () => void;
}) {
  const dim = size === "lg" ? "h-20 w-20 text-lg" : "h-14 w-14 text-sm";
  const emoji = moodEmoji(mood);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex shrink-0 flex-col items-center transition-transform",
        onClick && "hover:scale-105",
        selected && "scale-105"
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full border-2 font-bold shadow-sm",
          dim,
          !avatarUrl &&
            (relationship === "FAMILY"
              ? "border-brand-purple/40 bg-brand-purple/15 text-brand-purple"
              : relationship === "FRIEND"
                ? "border-brand-cyan/40 bg-brand-cyan/15 text-brand-cyan"
                : "border-brand-green/50 bg-brand-green/15 text-brand-green"),
          !linked && "border-dashed opacity-70",
          completedToday && linked && "ring-2 ring-brand-green/60 ring-offset-2",
          selected && "ring-2 ring-brand-blue ring-offset-2"
        )}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initialsForName(name)
        )}
      </span>
      {emoji && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs shadow">
          {emoji}
        </span>
      )}
      {completedToday && linked && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-green text-[10px] text-white">
          ✓
        </span>
      )}
    </button>
  );
}

export function LifeCirclePanel({
  members,
  userName,
  userAvatarUrl,
  userCompletedToday,
  userStreak,
}: {
  members: LifeCircleMemberPayload[];
  userName?: string | null;
  userAvatarUrl?: string | null;
  userCompletedToday?: boolean;
  userStreak?: LifeEngineStreakPayload;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  if (members.length === 0) return null;

  const youName = userName?.split(" ")[0] ?? "You";
  const nodes: CircleNode[] = members.map((m) => ({
    id: m.id,
    name: m.activity?.name ?? m.displayName,
    relationship: m.relationship,
    linked: Boolean(m.linkedUserId),
    avatarUrl: m.avatarUrl,
    activity: m.activity ?? undefined,
  }));

  const selected = selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null;

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

  const cheer = selected?.linked && selected.activity?.completedToday && !userCompletedToday;
  const nudge = selected?.linked && userCompletedToday && !selected.activity?.completedToday;

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-cyan/20 bg-gradient-to-br from-white via-brand-cyan/5 to-brand-blue/5 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-brand-cyan/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-cyan" />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-cyan">My Life Circle</p>
            <p className="text-[11px] text-forward-500">
              {nodes.filter((n) => n.linked).length} connected · {nodes.length} in your circle
            </p>
          </div>
        </div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-brand-cyan shadow-sm ring-1 ring-brand-cyan/20 hover:bg-brand-cyan/5"
        >
          <Plus className="h-3 w-3" />
          Invite
        </Link>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-sm px-4 py-6">
        <div className="absolute inset-8 rounded-full border border-dashed border-brand-cyan/25" />
        <div className="absolute inset-[18%] rounded-full border border-brand-cyan/10 bg-white/40" />

        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="flex flex-col items-center">
            <AvatarBubble
              name={youName}
              avatarUrl={userAvatarUrl}
              size="lg"
              completedToday={userCompletedToday}
              selected={selectedId === null}
              onClick={() => setSelectedId(null)}
            />
            <p className="mt-2 text-sm font-semibold text-forward-900">You</p>
            {userStreak && userStreak.currentStreak > 0 && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-forward-500">
                <Flame className="h-3 w-3 text-orange-500" />
                {userStreak.currentStreak}-day streak
              </p>
            )}
          </div>
        </div>

        {nodes.map((member, index) => {
          const pos = positionOnRing(index, nodes.length);
          return (
            <div
              key={member.id}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={pos}
            >
              <div className="flex flex-col items-center">
                <AvatarBubble
                  name={member.name}
                  avatarUrl={member.avatarUrl}
                  relationship={member.relationship}
                  linked={member.linked}
                  completedToday={member.activity?.completedToday}
                  mood={member.activity?.mood}
                  selected={selectedId === member.id}
                  onClick={() => setSelectedId(member.id)}
                />
                <p className="mt-1.5 max-w-[4.5rem] truncate text-center text-[11px] font-semibold text-forward-800">
                  {member.name}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="border-t border-brand-cyan/10 bg-white/70 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-forward-900">{selected.name}</p>
                <span className="rounded-full bg-forward-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-forward-500">
                  {relationshipLabel(selected.relationship)}
                </span>
                {!selected.linked && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    Pending
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-forward-600">{memberStatus(selected)}</p>
              {selected.activity && selected.activity.currentStreak > 0 && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-forward-500">
                  <Flame className="h-3 w-3 text-orange-500" />
                  {selected.activity.currentStreak}-day streak
                </p>
              )}
            </div>

            {selected.linked && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-brand-purple"
                  onClick={() =>
                    sendMessage("hello", formatCircleHelloMessage(selected.name, userName ?? null))
                  }
                >
                  {sent === "hello" ? "Sent!" : "Say hello"}
                </Button>
                {cheer && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-brand-cyan"
                    onClick={() =>
                      sendMessage("cheer", formatCircleCheerMessage(selected.name, userName ?? null))
                    }
                  >
                    {sent === "cheer" ? "Sent!" : "Cheer"}
                  </Button>
                )}
                {nudge && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-brand-blue"
                    onClick={() =>
                      sendMessage("nudge", formatCircleNudgeMessage(selected.name, userName ?? null))
                    }
                  >
                    {sent === "nudge" ? "Sent!" : "Nudge"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
