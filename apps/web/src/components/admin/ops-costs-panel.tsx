"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/button";
import { RefreshCw, Wallet } from "lucide-react";

type CostEntry = {
  id: string;
  brand: string;
  category: string;
  source: string;
  amountCad: number;
  occurredOn: string;
  vendor: string | null;
  description: string | null;
};

type CostsPayload = {
  month: string;
  totalCad: number;
  byCategory: Record<string, number>;
  byBrand: Record<string, number>;
  entries: CostEntry[];
  brands: string[];
  categories: string[];
};

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
  const [category, setCategory] = useState("marketing_ads");
  const [amountCad, setAmountCad] = useState("");
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");

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

  const contribution = useMemo(() => {
    const costs = data?.totalCad ?? 0;
    return Math.round((paidMrrCad - costs) * 100) / 100;
  }, [paidMrrCad, data?.totalCad]);

  async function syncAuto() {
    setSyncing(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/ops-costs/sync", { method: "POST" });
      const json = (await res.json()) as { error?: string; openai?: unknown; stripeFees?: unknown };
      if (!res.ok) {
        setError(json.error ?? "Sync failed.");
        return;
      }
      setMessage("Synced OpenAI + Stripe fee estimates for current and previous month.");
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
      setDescription("");
      setMessage("Cost entry saved.");
      await load();
    } catch {
      setError("Could not save entry.");
    } finally {
      setSaving(false);
    }
  }

  const brands = data?.brands ?? ["motivelife", "motivefx", "motiveiq", "motivepulse", "shared"];
  const categories =
    data?.categories ??
    [
      "openai",
      "vercel",
      "supabase",
      "stripe_fees",
      "resend",
      "marketing_ads",
      "marketing_boosts",
      "network",
      "other",
    ];

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
              Auto OpenAI / Stripe fees + manual ads, boosts, Vercel, network. Brand tags for marketing.
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
          <Button onClick={() => void syncAuto()} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync auto costs"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-forward-800 bg-forward-950/60 px-3 py-3">
          <p className="text-[11px] uppercase tracking-wider text-forward-500">Paid MRR</p>
          <p className="text-lg font-semibold text-white">${paidMrrCad.toLocaleString()} CAD</p>
        </div>
        <div className="rounded-lg border border-forward-800 bg-forward-950/60 px-3 py-3">
          <p className="text-[11px] uppercase tracking-wider text-forward-500">Month costs</p>
          <p className="text-lg font-semibold text-white">
            ${(data?.totalCad ?? 0).toLocaleString()} CAD
          </p>
        </div>
        <div className="rounded-lg border border-forward-800 bg-forward-950/60 px-3 py-3">
          <p className="text-[11px] uppercase tracking-wider text-forward-500">
            Est. contribution
          </p>
          <p
            className={`text-lg font-semibold ${
              contribution >= 0 ? "text-emerald-300" : "text-amber-300"
            }`}
          >
            ${contribution.toLocaleString()} CAD
          </p>
        </div>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-forward-500">
            By category
          </h3>
          <ul className="space-y-1 text-sm text-forward-200">
            {Object.entries(data?.byCategory ?? {}).length === 0 ? (
              <li className="text-forward-500">No costs this month yet.</li>
            ) : (
              Object.entries(data?.byCategory ?? {})
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <li key={k} className="flex justify-between border-b border-forward-800/50 py-1">
                    <span>{k}</span>
                    <span>${v.toLocaleString()}</span>
                  </li>
                ))
            )}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-forward-500">
            By brand
          </h3>
          <ul className="space-y-1 text-sm text-forward-200">
            {Object.entries(data?.byBrand ?? {}).length === 0 ? (
              <li className="text-forward-500">No costs this month yet.</li>
            ) : (
              Object.entries(data?.byBrand ?? {})
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <li key={k} className="flex justify-between border-b border-forward-800/50 py-1">
                    <span>{k}</span>
                    <span>${v.toLocaleString()}</span>
                  </li>
                ))
            )}
          </ul>
        </div>
      </div>

      <form
        onSubmit={createManual}
        className="mb-5 grid gap-3 rounded-lg border border-forward-800 bg-forward-950/40 p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
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
                {c}
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
            placeholder="Meta, Vercel, Cloudflare…"
            className="mt-1 w-full rounded-lg border border-forward-700 bg-forward-900 px-2 py-2 text-sm text-white"
          />
        </label>
        <label className="text-xs text-forward-400 sm:col-span-2 lg:col-span-1">
          Description
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Boost / invoice note"
            className="mt-1 w-full rounded-lg border border-forward-700 bg-forward-900 px-2 py-2 text-sm text-white"
          />
        </label>
        <div className="flex items-end sm:col-span-2 lg:col-span-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Add manual cost"}
          </Button>
          <p className="ml-3 text-xs text-forward-500">
            Use category <code className="text-forward-300">vercel</code> for invoice totals (no auto $
            from Vercel API).
          </p>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-forward-800 text-forward-500">
              <th className="pb-2 pr-3">Date</th>
              <th className="pb-2 pr-3">Brand</th>
              <th className="pb-2 pr-3">Category</th>
              <th className="pb-2 pr-3">Source</th>
              <th className="pb-2 pr-3">Vendor</th>
              <th className="pb-2 pr-3">CAD</th>
              <th className="pb-2">Description</th>
            </tr>
          </thead>
          <tbody>
            {(data?.entries ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="py-4 text-forward-500">
                  {loading ? "Loading…" : "No entries for this month."}
                </td>
              </tr>
            ) : (
              data!.entries.map((e) => (
                <tr key={e.id} className="border-b border-forward-800/60 text-forward-200">
                  <td className="py-2 pr-3 whitespace-nowrap">{e.occurredOn}</td>
                  <td className="py-2 pr-3">{e.brand}</td>
                  <td className="py-2 pr-3">{e.category}</td>
                  <td className="py-2 pr-3">{e.source}</td>
                  <td className="py-2 pr-3">{e.vendor ?? "—"}</td>
                  <td className="py-2 pr-3">${e.amountCad.toLocaleString()}</td>
                  <td className="py-2 text-forward-400">{e.description ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
