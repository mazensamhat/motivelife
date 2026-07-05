"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Calendar, Smartphone } from "lucide-react";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import { readApiJson } from "@/lib/fetch-api";
import type { CalendarConnectionStatus } from "@forward/shared";

interface CalendarPreview {
  title: string;
  start: string;
  source?: string;
}

export function IntegrationsPanel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = pathname || "/integrations";

  const [status, setStatus] = useState<CalendarConnectionStatus | null>(null);
  const [events, setEvents] = useState<CalendarPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [appleId, setAppleId] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [appleBusy, setAppleBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/integrations");
    const data = await readApiJson<CalendarConnectionStatus>(res);
    setStatus(data);

    if (data?.anyConnected) {
      const cal = await fetch("/api/calendar/events");
      const calData = await readApiJson<{ events?: CalendarPreview[] }>(cal);
      setEvents(calData?.events?.slice(0, 8) ?? []);
    } else {
      setEvents([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");

    if (connected === "google" || connected === "calendar") {
      setMessage("Google Calendar connected.");
    }
    if (error === "not_configured") {
      setMessage("Google OAuth is not configured — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
    }
    if (error === "denied") setMessage("Connection cancelled.");
    if (error === "server") setMessage("Connection failed. Try again.");
  }, [searchParams]);

  async function disconnectGoogle() {
    await fetch("/api/integrations/google/disconnect", { method: "POST" });
    setMessage("Google Calendar disconnected.");
    setLoading(true);
    await load();
  }

  async function disconnectApple() {
    await fetch("/api/integrations/apple/disconnect", { method: "POST" });
    setMessage("Apple Calendar disconnected.");
    setAppPassword("");
    setLoading(true);
    await load();
  }

  async function connectApple(e: React.FormEvent) {
    e.preventDefault();
    setAppleBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/integrations/apple/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appleId, appPassword }),
      });
      const data = await readApiJson<{ error?: string }>(res);
      if (!res.ok) {
        setMessage(data?.error ?? "Could not connect Apple Calendar.");
        return;
      }
      setMessage("Apple Calendar connected.");
      setAppPassword("");
      setLoading(true);
      await load();
    } finally {
      setAppleBusy(false);
    }
  }

  if (loading || !status) {
    return <div className="h-32 animate-pulse rounded-xl bg-forward-100" />;
  }

  const googleConnectHref = (() => {
    const url = new URL("/api/integrations/google/connect", window.location.origin);
    url.searchParams.set("returnTo", returnTo);
    return url.pathname + url.search;
  })();

  return (
    <div className="space-y-6">
      {message && (
        <Card className="border-brand-cyan/30 bg-brand-cyan/5 p-4">
          <p className="text-sm text-forward-700">{message}</p>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forward-100 text-forward-700">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <CardHeading className="text-base">Google Calendar</CardHeading>
            <p className="mt-1 text-sm text-forward-500">
              OAuth connect — read events and let Auto-Pilot write focus blocks to your calendar.
            </p>
            {status.google.connected && status.google.accountEmail && (
              <p className="mt-2 text-sm font-medium text-green-700">{status.google.accountEmail}</p>
            )}
            {status.google.connected && !status.google.writeEnabled ? (
              <p className="mt-2 text-sm text-amber-700">
                Reconnect Google to enable Auto-Pilot scheduling (calendar write access).
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {status.google.connected ? (
                <>
                  <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                    Connected{status.google.writeEnabled ? " · Auto-Pilot ready" : ""}
                  </span>
                  {!status.google.writeEnabled ? (
                    <a href={googleConnectHref}>
                      <Button size="sm">Reconnect for scheduling</Button>
                    </a>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={disconnectGoogle}>
                    Disconnect
                  </Button>
                </>
              ) : status.google.configured ? (
                <a href={googleConnectHref}>
                  <Button size="sm">Connect Google Calendar</Button>
                </a>
              ) : (
                <p className="text-sm text-forward-500">
                  Add Google OAuth keys in Vercel (see docs/INTEGRATIONS.md).
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forward-100 text-forward-700">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <CardHeading className="text-base">Apple Calendar (iCloud)</CardHeading>
            <p className="mt-1 text-sm text-forward-500">
              Uses CalDAV with an{" "}
              <a
                href="https://appleid.apple.com/account/manage"
                target="_blank"
                rel="noreferrer"
                className="text-brand-blue hover:underline"
              >
                app-specific password
              </a>
              . Read-only — events merge with Google on your timeline.
            </p>
            {status.apple.connected && status.apple.accountEmail && (
              <p className="mt-2 text-sm font-medium text-green-700">{status.apple.accountEmail}</p>
            )}
            {status.apple.connected ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                  Connected
                </span>
                <Button size="sm" variant="ghost" onClick={disconnectApple}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <form onSubmit={connectApple} className="mt-4 space-y-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-forward-500">Apple ID email</span>
                  <input
                    type="email"
                    value={appleId}
                    onChange={(e) => setAppleId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-forward-200 px-3 py-2"
                    placeholder="you@icloud.com"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-forward-500">App-specific password</span>
                  <input
                    type="password"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    required
                    autoComplete="off"
                    className="w-full rounded-lg border border-forward-200 px-3 py-2"
                    placeholder="xxxx-xxxx-xxxx-xxxx"
                  />
                </label>
                <Button type="submit" size="sm" disabled={appleBusy}>
                  {appleBusy ? "Connecting…" : "Connect Apple Calendar"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </Card>

      {events.length > 0 && (
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-forward-400">
            Upcoming events (merged)
          </p>
          <ul className="mt-3 space-y-2">
            {events.map((event, index) => (
              <li key={`${event.start}-${index}`} className="text-sm text-forward-700">
                {new Date(event.start).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                — {event.title}
                {event.source ? (
                  <span className="ml-1 text-xs text-forward-400">({event.source})</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
