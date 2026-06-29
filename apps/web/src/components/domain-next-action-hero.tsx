"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import type { DomainNextAction } from "@forward/shared";
import type { DomainSlug } from "@/lib/domain-next-action";
import { readApiError, readApiJson } from "@/lib/fetch-api";
import { cn } from "@/lib/utils";

export function DomainNextActionHero({ domain }: { domain: DomainSlug }) {
  const [action, setAction] = useState<DomainNextAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [celebration, setCelebration] = useState<{ scoreGain: number; message: string } | null>(
    null
  );

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/next-action?domain=${domain}`)
      .then(async (res) => {
        const data = await readApiJson<{ action?: DomainNextAction }>(res);
        if (res.ok && data?.action) setAction(data.action);
        else if (!res.ok) console.error(await readApiError(res));
      })
      .finally(() => setLoading(false));
  }, [domain]);

  useEffect(() => {
    load();
  }, [load]);

  async function markDone() {
    if (!action || completing) return;
    setCompleting(true);
    try {
      const res = await fetch("/api/next-action/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          title: action.title,
          actionHref: action.actionHref,
          entityId: action.entityId,
        }),
      });
      const data = await readApiJson<{
        scoreGain?: number;
        message?: string;
        nextAction?: DomainNextAction;
      }>(res);
      if (res.ok && data) {
        setCelebration({
          scoreGain: data.scoreGain ?? 3,
          message: data.message ?? "+3 Motive Life Score",
        });
        if (data.nextAction) {
          setTimeout(() => {
            setCelebration(null);
            setAction(data.nextAction!);
          }, 2200);
        } else {
          setTimeout(() => {
            setCelebration(null);
            load();
          }, 2200);
        }
      }
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return <div className="h-36 animate-pulse rounded-2xl bg-forward-100" />;
  }

  if (!action) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-blue/25 bg-gradient-to-br from-brand-blue/5 via-white to-brand-cyan/5 shadow-sm">
      <div className="px-5 py-6 sm:px-6">
        {celebration ? (
          <div className="py-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-green/15">
              <Check className="h-7 w-7 text-brand-green" />
            </div>
            <p className="mt-4 text-lg font-semibold text-forward-900">Done.</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-brand-green">
              +{celebration.scoreGain}
            </p>
            <p className="text-sm text-forward-500">Added to your Life Timeline</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-blue" />
              <p className="text-xs font-semibold uppercase tracking-widest text-forward-500">
                What&apos;s the next best thing you can do?
              </p>
            </div>
            <p className="mt-4 text-xl font-semibold text-forward-900 sm:text-2xl">{action.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-forward-600">{action.reason}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={markDone}
                disabled={completing}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl bg-brand-green px-5 py-2.5 text-sm font-semibold text-forward-950 transition-colors hover:bg-brand-green/90 disabled:opacity-60"
                )}
              >
                <Check className="h-4 w-4" />
                {completing ? "Saving…" : "Done"}
              </button>
              <Link
                href={action.actionHref}
                className="inline-flex items-center gap-2 rounded-xl border border-forward-200 bg-white px-5 py-2.5 text-sm font-semibold text-forward-800 transition-colors hover:bg-forward-50"
              >
                {action.actionLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
