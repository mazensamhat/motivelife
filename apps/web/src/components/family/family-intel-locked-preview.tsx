"use client";

import type { ReactNode } from "react";
import type { FamilyMapState } from "@forward/shared";
import {
  Activity,
  Brain,
  Car,
  ChevronRight,
  Fuel,
  MapPinned,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { LockedModulePreview } from "@/components/locked-module-preview";
import { LOCK_COPY } from "@/lib/marketing-copy";

/**
 * Full Family Intelligence UI shown blurred + locked.
 * Uses the Tim trial sample so the tease is always rich and stable.
 * Live map stays free above this.
 */
export function FamilyIntelLockedPreview({
  canUpgrade,
  onUpgraded,
  state: _state,
}: {
  canUpgrade: boolean;
  onUpgraded?: () => void;
  /** Reserved — real household data may power the tease later. */
  state?: FamilyMapState | null;
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
    <LockedModulePreview
      title={copy.title}
      body={copy.body}
      note={copy.note}
      cta={copy.cta}
      onUnlock={canUpgrade ? () => void startCheckout() : undefined}
    >
      <TimTrialIntelSample />
    </LockedModulePreview>
  );
}

/** Trial persona sample — Tim — mirrors the real Family Intelligence layout. */
function TimTrialIntelSample() {
  return (
    <section className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-forward-900">
            Family Intelligence
          </h3>
          <p className="mt-0.5 text-xs text-forward-500">
            Live map plus what the household’s movement is teaching us — driving, fuel,
            visits, and shopping.
          </p>
        </div>
        <Brain className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Chip label="Drive score" value="72/100" tone="neutral" />
        <Chip label="Fuel (month)" value="$3.21" tone="watch" />
        <Chip label="Visits today" value="24" tone="neutral" />
        <Chip label="Shopping" value="None yet" tone="neutral" />
      </div>

      <ul className="mt-3 space-y-1.5 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2.5 text-xs leading-snug text-forward-800">
        {[
          "Everyone is home",
          "Driving habits: 1.3 km recent · 21 hard brakes · 22 rapid accel · 21 unusual stops · top 70 km/h",
          "Fuel up vs last month: $3.21 this month across 44 trips. Vehicle: Gasoline · ~9.4 L/100 km (estimated).",
          "Today’s places: Home… · 2 still there",
          "Something’s different: Tim — Something’s different",
        ].map((line) => (
          <li key={line} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-blue" />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <PreviewKpi
          icon={<Activity className="h-3 w-3" />}
          label="Family Flow"
          value="Everyone is home"
          detail="3 live on map"
        />
        <PreviewKpi
          icon={<Sparkles className="h-3 w-3" />}
          label="Different"
          value="Tim"
          detail="Something’s different"
        />
        <PreviewKpi
          icon={<MapPinned className="h-3 w-3" />}
          label="Places"
          value="24 today"
          detail="47 visits · avg 8 min stay"
        />
        <PreviewKpi
          icon={<Car className="h-3 w-3" />}
          label="Driving"
          value="72/100"
          detail="21 brakes · 22 accel · max 70"
        />
        <PreviewKpi
          icon={<Fuel className="h-3 w-3" />}
          label="Fuel"
          value="$3.21"
          detail="Gasoline · ~9.4 L/100 km"
        />
        <PreviewKpi
          icon={<ShoppingBag className="h-3 w-3" />}
          label="Shopping"
          value="None yet"
          detail="Save shops on the map"
        />
      </div>
    </section>
  );
}

function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "watch" | "good";
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        tone === "good"
          ? "border-emerald-100 bg-emerald-50/70"
          : tone === "watch"
            ? "border-amber-100 bg-amber-50/70"
            : "border-forward-100 bg-forward-50/70"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-forward-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-forward-900">{value}</p>
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
    <div className="rounded-xl border border-forward-100 bg-forward-50/60 px-3 py-2.5 text-left">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-forward-500">
          {icon}
          {label}
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-forward-400" />
      </div>
      <p className="mt-1 text-sm font-semibold text-forward-900">{value}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-forward-600">{detail}</p>
    </div>
  );
}
