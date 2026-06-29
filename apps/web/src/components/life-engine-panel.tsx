"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Flame, Shield, Sparkles, Zap } from "lucide-react";
import type { AccountabilityPartner, LifeEngineAction, LifeEngineStreakPayload } from "@forward/shared";
import { formatStreakShareMessage } from "@/lib/accountability-partner";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function LifeEnginePanel({
  action,
  streak,
  accountabilityPartner,
  userName,
  onComplete,
  onStreakChange,
}: {
  action: LifeEngineAction;
  streak?: LifeEngineStreakPayload;
  accountabilityPartner?: AccountabilityPartner | null;
  userName?: string | null;
  onComplete?: () => void;
  onStreakChange?: (streak: LifeEngineStreakPayload) => void;
}) {
  const [completing, setCompleting] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [shared, setShared] = useState(false);
  const [done, setDone] = useState(streak?.completedToday ?? false);
  const [localStreak, setLocalStreak] = useState(streak);

  async function handleDone() {
    if (!action.domainSlug || completing) return;
    setCompleting(true);
    try {
      const res = await fetch("/api/next-action/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: action.domainSlug,
          title: action.title,
          actionHref: action.actionHref,
          entityId: action.entityId,
          lifeEngine: true,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { lifeEngineStreak?: LifeEngineStreakPayload };
        setDone(true);
        if (json.lifeEngineStreak) {
          setLocalStreak(json.lifeEngineStreak);
          onStreakChange?.(json.lifeEngineStreak);
        }
        onComplete?.();
      }
    } finally {
      setCompleting(false);
    }
  }

  async function handleFreeze() {
    if (freezing || !localStreak?.canUseFreeze) return;
    setFreezing(true);
    try {
      const res = await fetch("/api/life-engine/streak/freeze", { method: "POST" });
      if (res.ok) {
        const json = (await res.json()) as LifeEngineStreakPayload;
        setLocalStreak(json);
        onStreakChange?.(json);
      }
    } finally {
      setFreezing(false);
    }
  }

  const streakCount = localStreak?.currentStreak ?? 0;
  const partner = accountabilityPartner?.name;

  async function shareWithPartner(via: "share" | "sms" | "copy") {
    if (!partner || streakCount < 1) return;
    const text = formatStreakShareMessage(partner, streakCount, userName ?? null);
    if (via === "sms" && typeof window !== "undefined") {
      window.location.href = `sms:?body=${encodeURIComponent(text)}`;
      return;
    }
    if (via === "share" && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* clipboard fallback */
      }
    }
    await navigator.clipboard.writeText(text);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-brand-green/40 bg-gradient-to-br from-forward-950 via-forward-900 to-forward-950 text-white shadow-xl">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-green/10 blur-2xl" />
      <div className="relative px-6 py-7 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
              <Zap className="h-3 w-3" />
              Life Engine™
            </span>
            <span className="text-[10px] uppercase tracking-wide text-forward-500">
              {action.sources.join(" · ")}
            </span>
          </div>

          {streakCount > 0 && (
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                done || localStreak?.completedToday
                  ? "bg-orange-500/20 text-orange-300"
                  : localStreak?.atRisk
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-forward-800 text-forward-300"
              )}
            >
              <Flame className="h-3.5 w-3.5" />
              {streakCount}-day streak
            </div>
          )}
        </div>

        {localStreak?.canUseFreeze && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            <Shield className="h-3.5 w-3.5 shrink-0" />
            <span>Your streak is at risk — use a freeze to keep it alive.</span>
            <button
              type="button"
              onClick={handleFreeze}
              disabled={freezing}
              className="ml-auto font-semibold text-amber-300 underline-offset-2 hover:underline disabled:opacity-50"
            >
              {freezing ? "Saving…" : `Use freeze (${localStreak.freezesRemaining} left)`}
            </button>
          </div>
        )}

        {partner && !done && streakCount > 0 && (
          <p className="mt-3 text-xs text-brand-cyan/90">
            {localStreak?.atRisk
              ? `${partner} is counting on your streak — complete today\u2019s action to keep it alive.`
              : `${partner} is your accountability partner — keep the ${streakCount}-day streak going.`}
          </p>
        )}

        <p className="mt-4 text-xs font-medium uppercase tracking-widest text-forward-400">
          The one thing
        </p>
        <h2 className="mt-1 text-2xl font-semibold leading-snug sm:text-3xl">{action.title}</h2>
        <p className="mt-3 text-sm text-forward-300">{action.reason}</p>
        <p className="mt-2 text-xs text-brand-cyan/90">{action.whyConnected}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {action.domainSlug && !done ? (
            <Button
              size="lg"
              className="gap-2 bg-brand-green text-forward-950 hover:bg-brand-green/90"
              disabled={completing}
              onClick={handleDone}
            >
              <Check className="h-4 w-4" />
              {completing ? "Done…" : action.actionLabel}
            </Button>
          ) : done ? (
            <span className="inline-flex items-center gap-2 rounded-xl bg-brand-green/20 px-4 py-2 text-sm font-semibold text-brand-green">
              <Sparkles className="h-4 w-4" />
              +{action.scoreGain} Motive Life Score
              {localStreak && localStreak.currentStreak > 0 && (
                <span className="text-forward-300">· {localStreak.currentStreak}-day streak</span>
              )}
            </span>
          ) : (
            <Link href={action.actionHref}>
              <Button size="lg" className="gap-2 bg-brand-green text-forward-950 hover:bg-brand-green/90">
                {action.actionLabel}
              </Button>
            </Link>
          )}
          {!done && (
            <Link
              href={action.actionHref}
              className="text-sm font-medium text-forward-400 hover:text-white"
            >
              Open details →
            </Link>
          )}
          {done && partner && streakCount > 0 && (
            <span className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => shareWithPartner("share")}
                className="text-sm font-medium text-brand-cyan hover:text-brand-cyan/80"
              >
                {shared ? "Copied!" : `Tell ${partner} →`}
              </button>
              <button
                type="button"
                onClick={() => shareWithPartner("sms")}
                className="text-sm font-medium text-forward-400 hover:text-white"
              >
                Text {partner}
              </button>
            </span>
          )}
        </div>

        <p className={cn("mt-4 text-xs text-forward-500", done && "text-brand-green/80")}>
          {done
            ? "Life Engine will pick your next action tomorrow."
            : streakCount === 0
              ? `+${action.scoreGain} potential · complete daily to start your streak`
              : `+${action.scoreGain} potential · everything else waits until this is done`}
        </p>
      </div>
    </section>
  );
}
