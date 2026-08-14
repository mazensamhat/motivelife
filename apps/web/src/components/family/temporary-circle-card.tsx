"use client";

import { useState } from "react";
import { Clock, Users } from "lucide-react";
import { Button } from "@/components/button";
import { FamilyUpgradeCard } from "@/components/family/family-upgrade-card";
import type { FamilyEntitlements } from "@forward/shared";
import { FAMILY_BUBBLE_CARD } from "@/lib/family-map/ui-theme";

const DURATIONS = [
  { minutes: 120, label: "2 hours" },
  { minutes: 240, label: "4 hours" },
  { minutes: 480, label: "8 hours" },
  { minutes: 1440, label: "24 hours" },
  { minutes: 2880, label: "This weekend" },
] as const;

/**
 * Temporary Circle — share location for a limited window (Life360 weekend circle).
 * Requires Family Intelligence (paid).
 */
export function TemporaryCircleCard({
  entitlements,
  busy,
  onCreated,
  onRefreshMap,
}: {
  entitlements: FamilyEntitlements;
  busy?: boolean;
  onCreated?: (inviteCode: string) => void;
  onRefreshMap?: () => void;
}) {
  const [durationMin, setDurationMin] = useState(240);
  const [name, setName] = useState("Weekend circle");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);

  if (!entitlements.intelligence) {
    return (
      <FamilyUpgradeCard
        headline="Temporary Circles"
        body="Create a short-lived circle for this weekend or a visit — upgrade to unlock."
        canUpgrade={entitlements.canUpgrade}
        compact
        onUpgraded={onRefreshMap}
      />
    );
  }

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/circles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Temporary circle",
          type: "CUSTOM",
          shareMinutes: durationMin,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        circle?: { inviteCode?: string };
        inviteCode?: string;
      } | null;
      if (!res.ok) {
        setError(data?.error ?? "Could not create temporary circle.");
        return;
      }
      const code = data?.circle?.inviteCode ?? data?.inviteCode ?? null;
      if (code) {
        setLastCode(code);
        onCreated?.(code);
      }
    } catch {
      setError("Could not create temporary circle.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className={`${FAMILY_BUBBLE_CARD} max-[420px]:p-3 sm:p-4`}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-800 sm:h-10 sm:w-10">
          <Users className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold text-forward-900">
            Temporary Circle
          </h3>
          <p className="mt-0.5 text-xs leading-snug text-forward-500">
            Share location for a set time — weekends, guests, or a group trip.
          </p>
        </div>
      </div>

      <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-forward-500">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-forward-200 px-3 py-2 text-sm font-medium normal-case tracking-normal text-forward-900"
          maxLength={40}
        />
      </label>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-forward-500">
        How long
      </p>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5 min-[380px]:flex min-[380px]:flex-wrap">
        {DURATIONS.map((d) => (
          <button
            key={d.minutes}
            type="button"
            onClick={() => setDurationMin(d.minutes)}
            className={`inline-flex min-h-[2rem] items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${
              durationMin === d.minutes
                ? "bg-forward-900 text-white"
                : "bg-forward-100 text-forward-700"
            }`}
          >
            <Clock className="h-3 w-3 shrink-0" />
            <span className="truncate">{d.label}</span>
          </button>
        ))}
      </div>

      {error ? <p className="mt-2 text-xs text-amber-800">{error}</p> : null}
      {lastCode ? (
        <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          Circle ready — invite code{" "}
          <span className="font-mono font-semibold">{lastCode}</span>
        </p>
      ) : null}

      <Button
        type="button"
        className="mt-3 w-full"
        disabled={busy || creating}
        onClick={() => void create()}
      >
        {creating ? "Creating…" : "Create temporary Circle"}
      </Button>
    </section>
  );
}
