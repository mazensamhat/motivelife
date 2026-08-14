"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, Lightbulb, Lock, Trash2 } from "lucide-react";
import { FamilyUpgradeCard } from "@/components/family/family-upgrade-card";
import type { FamilyEntitlements } from "@forward/shared";
import { resolveAlertNavigationHref } from "@/lib/alert-navigation";
import { FAMILY_BUBBLE_CARD } from "@/lib/family-map/ui-theme";

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
 * Arrival & driving alerts are free; Tips & Offers stay Family Intelligence.
 */
export function FamilyInboxPanel({
  entitlements,
  onRefreshMap,
  demoAlerts,
}: {
  entitlements: FamilyEntitlements;
  onRefreshMap?: () => void;
  /** Sample alerts for public preview (skips notifications API). */
  demoAlerts?: Notif[];
}) {
  const [tab, setTab] = useState<InboxTab>("alerts");
  const [items, setItems] = useState<Notif[]>(demoAlerts ?? []);
  const [loading, setLoading] = useState(!demoAlerts);
  const [busy, setBusy] = useState(false);
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(() => new Set());
  const [dismissedOffers, setDismissedOffers] = useState<Set<string>>(() => new Set());
  const extrasLocked = !entitlements.intelligence;

  useEffect(() => {
    setDismissedTips(readDismissed(DISMISSED_TIPS_KEY));
    setDismissedOffers(readDismissed(DISMISSED_OFFERS_KEY));
  }, []);

  const load = useCallback(async () => {
    if (demoAlerts) {
      setItems(demoAlerts);
      setLoading(false);
      return;
    }
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
  }, [demoAlerts]);

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

  return (
    <section className={FAMILY_BUBBLE_CARD}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-forward-900">Inbox</h3>
          <p className="mt-1 text-xs text-forward-500">
            Arrival, leave, and driving alerts for your household.
          </p>
        </div>
        {tab === "alerts" && alerts.length > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void clearAlerts()}
            className="inline-flex items-center gap-1 rounded-full bg-forward-100 px-2.5 py-1 text-[11px] font-semibold text-forward-700"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex gap-1 rounded-full bg-forward-50 p-1">
        {(
          [
            ["alerts", "Alerts"],
            ["tips", "Tips"],
            ["offers", "Offers"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-full px-2 py-1.5 text-xs font-semibold transition ${
              tab === id
                ? "bg-white text-forward-900 shadow-sm"
                : "text-forward-500 hover:text-forward-800"
            }`}
          >
            {label}
            {id !== "alerts" && extrasLocked ? (
              <Lock className="ml-1 inline h-3 w-3 opacity-60" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === "alerts" ? (
          loading ? (
            <p className="py-6 text-center text-xs text-forward-400">Loading alerts…</p>
          ) : alerts.length === 0 ? (
            <p className="rounded-2xl bg-forward-50 px-3 py-5 text-center text-xs text-forward-500">
              No alerts yet. When someone arrives at or leaves a saved place — or finishes a drive —
              it shows up here.
            </p>
          ) : (
            <ul className="max-h-[280px] space-y-2 overflow-y-auto">
              {alerts.map((n) => (
                <li
                  key={n.id}
                  className={`relative rounded-2xl px-3 py-2.5 pr-9 ring-1 ${
                    n.readAt ? "bg-white ring-forward-100" : "bg-sky-50/80 ring-sky-100"
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      if (!n.readAt) void markRead(n.id);
                      const target = resolveAlertNavigationHref(n.type, n.href);
                      if (target) window.location.href = target;
                    }}
                  >
                    <span className="block text-sm font-semibold text-forward-950">{n.title}</span>
                    <span className="mt-0.5 block text-xs text-forward-600">{n.body}</span>
                    <span className="mt-1 block text-[11px] text-forward-400">
                      {formatWhen(n.createdAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    disabled={busy}
                    className="absolute right-2 top-2 rounded-full p-1 text-forward-400 hover:bg-white hover:text-forward-700"
                    onClick={() => void dismissAlert(n.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {tab === "tips" ? (
          extrasLocked ? (
            <FamilyUpgradeCard
              headline={entitlements.upgradeHeadline}
              body={entitlements.upgradeBody}
              canUpgrade={entitlements.canUpgrade}
              onUpgraded={onRefreshMap}
            />
          ) : tips.length === 0 ? (
            <p className="py-6 text-center text-xs text-forward-400">You’re all caught up on tips.</p>
          ) : (
            <div className="space-y-2">
              <ul className="space-y-2">
                {tips.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-2xl bg-amber-50/70 px-3 py-2.5 ring-1 ring-amber-100"
                  >
                    <div className="flex items-start gap-2">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-forward-950">{t.title}</p>
                        <p className="mt-0.5 text-xs text-forward-600">{t.body}</p>
                      </div>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-forward-500"
                        onClick={() => dismissTip(t.id)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="w-full text-center text-[11px] font-semibold text-forward-500"
                onClick={clearTips}
              >
                Clear tips
              </button>
            </div>
          )
        ) : null}

        {tab === "offers" ? (
          extrasLocked ? (
            <FamilyUpgradeCard
              headline={entitlements.upgradeHeadline}
              body={entitlements.upgradeBody}
              canUpgrade={entitlements.canUpgrade}
              onUpgraded={onRefreshMap}
            />
          ) : offers.length === 0 ? (
            <p className="py-6 text-center text-xs text-forward-400">No offers right now.</p>
          ) : (
            <div className="space-y-2">
              <ul className="space-y-2">
                {offers.map((o) => (
                  <li
                    key={o.id}
                    className="rounded-2xl bg-emerald-50/70 px-3 py-2.5 ring-1 ring-emerald-100"
                  >
                    <div className="flex items-start gap-2">
                      <Gift className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-forward-950">{o.title}</p>
                        <p className="mt-0.5 text-xs text-forward-600">{o.body}</p>
                      </div>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-forward-500"
                        onClick={() => dismissOffer(o.id)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="w-full text-center text-[11px] font-semibold text-forward-500"
                onClick={clearOffers}
              >
                Clear offers
              </button>
            </div>
          )
        ) : null}
      </div>
    </section>
  );
}
