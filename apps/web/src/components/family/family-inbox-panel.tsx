"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Gift, Lightbulb, Lock, Trash2 } from "lucide-react";
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

const DISMISSED_TIPS_KEY = "mymotivelife.inbox.dismissedTips";
const DISMISSED_OFFERS_KEY = "mymotivelife.inbox.dismissedOffers";

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

function readDismissed(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(key: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
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
  const [busy, setBusy] = useState(false);
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(() => new Set());
  const [dismissedOffers, setDismissedOffers] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setDismissedTips(readDismissed(DISMISSED_TIPS_KEY));
    setDismissedOffers(readDismissed(DISMISSED_OFFERS_KEY));
  }, []);

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
  const tips = useMemo(
    () => TIPS.filter((t) => !dismissedTips.has(t.id)),
    [dismissedTips]
  );
  const offers = useMemo(
    () => OFFERS.filter((o) => !dismissedOffers.has(o.id)),
    [dismissedOffers]
  );

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

  async function clearAlerts() {
    if (!alerts.length) return;
    if (!window.confirm("Clear all family alerts from your inbox?")) return;
    setBusy(true);
    try {
      await fetch("/api/notifications/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "alerts" }),
      });
      setItems((prev) => prev.filter((n) => !isAlertType(n.type)));
    } finally {
      setBusy(false);
    }
  }

  async function dismissAlert(id: string) {
    setBusy(true);
    try {
      await fetch("/api/notifications/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setItems((prev) => prev.filter((n) => n.id !== id));
    } finally {
      setBusy(false);
    }
  }

  function dismissTip(id: string) {
    const next = new Set(dismissedTips);
    next.add(id);
    setDismissedTips(next);
    writeDismissed(DISMISSED_TIPS_KEY, next);
  }

  function clearTips() {
    if (!tips.length) return;
    const next = new Set(dismissedTips);
    for (const t of TIPS) next.add(t.id);
    setDismissedTips(next);
    writeDismissed(DISMISSED_TIPS_KEY, next);
  }

  function dismissOffer(id: string) {
    const next = new Set(dismissedOffers);
    next.add(id);
    setDismissedOffers(next);
    writeDismissed(DISMISSED_OFFERS_KEY, next);
  }

  function clearOffers() {
    if (!offers.length) return;
    const next = new Set(dismissedOffers);
    for (const o of OFFERS) next.add(o.id);
    setDismissedOffers(next);
    writeDismissed(DISMISSED_OFFERS_KEY, next);
  }

  if (!entitlements.intelligence) {
    return (
      <section className="relative overflow-hidden rounded-[1.5rem] bg-white p-4 shadow-[0_10px_28px_-18px_rgba(10,25,48,0.28)] ring-1 ring-forward-100/90">
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
    <section className="relative overflow-hidden rounded-[1.5rem] bg-white p-4 shadow-[0_10px_28px_-18px_rgba(10,25,48,0.28)] ring-1 ring-forward-100/90">
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
            <div className="space-y-2">
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void clearAlerts()}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-forward-500 hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear alerts
                </button>
              </div>
              <ul className="max-h-[280px] space-y-2 overflow-y-auto">
                {alerts.map((n) => (
                  <li key={n.id} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.readAt) void markRead(n.id);
                        if (n.href) window.location.href = n.href;
                      }}
                      className={`w-full rounded-xl border px-3 py-2.5 pr-9 text-left transition ${
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
                    <button
                      type="button"
                      aria-label="Clear alert"
                      disabled={busy}
                      onClick={() => void dismissAlert(n.id)}
                      className="absolute right-2 top-2 rounded-full p-1 text-forward-400 hover:bg-forward-100 hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : null}

        {tab === "tips" ? (
          tips.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-8 text-center">
              <p className="text-sm font-semibold text-forward-800">Tips cleared</p>
              <p className="mt-1 text-xs text-forward-500">You’re all caught up.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={clearTips}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-forward-500 hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear tips
                </button>
              </div>
              <ul className="space-y-2">
                {tips.map((t) => (
                  <li
                    key={t.id}
                    className="relative rounded-xl border border-forward-100 bg-forward-50/60 px-3 py-2.5 pr-9"
                  >
                    <p className="text-sm font-semibold text-forward-900">{t.title}</p>
                    <p className="mt-0.5 text-xs text-forward-600">{t.body}</p>
                    <button
                      type="button"
                      aria-label="Dismiss tip"
                      onClick={() => dismissTip(t.id)}
                      className="absolute right-2 top-2 rounded-full p-1 text-forward-400 hover:bg-white hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : null}

        {tab === "offers" ? (
          offers.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-8 text-center">
              <p className="text-sm font-semibold text-forward-800">Offers cleared</p>
              <p className="mt-1 text-xs text-forward-500">Nothing waiting here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={clearOffers}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-forward-500 hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear offers
                </button>
              </div>
              <ul className="space-y-2">
                {offers.map((o) => (
                  <li
                    key={o.id}
                    className="relative rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2.5 pr-9"
                  >
                    <p className="inline-flex items-center gap-1 text-sm font-semibold text-forward-900">
                      <Lock className="h-3.5 w-3.5 text-violet-600" />
                      {o.title}
                    </p>
                    <p className="mt-0.5 text-xs text-forward-600">{o.body}</p>
                    <button
                      type="button"
                      aria-label="Dismiss offer"
                      onClick={() => dismissOffer(o.id)}
                      className="absolute right-2 top-2 rounded-full p-1 text-forward-400 hover:bg-white hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : null}
      </div>
    </section>
  );
}
