"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw, Smartphone, Watch } from "lucide-react";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import { isNativeIosShell } from "@/lib/native-shell";

export type HealthIntegrationUiStatus = {
  fitbit: {
    configured: boolean;
    connected: boolean;
    accountId: string | null;
    lastSyncAt: string | null;
    redirectUri?: string;
  };
  healthConnect: {
    availableOnWeb: boolean;
    syncedToday: boolean;
    lastSyncAt: string | null;
    hint: string;
  };
  summary: {
    steps: number | null;
    sleepMinutes: number | null;
    restingHr: number | null;
    activeMinutes: number | null;
    lastSyncedAt: string | null;
    sources: string[];
  };
};

export function HealthIntegrationsCard({
  health,
  returnTo,
  onChange,
}: {
  health: HealthIntegrationUiStatus;
  returnTo: string;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isIosShell, setIsIosShell] = useState(false);

  useEffect(() => {
    setIsIosShell(isNativeIosShell());
  }, []);

  const fitbitHref = (() => {
    const url = new URL("/api/integrations/fitbit/connect", window.location.origin);
    url.searchParams.set("returnTo", returnTo);
    return url.pathname + url.search;
  })();

  async function syncFitbit() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/fitbit/sync", { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Sync failed.");
        return;
      }
      setMessage("Fitbit synced.");
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function disconnectFitbit() {
    setBusy(true);
    await fetch("/api/integrations/fitbit/disconnect", { method: "POST" });
    setBusy(false);
    onChange();
  }

  async function syncPhoneHealth() {
    setBusy(true);
    setMessage(null);
    try {
      const { syncHealthConnectFromDevice } = await import("@/lib/capacitor-health-bridge");
      const result = await syncHealthConnectFromDevice();
      if (!result.ok) {
        setMessage(result.error ?? "Phone health sync unavailable.");
        return;
      }
      setMessage(`Synced ${result.count ?? 0} metrics from ${isIosShell ? "Apple Health" : "phone health"}.`);
      onChange();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Phone health sync failed.");
    } finally {
      setBusy(false);
    }
  }

  const s = health.summary;
  const phoneSourceLabel = health.summary.sources.includes("apple_health")
    ? "Apple Health"
    : health.summary.sources.includes("health_connect")
      ? "Health Connect"
      : null;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forward-100 text-forward-700">
          <Activity className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <CardHeading className="text-base">Health &amp; wearables</CardHeading>
          <p className="mt-1 text-sm text-forward-500">
            Optional. Apple Watch, Samsung Galaxy Watch, and Fitbit can feed Vitalu — manual logging
            still works without any wearable.
          </p>

          {(s.steps != null || s.sleepMinutes != null) && (
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-forward-700">
              {s.steps != null ? <span>{Math.round(s.steps).toLocaleString()} steps today</span> : null}
              {s.sleepMinutes != null ? (
                <span>{Math.round((s.sleepMinutes / 60) * 10) / 10}h sleep</span>
              ) : null}
              {s.restingHr != null ? <span>{Math.round(s.restingHr)} bpm resting</span> : null}
              {s.activeMinutes != null ? <span>{Math.round(s.activeMinutes)} min active</span> : null}
              {phoneSourceLabel ? (
                <span className="text-forward-500">via {phoneSourceLabel}</span>
              ) : null}
            </div>
          )}

          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-forward-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-brand-blue" />
                  <span className="font-medium text-forward-900">
                    {isIosShell ? "Apple Health / Apple Watch" : "Phone health sync"}
                  </span>
                </div>
                {health.healthConnect.syncedToday ? (
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    Synced today
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-forward-500">{health.healthConnect.hint}</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                disabled={busy}
                onClick={() => void syncPhoneHealth()}
              >
                {busy
                  ? "Syncing…"
                  : isIosShell
                    ? "Sync Apple Health"
                    : "Sync phone health"}
              </Button>
            </div>

            <div className="rounded-lg border border-forward-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Watch className="h-4 w-4 text-teal-600" />
                  <span className="font-medium text-forward-900">Fitbit</span>
                </div>
                {health.fitbit.connected ? (
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    Connected
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-forward-500">
                Web OAuth sync — works on any device, including when Apple Health is unavailable.
              </p>
              {health.fitbit.connected ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" disabled={busy} onClick={syncFitbit}>
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    Sync now
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={disconnectFitbit}>
                    Disconnect
                  </Button>
                </div>
              ) : health.fitbit.configured ? (
                <a href={fitbitHref} className="mt-2 inline-block">
                  <Button size="sm">Connect Fitbit</Button>
                </a>
              ) : (
                <div className="mt-2 space-y-2">
                  <a href={fitbitHref} className="inline-block">
                    <Button size="sm" variant="secondary">
                      Connect Fitbit
                    </Button>
                  </a>
                  <p className="text-xs text-forward-500">
                    Optional. If Google Health OAuth is not configured on this environment, the
                    connect step will say so.
                  </p>
                </div>
              )}
            </div>
          </div>

          {message ? (
            <p
              className={`mt-3 text-sm ${
                /fail|denied|unavailable|update|browser|timed out|no health|no apple/i.test(message)
                  ? "text-amber-700"
                  : "text-forward-600"
              }`}
              role="status"
            >
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
