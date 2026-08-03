"use client";

import type { ReactNode } from "react";
import { Activity, Brain, Car, Inbox, MapPinned } from "lucide-react";
import { LockedModulePreview } from "@/components/locked-module-preview";
import { LOCK_COPY } from "@/lib/marketing-copy";

/** Sample AI modules behind a lock — map stays free; this is the “oh my god” tease. */
export function FamilyIntelLockedPreview({
  canUpgrade,
  onUpgraded,
}: {
  canUpgrade: boolean;
  onUpgraded?: () => void;
}) {
  const copy = canUpgrade ? LOCK_COPY.familyIntelOwner : LOCK_COPY.familyIntelMemberWaiting;

  async function startCheckout() {
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "family" }),
      });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !data?.url) {
        window.alert(data?.error ?? "Could not start checkout.");
        return;
      }
      onUpgraded?.();
      window.location.href = data.url;
    } catch {
      window.alert("Could not start checkout. Check your connection.");
    }
  }

  return (
    <div className="space-y-3">
      <LockedModulePreview
        title={copy.title}
        body={copy.body}
        note={copy.note}
        cta={copy.cta}
        onUnlock={canUpgrade ? () => void startCheckout() : undefined}
      >
        <div className="space-y-3 p-3">
          <div className="grid grid-cols-2 gap-2">
            <PreviewKpi
              icon={<Activity className="h-3 w-3" />}
              label="Family Flow"
              value="Everyone home ~8:06"
              detail="Dad late · Mom nearby"
            />
            <PreviewKpi
              icon={<Brain className="h-3 w-3" />}
              label="Something’s Different"
              value="Riley still at soccer"
              detail="Usual leave 7:25–7:40"
            />
            <PreviewKpi
              icon={<MapPinned className="h-3 w-3" />}
              label="Place Intel"
              value="Costco · 14 visits"
              detail="Jordan ETA 11 min"
            />
            <PreviewKpi
              icon={<Car className="h-3 w-3" />}
              label="Drive Score"
              value="91 · Safe"
              detail="3 pts above usual"
            />
          </div>
          <div className="rounded-xl border border-forward-100 bg-forward-50 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-forward-500">
              <Inbox className="h-3 w-3" />
              Inbox
            </p>
            <p className="mt-1 text-sm font-semibold text-forward-900">
              AI noticed something
            </p>
            <p className="mt-0.5 text-xs text-forward-600">
              Battery 14% · No calendar change · Unusual — not an emergency
            </p>
          </div>
          <div className="rounded-xl border border-forward-100 bg-forward-50 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-forward-500">
              Weekly Driving Report
            </p>
            <p className="mt-1 text-sm font-semibold text-forward-900">
              12 drives · 186 km · Top speed 94
            </p>
            <p className="mt-0.5 text-xs text-forward-600">
              Hard brakes 2 · Phone events 1 · Avg score 88
            </p>
          </div>
        </div>
      </LockedModulePreview>
    </div>
  );
}

function PreviewKpi({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-forward-100 bg-forward-50/80 px-3 py-2.5 text-left">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-forward-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-forward-900">{value}</p>
      <p className="mt-0.5 text-[11px] text-forward-600">{detail}</p>
    </div>
  );
}
