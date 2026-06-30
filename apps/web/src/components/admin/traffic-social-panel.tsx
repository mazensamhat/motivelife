"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Globe, Megaphone } from "lucide-react";
import type { TrafficAnalytics } from "@/lib/traffic-analytics";
import { Button } from "@/components/button";

export function TrafficSocialPanel({ data }: { data: TrafficAnalytics }) {
  const maxDay = Math.max(...data.viewsByDay.map((d) => d.count), 1);
  const { summary } = data;

  return (
    <section className="mb-6 space-y-4">
      <div className="rounded-xl border border-forward-800 bg-forward-900/60 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-sky-400" />
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-forward-400">
                Website traffic
              </h2>
              <p className="mt-1 text-xs text-forward-500">
                First-party page views on mymotivelife.com · updates on each visit
              </p>
            </div>
          </div>
          <a
            href={data.vercelAnalyticsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-forward-400 hover:text-white"
          >
            Vercel Analytics (optional)
            <ExternalLink size={12} />
          </a>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Views (24h)" value={summary.views24h} />
          <Stat label="Views (7d)" value={summary.views7d} />
          <Stat label="Views (30d)" value={summary.views30d} />
          <Stat label="From social (30d)" value={summary.socialViews} />
        </div>

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-forward-500">
          Daily views (14d)
        </h3>
        <div className="mb-4 flex h-24 items-end gap-1">
          {data.viewsByDay.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-sky-400/70"
                style={{ height: `${Math.max(4, (d.count / maxDay) * 100)}%` }}
                title={`${d.day}: ${d.count}`}
              />
              <span className="text-[10px] text-forward-500">{d.day.slice(5)}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-forward-500">
              Top pages (30d)
            </h3>
            <ul className="space-y-1 text-sm text-forward-200">
              {data.topPages.length === 0 ? (
                <li className="text-forward-500">No page views yet — traffic appears after site visits.</li>
              ) : (
                data.topPages.map((p) => (
                  <li key={p.path} className="flex justify-between gap-2">
                    <span className="truncate font-mono text-xs">{p.path}</span>
                    <span className="text-forward-400">{p.count}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-forward-500">
              Top sources (30d)
            </h3>
            <ul className="space-y-1 text-sm text-forward-200">
              {data.topSources.length === 0 ? (
                <li className="text-forward-500">direct, google, instagram, etc. appear here</li>
              ) : (
                data.topSources.map((s) => (
                  <li key={s.source} className="flex justify-between gap-2">
                    <span>{s.source}</span>
                    <span className="text-forward-400">{s.count}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-forward-800 bg-forward-900/60 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Megaphone size={18} className="text-violet-400" />
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-forward-400">
              Social media tracking
            </h2>
            <p className="mt-1 text-xs text-forward-500">
              Put the tracking link in each bio/post. Signups from that link show up here and in user records.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-forward-800 text-forward-500">
                <th className="pb-2 pr-3">Platform</th>
                <th className="pb-2 pr-3">Profile</th>
                <th className="pb-2 pr-3">Tracking link</th>
                <th className="pb-2 pr-3">Views</th>
                <th className="pb-2">Signups</th>
              </tr>
            </thead>
            <tbody>
              {data.socialPlatforms.map((p) => (
                <tr key={p.id} className="border-b border-forward-800/60 text-forward-200">
                  <td className="py-3 pr-3 font-medium text-white">{p.label}</td>
                  <td className="py-3 pr-3">
                    {p.profileUrl ? (
                      <a
                        href={p.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-300 hover:underline"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-forward-500">
                        Set SOCIAL_{p.id.toUpperCase()}_URL in Vercel
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <CopyLink url={p.trackingUrl} />
                  </td>
                  <td className="py-3 pr-3">{p.pageViews}</td>
                  <td className="py-3">{p.signups}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-forward-800 bg-forward-950/60 px-3 py-2">
      <p className="text-xs text-forward-500">{label}</p>
      <p className="text-xl font-semibold text-white">{value.toLocaleString()}</p>
    </div>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex max-w-xs items-center gap-2">
      <code className="truncate text-xs text-forward-400">{url}</code>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="shrink-0 bg-forward-800 px-2 py-1 text-xs"
        onClick={() => void copy()}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </Button>
    </div>
  );
}
