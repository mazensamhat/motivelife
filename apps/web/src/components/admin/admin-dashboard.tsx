"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActivityHeatmap } from "@/components/admin/activity-heatmap";
import { AdminUsersPanel } from "@/components/admin/admin-users-panel";
import { SignupGlobeMap } from "@/components/admin/signup-globe-map";
import { TrafficSocialPanel } from "@/components/admin/traffic-social-panel";
import {
  Activity,
  BarChart3,
  Brain,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Mic,
  RefreshCw,
  Shield,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/button";
import { BarList } from "@/components/admin/admin-bar-list";
import type { AdminDashboardSnapshot } from "@/lib/admin-analytics";
import type { TrafficAnalytics } from "@/lib/traffic-analytics";
import { MOTIVEFX_OPS_URL } from "@/lib/ops-links";

function OpsIconButton({
  href,
  external,
  onClick,
  label,
  children,
}: {
  href?: string;
  external?: boolean;
  onClick?: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-forward-700 bg-forward-800/80 text-forward-200 transition hover:border-forward-500 hover:bg-forward-700 hover:text-white";

  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={className}
        title={label}
        aria-label={label}
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} title={label} aria-label={label}>
      {children}
    </button>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        warn ? "border-amber-500/30 bg-amber-500/5" : "border-forward-800 bg-forward-900/60"
      }`}
    >
      <div className="mb-2 flex items-center gap-2 text-forward-400">
        <Icon size={16} />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <strong className="text-2xl font-semibold text-white">{value}</strong>
    </div>
  );
}

export function AdminDashboard({
  adminEmail,
  adminName,
}: {
  adminEmail: string;
  adminName: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<(AdminDashboardSnapshot & { traffic?: TrafficAnalytics }) | null>(
    null
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/dashboard");
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load (${res.status})`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-forward-400">Loading ops console…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4">
        <Shield size={32} className="text-amber-400" />
        <h1 className="text-xl font-semibold">Ops Console unavailable</h1>
        <p className="text-center text-sm text-forward-400">{error}</p>
        <p className="text-center text-xs text-forward-500">
          Set <code className="text-forward-300">ADMIN_EMAILS</code> in your env to your login email.
        </p>
        <Button onClick={load}>Retry</Button>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, demographics, payments, channelPerformance } = data;
  const maxSignup = Math.max(...data.signupsByDay.map((d) => d.count), 1);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-col gap-4 rounded-xl border border-forward-800 bg-forward-900/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-emerald-400">
            <Shield size={18} />
            <span className="text-xs font-semibold uppercase tracking-widest">MotiveLife Ops Console</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Platform intelligence</h1>
          <p className="mt-1 text-sm text-forward-400">
            Signed in as {adminName ?? adminEmail} · updated{" "}
            {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={load} disabled={loading} className="bg-forward-800 text-forward-100">
            <RefreshCw size={14} className="mr-1.5" />
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <div className="flex items-center gap-1.5 rounded-lg border border-forward-700 bg-forward-900/40 p-1">
            <OpsIconButton href="/dashboard" label="Customer app (normal user view)">
              <LayoutDashboard size={16} />
            </OpsIconButton>
            <OpsIconButton href={MOTIVEFX_OPS_URL} external label="MotiveFX Ops Console">
              <ExternalLink size={16} />
            </OpsIconButton>
            <OpsIconButton onClick={logout} label="Sign out">
              <LogOut size={16} />
            </OpsIconButton>
          </div>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard icon={Users} label="Total users" value={kpis.totalUsers} />
        <KpiCard icon={BarChart3} label="Active subs" value={kpis.activeModuleSubscriptions} />
        <KpiCard icon={Wallet} label="Est. MRR (CAD)" value={`$${kpis.estimatedMrrCad.toLocaleString()}`} />
        <KpiCard icon={Activity} label="Usage (24h)" value={kpis.usageEvents24h} />
        <KpiCard icon={Users} label="Pro active" value={kpis.proActive} />
        <KpiCard icon={Activity} label="Churn (30d)" value={kpis.churnEvents30d} warn />
      </section>

      <AdminUsersPanel />

      {data.traffic && <TrafficSocialPanel data={data.traffic} />}

      <div className="mb-6">
        <SignupGlobeMap data={data.signupMap} />
      </div>

      {channelPerformance && channelPerformance.channels.length > 0 && (
        <section className="mb-6 rounded-xl border border-forward-800 bg-forward-900/60 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Megaphone size={18} className="text-forward-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-forward-400">
              Signups by acquisition channel
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-forward-800 text-forward-500">
                  <th className="pb-2 pr-3">Channel</th>
                  <th className="pb-2 pr-3">Signups</th>
                  <th className="pb-2">Share %</th>
                </tr>
              </thead>
              <tbody>
                {channelPerformance.channels.map((ch) => (
                  <tr key={ch.id} className="border-b border-forward-800/60 text-forward-200">
                    <td className="py-2 pr-3 font-medium text-white">{ch.platform}</td>
                    <td className="py-2 pr-3">{ch.signups}</td>
                    <td className="py-2">{ch.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Subscriptions by module">
          <BarList
            items={data.subscriptionsByModule.map((m) => ({
              module: data.moduleLabels[m.module] ?? m.module,
              active: m.active,
            }))}
            labelKey="module"
            valueKey="active"
          />
        </Panel>
        <Panel title="Module activity ranking (30d)">
          <BarList
            items={data.moduleActivityRanking.map((m) => ({
              module: data.moduleLabels[m.module] ?? m.module,
              events: m.events,
            }))}
            labelKey="module"
            valueKey="events"
          />
        </Panel>
      </div>

      <div className="mb-6">
        <ActivityHeatmap heatmap={data.activityHeatmap} moduleLabels={data.moduleLabels} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Churn by plan (30d)">
          <BarList
            items={data.churnByModule.map((c) => ({ module: c.module, cancellations: c.cancellations }))}
            labelKey="module"
            valueKey="cancellations"
          />
        </Panel>
        <Panel title="Module health">
          <div className="space-y-2">
            {data.moduleHealth.map((m) => (
              <div
                key={m.module}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                  m.status === "healthy"
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-amber-500/20 bg-amber-500/5"
                }`}
              >
                <strong className="text-forward-100">{m.label}</strong>
                <span className="text-forward-400">{m.status}</span>
                <span className="text-forward-500">{m.usage7d} events/7d</span>
                <span className="text-forward-500">{m.errors7d} errors</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Generation cohorts">
          <BarList items={demographics.cohorts} labelKey="cohort" valueKey="c" />
        </Panel>
        <Panel title="Age buckets">
          <BarList items={demographics.ageBuckets} labelKey="bucket" valueKey="c" />
        </Panel>
        <Panel title="Payment methods">
          <BarList items={demographics.paymentMethods} labelKey="payment_method" valueKey="c" />
        </Panel>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Top signup locations">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-forward-800 text-forward-500">
                  <th className="pb-2 pr-3">City</th>
                  <th className="pb-2 pr-3">Country</th>
                  <th className="pb-2">Users</th>
                </tr>
              </thead>
              <tbody>
                {demographics.topLocations.map((loc) => (
                  <tr key={`${loc.city}-${loc.country}`} className="border-b border-forward-800/60 text-forward-200">
                    <td className="py-2 pr-3">{loc.city || "—"}</td>
                    <td className="py-2 pr-3">{loc.country}</td>
                    <td className="py-2">{loc.c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Payments (90d)">
          <p className="mb-3 text-lg font-semibold text-white">
            ${payments.revenueCad.toLocaleString()} CAD · {payments.transactions} active Pro
          </p>
          <BarList
            items={payments.byPlanTier.map((p) => ({
              plan_tier: p.plan_tier,
              revenue: Math.round(p.revenue),
            }))}
            labelKey="plan_tier"
            valueKey="revenue"
          />
        </Panel>
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Mic} label="Voice captures (7d)" value={kpis.voiceCaptures7d} />
        <KpiCard icon={Target} label="Tasks done (7d)" value={kpis.tasksDone7d} />
        <KpiCard icon={Brain} label="AI voice units (mo)" value={kpis.aiVoiceUnitsThisMonth} />
        <KpiCard icon={Brain} label="Marketing opt-in" value={`${kpis.marketingOptInRate}%`} />
      </section>

      <section className="mb-6 rounded-xl border border-forward-800 bg-forward-900/60 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-forward-400">
          Signups (14 days)
        </h2>
        <div className="flex h-32 items-end gap-1">
          {data.signupsByDay.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-emerald-400/70"
                style={{ height: `${Math.max(4, (d.count / maxSignup) * 100)}%` }}
                title={`${d.day}: ${d.count}`}
              />
              <span className="text-[10px] text-forward-500">{d.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-forward-800 bg-forward-900/60 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-forward-400">
          Recent users
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-forward-800 text-forward-500">
                <th className="pb-2 pr-3 font-medium">User</th>
                <th className="pb-2 pr-3 font-medium">Cohort</th>
                <th className="pb-2 pr-3 font-medium">Location</th>
                <th className="pb-2 pr-3 font-medium">Channel</th>
                <th className="pb-2 pr-3 font-medium">Plan</th>
                <th className="pb-2 pr-3 font-medium">Tasks</th>
                <th className="pb-2 pr-3 font-medium">Voice</th>
                <th className="pb-2 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {data.recentUsers.map((u) => (
                <tr key={u.id} className="border-b border-forward-800/60 text-forward-200">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-white">{u.name ?? "—"}</div>
                    <div className="font-mono text-xs text-forward-500">{u.email}</div>
                  </td>
                  <td className="py-2 pr-3">{u.cohort}</td>
                  <td className="py-2 pr-3">
                    {u.city ? `${u.city}, ${u.country}` : u.country ?? "—"}
                  </td>
                  <td className="py-2 pr-3">{u.acquisition_channel ?? "—"}</td>
                  <td className="py-2 pr-3">{u.plan}</td>
                  <td className="py-2 pr-3">{u.tasks}</td>
                  <td className="py-2 pr-3">{u.voiceCaptures}</td>
                  <td className="py-2">{new Date(u.last_seen_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-forward-600">
        MotiveLife Pro · {data.priceLabel} · Geo from signup IP · Module events from usage tracking
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-forward-800 bg-forward-900/60 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-forward-400">{title}</h2>
      {children}
    </section>
  );
}
