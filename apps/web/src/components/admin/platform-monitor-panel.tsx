"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Server } from "lucide-react";
import { Button } from "@/components/button";
import type { PlatformCard, PlatformMonitorSnapshot } from "@/lib/platform-monitor";

function statusColor(status: PlatformCard["status"]) {
  if (status === "healthy") return "border-emerald-500/30 bg-emerald-500/5";
  if (status === "warn") return "border-amber-500/30 bg-amber-500/5";
  if (status === "error") return "border-red-500/30 bg-red-500/5";
  return "border-forward-700 bg-forward-950/50";
}

function StatusDot({ status }: { status: PlatformCard["status"] }) {
  const color =
    status === "healthy"
      ? "bg-emerald-400"
      : status === "warn"
        ? "bg-amber-400"
        : status === "error"
          ? "bg-red-400"
          : "bg-forward-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function PlatformTile({ platform }: { platform: PlatformCard }) {
  return (
    <article className={`rounded-xl border p-4 ${statusColor(platform.status)}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <StatusDot status={platform.status} />
            <h3 className="font-semibold text-white">{platform.name}</h3>
          </div>
          <p className="mt-1 text-sm text-forward-400">{platform.summary}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          {platform.dashboardUrl && (
            <a
              href={platform.dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-forward-700 px-2 py-1 text-xs text-forward-300 hover:border-forward-500 hover:text-white"
              title="Open dashboard"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>

      {platform.metrics.length > 0 && (
        <dl className="mb-3 grid grid-cols-2 gap-2 text-xs">
          {platform.metrics.map((m) => (
            <div key={m.label} className="rounded-lg bg-forward-950/60 px-2 py-1.5">
              <dt className="text-forward-500">{m.label}</dt>
              <dd className="font-medium text-forward-100">{m.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <ul className="space-y-1 text-xs">
        {platform.checklist.map((item) => (
          <li key={item.label} className={item.ok ? "text-emerald-300/90" : "text-amber-300/90"}>
            {item.ok ? "✓" : "○"} {item.label}
            {item.detail ? ` — ${item.detail}` : ""}
          </li>
        ))}
      </ul>

      {platform.billingUrl && (
        <a
          href={platform.billingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs text-brand-cyan hover:underline"
        >
          Billing & usage →
        </a>
      )}
    </article>
  );
}

export function PlatformMonitorPanel() {
  const [data, setData] = useState<PlatformMonitorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/platforms");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Could not load platforms (HTTP ${res.status})`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="mb-6 rounded-xl border border-forward-800 bg-forward-900/60 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Server size={18} className="text-brand-cyan" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-forward-400">
            Platform monitor
          </h2>
        </div>
        <Button variant="secondary" onClick={load} disabled={loading} className="text-xs">
          <RefreshCw size={14} className={`mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <p className="mb-4 text-sm text-forward-400">
        Live status for Stripe, Supabase, Vercel, Google AI (tier + limits), Resend, and other AI keys.
        Set <code className="text-forward-300">GOOGLE_AI_TIER</code> to{" "}
        <code className="text-forward-300">free</code>, <code className="text-forward-300">paygo</code>, or{" "}
        <code className="text-forward-300">enterprise</code> to match your AI Studio plan.
      </p>

      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
      {loading && !data ? (
        <p className="text-sm text-forward-500">Loading platforms…</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {data?.platforms.map((p) => <PlatformTile key={p.id} platform={p} />)}
        </div>
      )}
    </section>
  );
}
