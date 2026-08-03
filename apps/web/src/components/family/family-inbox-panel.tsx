"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Gift, Lightbulb, Lock } from "lucide-react";
import { FamilyUpgradeCard } from "@/components/family/family-upgrade-card";
import type { FamilyEntitlements } from "@forward/shared";

type InboxTab = "alerts" | "tips" | "offers";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

const TIPS: { id: string; title: string; body: string }[] = [
  {
    id: "tip-share",
    title: "Keep Share live on during drives",
    body: "Drive Score, hard braking, and Weekly Driving Report only build while location is sharing.",
  },
  {
    id: "tip-places",
    title: "Name Home, Work, and School",
    body: "Saved places power arrival alerts, “still there” nudges, and Family Flow.",
  },
  {
    id: "tip-noshow",
    title: "Set a No Show Alert",
    body: "Get notified if someone isn’t at a place by a time you choose — calm check-ins, not panic.",
  },
];

const OFFERS: { id: string; title: string; body: string }[] = [
  {
    id: "offer-family",
    title: "MyMotiveFamily unlocks the full map",
    body: "History, Weekly Driving Report, Inbox intelligence, place & no-show alerts — for the whole household.",
  },
];

function isAlertType(type: string) {
  return (
    type.startsWith("family_") ||
    type.includes("geofence") ||
    type.includes("road") ||
    type.includes("weather") ||
    type.includes("ping")
  );
}

function formatWhen(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const mins = (Date.now() - t) / 60_000;
  if (mins < 1) return "Just now";
  if (mins < 60) return `${Math.round(mins)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });
}

/**
 * Life360-style Inbox: Alerts / Tips / Offers.
 * Alerts come from notifications; Tips & Offers are AI-assisted guidance (paid).
 */
export function FamilyInboxPanel({
  entitlements,
  onRefreshMap,
}: {
  entitlements: FamilyEntitlements;
  onRefreshMap?: () => void;
}) {
  const [tab, setTab] = useState<InboxTab>("alerts");
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as { items?: Notif[] };
      setItems(data.items ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const alerts = useMemo(() => items.filter((i) => isAlertType(i.type)), [items]);

  async function markRead(id: string) {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch {
      // ignore
    }
  }

  if (!entitlements.intelligence) {
    return (
      <section className="rounded-2xl border border-forward-200 bg-white p-4">
        <h3 className="font-display text-base font-semibold text-forward-900">Inbox</h3>
        <p className="mt-1 text-xs text-forward-500">
          Alerts, tips, and offers — part of Family Intelligence.
        </p>
        <div className="mt-3">
          <FamilyUpgradeCard
            headline={entitlements.upgradeHeadline}
            body={entitlements.upgradeBody}
            canUpgrade={entitlements.canUpgrade}
            onUpgraded={onRefreshMap}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-forward-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-forward-900">My Inbox</h3>
          <p className="mt-0.5 text-xs text-forward-500">
            Household alerts, tips, and offers — no paywall locks inside Family.
          </p>
        </div>
        <Bell className="mt-0.5 h-4 w-4 text-brand-blue" />
      </div>

      <div className="mt-3 flex gap-1 border-b border-forward-100">
        {(
          [
            ["alerts", "Alerts", Bell],
            ["tips", "Tips", Lightbulb],
            ["offers", "Offers", Gift],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex flex-1 items-center justify-center gap-1 border-b-2 px-2 py-2 text-xs font-semibold transition ${
              tab === id
                ? "border-brand-blue text-brand-blue"
                : "border-transparent text-forward-500 hover:text-forward-800"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 min-h-[140px]">
        {tab === "alerts" ? (
          loading ? (
            <p className="text-xs text-forward-500">Loading alerts…</p>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-8 text-center">
              <p className="text-sm font-semibold text-forward-800">Done and done</p>
              <p className="mt-1 text-xs text-forward-500">You have no new family alerts.</p>
            </div>
          ) : (
            <ul className="max-h-[280px] space-y-2 overflow-y-auto">
              {alerts.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.readAt) void markRead(n.id);
                      if (n.href) window.location.href = n.href;
                    }}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                      n.readAt
                        ? "border-forward-100 bg-white"
                        : "border-sky-200 bg-sky-50/80"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-forward-900">{n.title}</p>
                      <span className="shrink-0 text-[10px] text-forward-400">
                        {formatWhen(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-forward-600">{n.body}</p>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {tab === "tips" ? (
          <ul className="space-y-2">
            {TIPS.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-forward-100 bg-forward-50/60 px-3 py-2.5"
              >
                <p className="text-sm font-semibold text-forward-900">{t.title}</p>
                <p className="mt-0.5 text-xs text-forward-600">{t.body}</p>
              </li>
            ))}
          </ul>
        ) : null}

        {tab === "offers" ? (
          <ul className="space-y-2">
            {OFFERS.map((o) => (
              <li
                key={o.id}
                className="rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2.5"
              >
                <p className="inline-flex items-center gap-1 text-sm font-semibold text-forward-900">
                  <Lock className="h-3.5 w-3.5 text-violet-600" />
                  {o.title}
                </p>
                <p className="mt-0.5 text-xs text-forward-600">{o.body}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
