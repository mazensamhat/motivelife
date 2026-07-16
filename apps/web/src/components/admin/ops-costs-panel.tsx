"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/button";
import { ExternalLink, RefreshCw, Wallet } from "lucide-react";
import {
  CollapsibleBlock,
  SortHeader,
  sortRows,
  type SortDir,
} from "@/components/admin/admin-table-ui";
import {
  COST_PRESETS,
  categoryLabel,
  dailyFromMonthly,
  daysInMonthKey,
} from "@/lib/ops-cost-labels";

type CostEntry = {
  id: string;
  brand: string;
  category: string;
  source: string;
  amountCad: number;
  monthlyCad: number;
  dailyCad: number;
  occurredOn: string;
  vendor: string | null;
  description: string | null;
};

type CostSourceRow = {
  id: string;
  name: string;
  group: string;
  category: string;
  trackMode: string;
  effectiveTrackMode?: string;
  trackNote: string;
  billingUrl: string | null;
  configured: boolean;
  autoReady?: boolean;
  wireHint?: string;
  monthCad: number;
  dailyCad: number;
};

type BreakdownRow = {
  key: string;
  label: string;
  monthlyCad: number;
  dailyCad: number;
};

type CostsPayload = {
  month: string;
  daysInMonth: number;
  totalCad: number;
  totalDailyCad: number;
  byCategory: Record<string, number>;
  byBrand: Record<string, number>;
  categoryBreakdown?: Array<{ category: string; monthlyCad: number; dailyCad: number }>;
  brandBreakdown?: Array<{ brand: string; monthlyCad: number; dailyCad: number }>;
  entries: CostEntry[];
  brands: string[];
  categories: string[];
  costSources?: CostSourceRow[];
  setupRequired?: boolean;
  error?: string | null;
};

const GROUP_LABELS: Record<string, string> = {
  infra: "Infrastructure",
  ai: "AI",
  communications: "Communications",
  marketing: "Marketing / ads",
  mobile: "Mobile / stores",
  other: "Other",
};

const PRESET_GROUP_ORDER = ["marketing", "infra", "ai", "communications", "mobile"] as const;

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function OpsCostsPanel({ paidMrrCad }: { paidMrrCad: number }) {
  const [month, setMonth] = useState(currentMonthKey);
  const [data, setData] = useState<CostsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [brand, setBrand] = useState("motivelife");
  const [category, setCategory] = useState("instagram_boost");
  const [amountCad, setAmountCad] = useState("");
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState("Meta / Instagram");
  const [description, setDescription] = useState("Instagram boost");

  const [sourceGroupFilter, setSourceGroupFilter] = useState("all");
  const [sourceTrackFilter, setSourceTrackFilter] = useState("all");
  const [ledgerBrandFilter, setLedgerBrandFilter] = useState("all");
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState("all");
  const [ledgerQuery, setLedgerQuery] = useState("");

  const [sourceSort, setSourceSort] = useState<{
    key: "name" | "group" | "trackMode" | "configured" | "monthCad" | "dailyCad";
    dir: SortDir;
  }>({ key: "group", dir: "asc" });
  const [breakdownSort, setBreakdownSort] = useState<{
    key: "label" | "monthlyCad" | "dailyCad";
    dir: SortDir;
  }>({ key: "monthlyCad", dir: "desc" });
  const [entrySort, setEntrySort] = useState<{
    key: "occurredOn" | "brand" | "category" | "source" | "vendor" | "monthlyCad" | "dailyCad";
    dir: SortDir;
  }>({ key: "occurredOn", dir: "desc" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/ops-costs?month=${encodeURIComponent(month)}`);
      const json = (await res.json()) as CostsPayload & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not load costs.");
        setData(null);
        return;
      }
      setData(json);
      if (json.setupRequired && json.error) {
        setError(json.error);
      }
      setBrand((prev) =>
        json.brands?.length && !json.brands.includes(prev) ? json.brands[0]! : prev,
      );
      setCategory((prev) =>
        json.categories?.length && !json.categories.includes(prev) ? json.categories[0]! : prev,
      );
    } catch {
      setError("Could not load costs.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const daysInMonth = data?.daysInMonth ?? daysInMonthKey(month);
  const totalCad = data?.totalCad ?? 0;
  const totalDailyCad = data?.totalDailyCad ?? dailyFromMonthly(totalCad, daysInMonth);
  const setupRequired = Boolean(data?.setupRequired);

  const contribution = useMemo(() => {
    return Math.round((paidMrrCad - totalCad) * 100) / 100;
  }, [paidMrrCad, totalCad]);

  const sortedSources = useMemo(() => {
    let rows = data?.costSources ?? [];
    if (sourceGroupFilter !== "all") {
      rows = rows.filter((r) => r.group === sourceGroupFilter);
    }
    if (sourceTrackFilter === "auto") {
      rows = rows.filter((r) => (r.effectiveTrackMode ?? r.trackMode) === "auto");
    } else if (sourceTrackFilter === "manual") {
      rows = rows.filter((r) => (r.effectiveTrackMode ?? r.trackMode) !== "auto");
    } else if (sourceTrackFilter === "detected") {
      rows = rows.filter((r) => r.configured);
    } else if (sourceTrackFilter === "not_set") {
      rows = rows.filter((r) => !r.configured);
    }
    return sortRows(rows, sourceSort.key, sourceSort.dir);
  }, [data?.costSources, sourceSort, sourceGroupFilter, sourceTrackFilter]);

  const categoryRows = useMemo((): BreakdownRow[] => {
    if (data?.categoryBreakdown?.length) {
      return data.categoryBreakdown.map((r) => ({
        key: r.category,
        label: categoryLabel(r.category),
        monthlyCad: r.monthlyCad,
        dailyCad: r.dailyCad,
      }));
    }
    return Object.entries(data?.byCategory ?? {}).map(([key, monthlyCad]) => ({
      key,
      label: categoryLabel(key),
      monthlyCad,
      dailyCad: dailyFromMonthly(monthlyCad, daysInMonth),
    }));
  }, [data, daysInMonth]);

  const sortedBreakdown = useMemo(
    () => sortRows(categoryRows, breakdownSort.key, breakdownSort.dir),
    [categoryRows, breakdownSort],
  );

  const sortedEntries = useMemo(() => {
    const q = ledgerQuery.trim().toLowerCase();
    let rows = (data?.entries ?? []).map((e) => ({
      ...e,
      monthlyCad: e.monthlyCad ?? e.amountCad,
      dailyCad: e.dailyCad ?? dailyFromMonthly(e.amountCad, daysInMonth),
      vendor: e.vendor ?? "",
    }));
    if (ledgerBrandFilter !== "all") {
      rows = rows.filter((e) => e.brand === ledgerBrandFilter);
    }
    if (ledgerCategoryFilter !== "all") {
      rows = rows.filter((e) => e.category === ledgerCategoryFilter);
    }
    if (q) {
      rows = rows.filter(
        (e) =>
          e.vendor.toLowerCase().includes(q) ||
          (e.description ?? "").toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.brand.toLowerCase().includes(q),
      );
    }
    return sortRows(rows, entrySort.key, entrySort.dir);
  }, [
    data?.entries,
    daysInMonth,
    entrySort,
    ledgerBrandFilter,
    ledgerCategoryFilter,
    ledgerQuery,
  ]);

  function toggleSourceSort(key: typeof sourceSort.key) {
    setSourceSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function toggleBreakdownSort(key: typeof breakdownSort.key) {
    setBreakdownSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );
  }

  function toggleEntrySort(key: typeof entrySort.key) {
    setEntrySort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );
  }

  function applyPreset(presetId: string) {
    const preset = COST_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setCategory(preset.category);
    setVendor(preset.vendor);
    setDescription(preset.description);
    setMessage(`Preset: ${preset.label}. Enter amount + brand/date, then save.`);
    document.getElementById("ops-cost-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function enterForSource(source: CostSourceRow) {
    setCategory(source.category);
    setVendor(source.name.split("(")[0]?.trim() ?? source.name);
    setDescription(source.trackNote.slice(0, 120));
    setMessage(`Entering cost for ${source.name}.`);
    document.getElementById("ops-cost-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function syncAuto() {
    setSyncing(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/ops-costs/sync", { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Sync failed.");
        return;
      }
      const parts = ["OpenAI", "Stripe", "Resend", "Meta ads", "Twilio"];
      setMessage(
        `Synced auto sources (${parts.join(", ")}) for current + previous month. Skipped rows stay manual until wired.`,
      );
      await load();
    } catch {
      setError("Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function createManual(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    const amount = Number(amountCad);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid amount in CAD.");
      setSaving(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/ops-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand,
          category,
          amountCad: amount,
          occurredOn,
          vendor: vendor.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not save entry.");
        return;
      }
      setAmountCad("");
      setMessage("Cost entry saved.");
      await load();
    } catch {
      setError("Could not save entry.");
    } finally {
      setSaving(false);
    }
  }

  const brands = data?.brands ?? ["motivelife", "motivefx", "motiveiq", "motivepulse", "shared"];
  const categories = data?.categories ?? Object.keys(
    Object.fromEntries(COST_PRESETS.map((p) => [p.category, 1])),
  );

  const configuredCount = sortedSources.filter((s) => s.configured).length;
  const autoCount = sortedSources.filter(
    (s) => (s.effectiveTrackMode ?? s.trackMode) === "auto" || s.autoReady,
  ).length;

  return (
    <section className="mb-6 rounded-xl border border-forward-800 bg-forward-900/60 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={18} className="text-forward-400" />
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-forward-400">
              Operating costs
            </h2>
            <p className="text-xs text-forward-500">
              {autoCount} auto-ready · {configuredCount} env-detected · rest manual / wire keys below
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-forward-700 bg-forward-950 px-2 py-1.5 text-sm text-forward-100"
          />
          <Button
            variant="secondary"
            onClick={() => void load()}
            disabled={loading}
            className="bg-forward-800 text-forward-100"
          >
            <RefreshCw size={14} className="mr-1.5" />
            {loading ? "Loading…" : "Refresh"}
          </Button>
          <Button onClick={() => void syncAuto()} disabled={syncing || setupRequired}>
            {syncing ? "Syncing…" : "Sync auto costs"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          <p>{error}</p>
          {/OpsCostEntry|missing|db:push|does not exist/i.test(error) ? (
            <p className="mt-2 text-xs text-red-200/80">
              Fix: Supabase <strong>production</strong> → SQL Editor → run{" "}
              <code className="text-red-100">packages/database/prisma/ops-cost-entry.sql</code>, then
              Refresh. Local npx only updates the DB in your local .env.
            </p>
          ) : null}
        </div>
      ) : null}
      {message ? (
        <p className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-forward-800 bg-forward-950/60 px-3 py-3">
          <p className="text-[11px] uppercase tracking-wider text-forward-500">Paid MRR</p>
          <p className="text-lg font-semibold text-white">${paidMrrCad.toLocaleString()} CAD</p>
        </div>
        <div className="rounded-lg border border-forward-800 bg-forward-950/60 px-3 py-3">
          <p className="text-[11px] uppercase tracking-wider text-forward-500">Month costs</p>
          <p className="text-lg font-semibold text-white">${totalCad.toLocaleString()} CAD</p>
        </div>
        <div className="rounded-lg border border-forward-800 bg-forward-950/60 px-3 py-3">
          <p className="text-[11px] uppercase tracking-wider text-forward-500">Daily avg</p>
          <p className="text-lg font-semibold text-white">${totalDailyCad.toLocaleString()} CAD</p>
        </div>
        <div className="rounded-lg border border-forward-800 bg-forward-950/60 px-3 py-3">
          <p className="text-[11px] uppercase tracking-wider text-forward-500">Est. contribution</p>
          <p
            className={`text-lg font-semibold ${
              contribution >= 0 ? "text-emerald-300" : "text-amber-300"
            }`}
          >
            ${contribution.toLocaleString()} CAD
          </p>
        </div>
      </div>

      <CollapsibleBlock
        title="Connected cost sources"
        storageKey="ops-cost-sources"
        defaultOpen={false}
        count={sortedSources.length}
        subtitle="Auto-ready rows pull on Sync. Collapse when you only need P&L / ledger."
        headerRight={
          <div className="flex flex-wrap gap-2">
            <select
              value={sourceGroupFilter}
              onChange={(e) => setSourceGroupFilter(e.target.value)}
              className="rounded border border-forward-700 bg-forward-950 px-2 py-1 text-xs text-forward-100"
            >
              <option value="all">All groups</option>
              {Object.entries(GROUP_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={sourceTrackFilter}
              onChange={(e) => setSourceTrackFilter(e.target.value)}
              className="rounded border border-forward-700 bg-forward-950 px-2 py-1 text-xs text-forward-100"
            >
              <option value="all">All tracking</option>
              <option value="auto">Auto-ready</option>
              <option value="manual">Manual</option>
              <option value="detected">Env detected</option>
              <option value="not_set">Env not set</option>
            </select>
          </div>
        }
      >
        <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-forward-800">
              <SortHeader
                label="Vendor"
                active={sourceSort.key === "name"}
                dir={sourceSort.dir}
                onClick={() => toggleSourceSort("name")}
              />
              <SortHeader
                label="Group"
                active={sourceSort.key === "group"}
                dir={sourceSort.dir}
                onClick={() => toggleSourceSort("group")}
              />
              <SortHeader
                label="Tracking"
                active={sourceSort.key === "trackMode"}
                dir={sourceSort.dir}
                onClick={() => toggleSourceSort("trackMode")}
              />
              <SortHeader
                label="Env"
                active={sourceSort.key === "configured"}
                dir={sourceSort.dir}
                onClick={() => toggleSourceSort("configured")}
              />
              <SortHeader
                label="Monthly CAD"
                active={sourceSort.key === "monthCad"}
                dir={sourceSort.dir}
                onClick={() => toggleSourceSort("monthCad")}
                align="right"
              />
              <SortHeader
                label="Daily CAD"
                active={sourceSort.key === "dailyCad"}
                dir={sourceSort.dir}
                onClick={() => toggleSourceSort("dailyCad")}
                align="right"
              />
              <th className="pb-2 text-left text-forward-500">Action / wire</th>
            </tr>
          </thead>
          <tbody>
            {sortedSources.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-4 text-forward-500">
                  {loading ? "Loading…" : "No source registry loaded."}
                </td>
              </tr>
            ) : (
              sortedSources.map((s) => {
                const mode = s.effectiveTrackMode ?? s.trackMode;
                return (
                  <tr key={s.id} className="border-b border-forward-800/60 text-forward-200">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-white">{s.name}</div>
                      <div className="text-[11px] text-forward-500">{s.trackNote}</div>
                      {!s.configured || (s.trackMode === "auto" && !s.autoReady) ? (
                        <div className="mt-1 text-[11px] text-amber-200/90">
                          Wire: {s.wireHint ?? "Add env keys on Vercel Production."}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">{GROUP_LABELS[s.group] ?? s.group}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={
                          mode === "auto" ? "text-emerald-300" : "text-forward-300"
                        }
                      >
                        {mode}
                        {s.trackMode === "auto" && mode === "manual" ? " (needs keys)" : ""}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={s.configured ? "text-emerald-300" : "text-amber-300"}>
                        {s.configured ? "detected" : "not set"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right">${s.monthCad.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right text-forward-400">
                      ${s.dailyCad.toLocaleString()}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => enterForSource(s)}
                          className="rounded border border-forward-700 px-2 py-0.5 text-xs text-forward-200 hover:border-forward-500"
                        >
                          Enter
                        </button>
                        {s.billingUrl ? (
                          <a
                            href={s.billingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-forward-400 hover:text-forward-200"
                          >
                            Bill <ExternalLink size={11} />
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title="Cost breakdown"
        storageKey="ops-cost-breakdown"
        defaultOpen
        count={sortedBreakdown.length}
      >
        <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-forward-800">
              <SortHeader
                label="Category"
                active={breakdownSort.key === "label"}
                dir={breakdownSort.dir}
                onClick={() => toggleBreakdownSort("label")}
              />
              <SortHeader
                label="Monthly CAD"
                active={breakdownSort.key === "monthlyCad"}
                dir={breakdownSort.dir}
                onClick={() => toggleBreakdownSort("monthlyCad")}
                align="right"
              />
              <SortHeader
                label="Daily CAD"
                active={breakdownSort.key === "dailyCad"}
                dir={breakdownSort.dir}
                onClick={() => toggleBreakdownSort("dailyCad")}
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {sortedBreakdown.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-4 text-forward-500">
                  {loading ? "Loading…" : "No costs logged this month yet."}
                </td>
              </tr>
            ) : (
              sortedBreakdown.map((row) => (
                <tr key={row.key} className="border-b border-forward-800/60 text-forward-200">
                  <td className="py-2 pr-3">{row.label}</td>
                  <td className="py-2 pr-3 text-right">${row.monthlyCad.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right text-forward-400">
                    ${row.dailyCad.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {sortedBreakdown.length > 0 ? (
            <tfoot>
              <tr className="border-t border-forward-700 text-forward-100">
                <td className="py-2 pr-3 font-medium">Total</td>
                <td className="py-2 pr-3 text-right font-medium">${totalCad.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right font-medium text-forward-300">
                  ${totalDailyCad.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock
        title="Manual entry / presets"
        storageKey="ops-cost-form"
        defaultOpen
      >
      <form
        id="ops-cost-form"
        onSubmit={createManual}
        className="space-y-3 rounded-lg border border-forward-800 bg-forward-950/40 p-4"
      >
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-forward-500">
            Quick enter presets
          </p>
          {PRESET_GROUP_ORDER.map((group) => {
            const presets = COST_PRESETS.filter((p) => p.group === group);
            if (!presets.length) return null;
            return (
              <div key={group} className="mb-2">
                <p className="mb-1 text-[11px] text-forward-600">{GROUP_LABELS[group]}</p>
                <div className="flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      className="rounded-md border border-forward-700 bg-forward-900 px-2.5 py-1 text-xs text-forward-200 hover:border-forward-500 hover:text-white"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-forward-400">
            Brand
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="mt-1 w-full rounded-lg border border-forward-700 bg-forward-900 px-2 py-2 text-sm text-white"
            >
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-forward-400">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-forward-700 bg-forward-900 px-2 py-2 text-sm text-white"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-forward-400">
            Amount (CAD)
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountCad}
              onChange={(e) => setAmountCad(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-forward-700 bg-forward-900 px-2 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-forward-400">
            Date
            <input
              type="date"
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-forward-700 bg-forward-900 px-2 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-forward-400">
            Vendor
            <input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Twilio, Resend, Meta…"
              className="mt-1 w-full rounded-lg border border-forward-700 bg-forward-900 px-2 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-forward-400">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Invoice / boost note"
              className="mt-1 w-full rounded-lg border border-forward-700 bg-forward-900 px-2 py-2 text-sm text-white"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving || setupRequired}>
            {saving ? "Saving…" : "Add manual cost"}
          </Button>
          <p className="text-xs text-forward-500">
            Tag brand for MotiveFX / IQ / Pulse marketing paid from this stack.
          </p>
        </div>
      </form>
      </CollapsibleBlock>

      <CollapsibleBlock
        title="Ledger entries"
        storageKey="ops-cost-ledger"
        defaultOpen
        count={sortedEntries.length}
        headerRight={
          <div className="flex flex-wrap gap-2">
            <select
              value={ledgerBrandFilter}
              onChange={(e) => setLedgerBrandFilter(e.target.value)}
              className="rounded border border-forward-700 bg-forward-950 px-2 py-1 text-xs text-forward-100"
            >
              <option value="all">All brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select
              value={ledgerCategoryFilter}
              onChange={(e) => setLedgerCategoryFilter(e.target.value)}
              className="rounded border border-forward-700 bg-forward-950 px-2 py-1 text-xs text-forward-100"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
            <input
              value={ledgerQuery}
              onChange={(e) => setLedgerQuery(e.target.value)}
              placeholder="Filter vendor / note…"
              className="rounded border border-forward-700 bg-forward-950 px-2 py-1 text-xs text-forward-100"
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-forward-800">
              <SortHeader
                label="Date"
                active={entrySort.key === "occurredOn"}
                dir={entrySort.dir}
                onClick={() => toggleEntrySort("occurredOn")}
              />
              <SortHeader
                label="Brand"
                active={entrySort.key === "brand"}
                dir={entrySort.dir}
                onClick={() => toggleEntrySort("brand")}
              />
              <SortHeader
                label="Category"
                active={entrySort.key === "category"}
                dir={entrySort.dir}
                onClick={() => toggleEntrySort("category")}
              />
              <SortHeader
                label="Source"
                active={entrySort.key === "source"}
                dir={entrySort.dir}
                onClick={() => toggleEntrySort("source")}
              />
              <SortHeader
                label="Vendor"
                active={entrySort.key === "vendor"}
                dir={entrySort.dir}
                onClick={() => toggleEntrySort("vendor")}
              />
              <SortHeader
                label="Monthly CAD"
                active={entrySort.key === "monthlyCad"}
                dir={entrySort.dir}
                onClick={() => toggleEntrySort("monthlyCad")}
                align="right"
              />
              <SortHeader
                label="Daily CAD"
                active={entrySort.key === "dailyCad"}
                dir={entrySort.dir}
                onClick={() => toggleEntrySort("dailyCad")}
                align="right"
              />
              <th className="pb-2 text-left text-forward-500">Description</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-4 text-forward-500">
                  {loading ? "Loading…" : "No entries for this month."}
                </td>
              </tr>
            ) : (
              sortedEntries.map((e) => (
                <tr key={e.id} className="border-b border-forward-800/60 text-forward-200">
                  <td className="py-2 pr-3 whitespace-nowrap">{e.occurredOn}</td>
                  <td className="py-2 pr-3">{e.brand}</td>
                  <td className="py-2 pr-3">{categoryLabel(e.category)}</td>
                  <td className="py-2 pr-3">{e.source}</td>
                  <td className="py-2 pr-3">{e.vendor || "—"}</td>
                  <td className="py-2 pr-3 text-right">${e.monthlyCad.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right text-forward-400">
                    ${e.dailyCad.toLocaleString()}
                  </td>
                  <td className="py-2 text-forward-400">{e.description ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </CollapsibleBlock>
    </section>
  );
}
