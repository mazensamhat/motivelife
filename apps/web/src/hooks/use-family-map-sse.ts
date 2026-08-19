"use client";

import { useEffect, useRef, useState } from "react";
import type { FamilyMapState } from "@forward/shared";

/**
 * Live Family Map via Server-Sent Events.
 * Returns whether the stream is healthy so the panel can slow HTTP polling.
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
    let retryTimer: number | null = null;
    let aliveTimer: number | null = null;
    let pendingMap: FamilyMapState | null = null;

    const clearAlive = () => {
      if (aliveTimer != null) {
        window.clearTimeout(aliveTimer);
        aliveTimer = null;
      }
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

    const connect = () => {
      if (closed) return;
      try {
        es?.close();
      } catch {
        // ignore
      }
      es = new EventSource("/api/family/map/stream");

      es.addEventListener("open", () => {
        if (closed) return;
        setLive(true);
        armAlive();
      });

      es.addEventListener("map", (ev) => {
        if (closed) return;
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

      es.addEventListener("stream-error", (ev) => {
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

      // Browser fires onerror on disconnect; we reconnect after server closes (~50s).
      es.onerror = () => {
        if (closed) return;
        setLive(false);
        if (es?.readyState === EventSource.CLOSED && retryTimer == null) {
          retryTimer = window.setTimeout(() => {
            retryTimer = null;
            connect();
          }, 1_200);
        }
      };
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
          connect();
        } else {
          armAlive();
          setLive(true);
        }
      }
    };

    if (!document.hidden) connect();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", onVis);
      clearAlive();
      if (retryTimer != null) window.clearTimeout(retryTimer);
      try {
        es?.close();
      } catch {
        // ignore
      }
      setLive(false);
    };
  }, [opts.enabled]);

  return { live };
}
