"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";

type AlertNotif = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

function isFamilyAlert(type: string) {
  return (
    type.startsWith("family_") ||
    type.includes("geofence") ||
    type.includes("road") ||
    type.includes("weather") ||
    type.includes("ping")
  );
}

/**
 * Live toast strip on the immersive Family Map — the sidebar bell is hidden there.
 */
export function FamilyMapAlertToasts({
  onOpenInbox,
}: {
  onOpenInbox?: () => void;
}) {
  const [toast, setToast] = useState<AlertNotif | null>(null);
  const [unread, setUnread] = useState(0);
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as {
        items?: AlertNotif[];
        unreadCount?: number;
      };
      const items = (data.items ?? []).filter((n) => isFamilyAlert(n.type));
      setUnread(items.filter((n) => !n.readAt).length);

      if (!primedRef.current) {
        for (const n of items) seenRef.current.add(n.id);
        primedRef.current = true;
        return;
      }

      const fresh = items.find((n) => !n.readAt && !seenRef.current.has(n.id));
      if (fresh) {
        seenRef.current.add(fresh.id);
        setToast(fresh);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void poll();
    const id = window.setInterval(() => void poll(), 12_000);
    return () => window.clearInterval(id);
  }, [poll]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 8_000);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function dismiss(markRead: boolean) {
    const current = toast;
    setToast(null);
    if (!current || !markRead) return;
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id }),
      });
      setUnread((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[4.75rem] z-[45] flex flex-col items-center gap-2 px-3 sm:top-[5.25rem]">
      {unread > 0 && !toast ? (
        <button
          type="button"
          onClick={() => onOpenInbox?.()}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-forward-950/90 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm"
        >
          <Bell className="h-3.5 w-3.5" />
          {unread} family alert{unread === 1 ? "" : "s"}
        </button>
      ) : null}

      {toast ? (
        <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_16px_40px_-18px_rgba(10,25,48,0.55)] ring-1 ring-forward-100">
          <div className="flex items-start gap-2 px-3 py-2.5">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
              <Bell className="h-4 w-4" />
            </span>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                void dismiss(true);
                onOpenInbox?.();
              }}
            >
              <span className="block truncate text-sm font-semibold text-forward-950">
                {toast.title}
              </span>
              <span className="mt-0.5 block line-clamp-2 text-xs text-forward-600">
                {toast.body}
              </span>
            </button>
            <button
              type="button"
              aria-label="Dismiss alert"
              className="shrink-0 rounded-full p-1 text-forward-400 hover:bg-forward-50 hover:text-forward-700"
              onClick={() => void dismiss(true)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
