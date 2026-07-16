"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/button";
import { formatApiError, readApiResponse } from "@/lib/fetch-api";
import {
  CollapsibleBlock,
  SortHeader,
  sortRows,
  useSortState,
} from "@/components/admin/admin-table-ui";

type PerfRow = {
  id: string;
  brand: string;
  channel: string | null;
  status: string;
  title: string;
  publishedAt: string | null;
  createdAt: string;
  publishedUrl: string | null;
  ctaUrl: string | null;
  destinationUrl: string | null;
  siteLandings: number;
  signups: number;
  platformViews: number | null;
  platformEngagement: number | null;
  platformClicks: number | null;
  metricsSyncedAt: string | null;
};

type SortKey =
  | "brand"
  | "channel"
  | "title"
  | "publishedAt"
  | "siteLandings"
  | "signups"
  | "platformViews"
  | "platformEngagement"
  | "metricsSyncedAt";

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function MarketingPostPerformanceTable() {
  const [rows, setRows] = useState<PerfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [brand, setBrand] = useState("all");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("published");
  const [days, setDays] = useState("90");
  const [query, setQuery] = useState("");
  const sort = useSortState<SortKey>("publishedAt", "desc");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const qs = new URLSearchParams({ brand, channel, status, days });
      const res = await fetch(`/api/admin/marketing/performance?${qs}`);
      const { data, text } = await readApiResponse<{
        error?: string;
        rows?: PerfRow[];
      }>(res);
      if (!res.ok || !data) throw new Error(formatApiError(res, text, data));
      setRows(data.rows ?? []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load performance.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [brand, channel, status, days]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshStats() {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/marketing/metrics/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const { data, text } = await readApiResponse<{
        error?: string;
        updated?: number;
        scanned?: number;
        errors?: string[];
      }>(res);
      if (!res.ok || !data) throw new Error(formatApiError(res, text, data));
      const errN = data.errors?.length ?? 0;
      setMessage(
        `Synced ${data.updated ?? 0}/${data.scanned ?? 0} posts${
          errN ? ` (${errN} skipped — often missing Meta insights scopes)` : ""
        }.`,
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.brand.toLowerCase().includes(q) ||
            (r.channel ?? "").toLowerCase().includes(q),
        )
      : rows;
    return sortRows(
      filtered.map((r) => ({
        ...r,
        channel: r.channel ?? "",
        publishedAt: r.publishedAt ?? "",
        platformViews: r.platformViews ?? -1,
        platformEngagement: r.platformEngagement ?? -1,
        metricsSyncedAt: r.metricsSyncedAt ?? "",
      })),
      sort.key,
      sort.dir,
    );
  }, [rows, query, sort.key, sort.dir]);

  return (
    <section className="mb-6 rounded-xl border border-forward-800 bg-forward-900/60 p-5">
      <CollapsibleBlock
        title="Post performance"
        storageKey="post-performance"
        defaultOpen
        count={filteredSorted.length}
        subtitle="Click column headers to sort. Filters narrow the set; collapse to free space on the Ops page."
        headerRight={
          <div className="flex flex-wrap items-center gap-2">
            <BarChart3 size={16} className="text-forward-500" />
            <Button
              variant="secondary"
              onClick={() => void refreshStats()}
              disabled={syncing || loading}
              className="text-xs"
            >
              <RefreshCw size={14} className={`mr-1.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Refreshing…" : "Refresh platform stats"}
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="rounded-lg border border-forward-700 bg-forward-950 px-2 py-1.5 text-xs text-forward-100"
          >
            <option value="all">All brands</option>
            <option value="motivelife">MotiveLife</option>
            <option value="motivefx">MotiveFX</option>
            <option value="motiveiq">MotiveIQ</option>
            <option value="motivepulse">MotivePulse</option>
          </select>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="rounded-lg border border-forward-700 bg-forward-950 px-2 py-1.5 text-xs text-forward-100"
          >
            <option value="all">All channels</option>
            <option value="youtube">YouTube</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="linkedin">LinkedIn</option>
            <option value="tiktok">TikTok</option>
            <option value="x">X</option>
            <option value="threads">Threads</option>
            <option value="reddit">Reddit</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-forward-700 bg-forward-950 px-2 py-1.5 text-xs text-forward-100"
          >
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="draft">Draft</option>
            <option value="all">All statuses</option>
          </select>
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="rounded-lg border border-forward-700 bg-forward-950 px-2 py-1.5 text-xs text-forward-100"
          >
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 180 days</option>
            <option value="365">Last year</option>
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter title / brand / channel…"
            className="min-w-[180px] flex-1 rounded-lg border border-forward-700 bg-forward-950 px-2 py-1.5 text-xs text-forward-100"
          />
        </div>

        {message && <p className="mb-3 text-xs text-forward-400">{message}</p>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-forward-800">
                <SortHeader
                  label="Brand"
                  active={sort.key === "brand"}
                  dir={sort.dir}
                  onClick={() => sort.toggle("brand")}
                />
                <SortHeader
                  label="Channel"
                  active={sort.key === "channel"}
                  dir={sort.dir}
                  onClick={() => sort.toggle("channel")}
                />
                <SortHeader
                  label="Post"
                  active={sort.key === "title"}
                  dir={sort.dir}
                  onClick={() => sort.toggle("title")}
                />
                <SortHeader
                  label="Published"
                  active={sort.key === "publishedAt"}
                  dir={sort.dir}
                  onClick={() => sort.toggle("publishedAt")}
                />
                <SortHeader
                  label="Site landings"
                  active={sort.key === "siteLandings"}
                  dir={sort.dir}
                  onClick={() => sort.toggle("siteLandings")}
                  align="right"
                />
                <SortHeader
                  label="Signups"
                  active={sort.key === "signups"}
                  dir={sort.dir}
                  onClick={() => sort.toggle("signups")}
                  align="right"
                />
                <SortHeader
                  label="Platform views"
                  active={sort.key === "platformViews"}
                  dir={sort.dir}
                  onClick={() => sort.toggle("platformViews")}
                  align="right"
                />
                <SortHeader
                  label="Engagement"
                  active={sort.key === "platformEngagement"}
                  dir={sort.dir}
                  onClick={() => sort.toggle("platformEngagement")}
                  align="right"
                />
                <SortHeader
                  label="Synced"
                  active={sort.key === "metricsSyncedAt"}
                  dir={sort.dir}
                  onClick={() => sort.toggle("metricsSyncedAt")}
                />
                <th className="pb-2 text-left text-forward-500">Link</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-forward-500">
                    Loading…
                  </td>
                </tr>
              ) : filteredSorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-forward-500">
                    No posts in this filter. Publish from Marketing Agent, then refresh stats.
                  </td>
                </tr>
              ) : (
                filteredSorted.map((row) => (
                  <tr key={row.id} className="border-b border-forward-800/60 text-forward-200">
                    <td className="py-2 pr-3 font-medium text-white">{row.brand}</td>
                    <td className="py-2 pr-3">{row.channel || "—"}</td>
                    <td className="max-w-[220px] truncate py-2 pr-3" title={row.title}>
                      {row.title}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {fmtDate(row.publishedAt || null)}
                    </td>
                    <td className="py-2 pr-3 text-right">{fmtNum(row.siteLandings)}</td>
                    <td className="py-2 pr-3 text-right">{fmtNum(row.signups)}</td>
                    <td className="py-2 pr-3 text-right">
                      {fmtNum(row.platformViews < 0 ? null : row.platformViews)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {fmtNum(row.platformEngagement < 0 ? null : row.platformEngagement)}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-xs text-forward-500">
                      {fmtDate(row.metricsSyncedAt || null)}
                    </td>
                    <td className="py-2">
                      {row.publishedUrl || row.ctaUrl ? (
                        <a
                          href={row.publishedUrl || row.ctaUrl || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
                        >
                          <ExternalLink size={12} />
                          Open
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-forward-600">
          Site landings count clicks through the MotiveLife hop URL on each post CTA. Platform views /
          engagement sync from YouTube and Meta when tokens allow — LinkedIn/TikTok/X show “—” in v1.
        </p>
      </CollapsibleBlock>
    </section>
  );
}
