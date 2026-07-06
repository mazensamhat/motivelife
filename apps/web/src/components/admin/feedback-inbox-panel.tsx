"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductFeedbackPayload } from "@forward/shared";
import { PRODUCT_FEEDBACK_KIND_LABELS } from "@forward/shared";
import { MessageSquarePlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/button";

export function FeedbackInboxPanel() {
  const [items, setItems] = useState<ProductFeedbackPayload[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/feedback");
      const data = await res.json();
      setItems(data.feedback ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="rounded-xl border border-forward-800 bg-forward-900/60 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-forward-200">
          <MessageSquarePlus size={18} />
          <h2 className="text-sm font-semibold uppercase tracking-wider">User feedback inbox</h2>
        </div>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {loading && items.length === 0 ? (
        <p className="text-sm text-forward-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-forward-400">No feedback yet.</p>
      ) : (
        <ul className="max-h-[420px] space-y-3 overflow-y-auto">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-forward-700 bg-forward-950/80 p-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-white">
                  {PRODUCT_FEEDBACK_KIND_LABELS[item.kind as keyof typeof PRODUCT_FEEDBACK_KIND_LABELS] ??
                    item.kind}
                </span>
                <span className="text-xs text-forward-500">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-forward-200">{item.message}</p>
              <p className="mt-2 text-xs text-forward-500">
                {item.user.name ?? item.user.email} · {item.viewport ?? "unknown device"} ·{" "}
                {item.pagePath ?? "—"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
