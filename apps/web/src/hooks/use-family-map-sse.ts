"use client";

import { useEffect, useRef, useState } from "react";
import type { FamilyMapState } from "@forward/shared";

/**
 * Live Family Map via Server-Sent Events.
 * Returns whether the stream is healthy so the panel can slow HTTP polling.
 *
 * The server sends `rotate` a few seconds before the ~50s deadline so we can
 * open a new EventSource while the old one is still alive (no poll-storm gap).
 */
export function useFamilyMapSse(opts: {
  enabled: boolean;
  onMap: (state: FamilyMapState) => void;
  onError?: (message: string) => void;
}): { live: boolean } {
  const [live, setLive] = useState(false);
  const onMapRef = useRef(opts.onMap);
  const onErrorRef = useRef(opts.onError);
  onMapRef.current = opts.onMap;
  onErrorRef.current = opts.onError;

  useEffect(() => {
    if (!opts.enabled || typeof window === "undefined") {
      setLive(false);
      return;
    }
    if (typeof EventSource === "undefined") {
      setLive(false);
      return;
    }

    let closed = false;
    let es: EventSource | null = null;
    let outgoing: EventSource | null = null;
    let retryTimer: number | null = null;
    let staleTimer: number | null = null;
    let aliveTimer: number | null = null;
    let pendingMap: FamilyMapState | null = null;

    const clearTimer = (id: number | null) => {
      if (id != null) window.clearTimeout(id);
    };

    const clearAlive = () => {
      clearTimer(aliveTimer);
      aliveTimer = null;
    };

    const armAlive = () => {
      clearAlive();
      // Flaky mobile networks — allow longer silence before falling back to poll.
      const timeoutMs =
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("motivelife-native-shell")
          ? 25_000
          : 12_000;
      aliveTimer = window.setTimeout(() => {
        if (!closed) setLive(false);
      }, timeoutMs);
    };

    const closeSource = (source: EventSource | null) => {
      if (!source) return;
      try {
        source.close();
      } catch {
        // ignore
      }
    };

    const attach = (source: EventSource) => {
      source.addEventListener("open", () => {
        if (closed || source !== es) return;
        setLive(true);
        armAlive();
        if (outgoing) {
          closeSource(outgoing);
          outgoing = null;
        }
        clearTimer(staleTimer);
        staleTimer = null;
      });

      source.addEventListener("map", (ev) => {
        if (closed) return;
        if (source !== es && source !== outgoing) return;
        armAlive();
        setLive(true);
        try {
          const data = JSON.parse((ev as MessageEvent).data) as FamilyMapState;
          if (data?.household && Array.isArray(data.members)) {
            // Skip React apply while backgrounded — keep latest for resume.
            if (typeof document !== "undefined" && document.hidden) {
              pendingMap = data;
              return;
            }
            pendingMap = null;
            onMapRef.current(data);
          }
        } catch {
          // ignore malformed chunk
        }
      });

      source.addEventListener("rotate", () => {
        if (closed || source !== es) return;
        overlapConnect();
      });

      source.addEventListener("stream-error", (ev) => {
        if (closed) return;
        try {
          const body = JSON.parse((ev as MessageEvent).data) as {
            message?: string;
          };
          if (body.message) onErrorRef.current?.(body.message);
        } catch {
          // ignore
        }
      });

      source.onerror = () => {
        if (closed) return;
        // A dying outgoing socket during overlap — ignore; the new one is live.
        if (source !== es) return;
        if (source.readyState !== EventSource.CLOSED) return;
        if (retryTimer != null) return;
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          overlapConnect();
        }, 400);
      };
    };

    const overlapConnect = () => {
      if (closed) return;
      if (es && es.readyState === EventSource.CONNECTING) return;

      const prev = es;
      const next = new EventSource("/api/family/map/stream");
      es = next;
      attach(next);

      if (prev && prev.readyState !== EventSource.CLOSED) {
        outgoing = prev;
        clearTimer(staleTimer);
        staleTimer = window.setTimeout(() => {
          if (outgoing === prev) {
            closeSource(prev);
            outgoing = null;
          }
          staleTimer = null;
        }, 8_000);
      } else {
        closeSource(prev);
      }
    };

    const onVis = () => {
      // Keep the SSE socket open when backgrounded. Closing it (old behavior)
      // froze live pins overnight — Life360 keeps the stream and resumes
      // painting immediately. Only reconnect if the socket died while hidden.
      if (!document.hidden) {
        if (pendingMap) {
          const snap = pendingMap;
          pendingMap = null;
          onMapRef.current(snap);
        }
        if (!es || es.readyState === EventSource.CLOSED) {
          overlapConnect();
        } else {
          armAlive();
          setLive(true);
        }
      }
    };

    if (!document.hidden) overlapConnect();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", onVis);
      clearAlive();
      clearTimer(retryTimer);
      clearTimer(staleTimer);
      closeSource(outgoing);
      closeSource(es);
      outgoing = null;
      es = null;
      setLive(false);
    };
  }, [opts.enabled]);

  return { live };
}
