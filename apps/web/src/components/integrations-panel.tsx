"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import { readApiJson } from "@/lib/fetch-api";

interface IntegrationStatus {
  google: {
    configured: boolean;
    connected: boolean;
    accountEmail: string | null;
  };
}

interface CalendarPreview {
  title: string;
  start: string;
}

export function IntegrationsPanel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = pathname || "/integrations";

  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [events, setEvents] = useState<CalendarPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch("/api/integrations");
    const data = await readApiJson<IntegrationStatus>(res);
    setStatus(data);

    if (data?.google?.connected) {
      const cal = await fetch("/api/calendar/events");
      const calData = await readApiJson<{ events?: CalendarPreview[] }>(cal);
      setEvents(calData?.events?.slice(0, 5) ?? []);
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

  async function disconnect() {
    await fetch("/api/integrations/google/disconnect", { method: "POST" });
    setMessage("Google Calendar disconnected.");
    setLoading(true);
    await load();
  }

  if (loading || !status) {
    return <div className="h-32 animate-pulse rounded-xl bg-forward-100" />;
  }

  const connectHref = (() => {
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
              Sync your schedule for morning briefings and time-aware suggestions. Read-only
              access.
            </p>
            {status.google.connected && status.google.accountEmail && (
              <p className="mt-2 text-sm font-medium text-green-700">{status.google.accountEmail}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {status.google.connected ? (
                <>
                  <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                    Connected
                  </span>
                  <Button size="sm" variant="ghost" onClick={disconnect}>
                    Disconnect
                  </Button>
                </>
              ) : status.google.configured ? (
                <a href={connectHref}>
                  <Button size="sm">Connect Google Calendar</Button>
                </a>
              ) : (
                <p className="text-sm text-forward-500">
                  Add Google OAuth keys to apps/web/.env.local (see docs/INTEGRATIONS.md).
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {events.length > 0 && (
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-forward-400">
            Upcoming events
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
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
