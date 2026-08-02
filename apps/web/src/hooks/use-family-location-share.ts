"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FamilyMapState } from "@forward/shared";

type Options = {
  enabled: boolean;
  onState?: (state: FamilyMapState) => void;
  intervalMs?: number;
};

type GeoLike = {
  watchPosition: (
    success: (pos: { coords: GeolocationCoordinates; timestamp: number }) => void,
    error?: (err: { message?: string }) => void,
    opts?: PositionOptions
  ) => Promise<string> | number | string;
  clearWatch: (id: string | number) => void | Promise<void>;
  getCurrentPosition: (
    success: (pos: { coords: GeolocationCoordinates; timestamp: number }) => void,
    error?: (err: { message?: string }) => void,
    opts?: PositionOptions
  ) => void | Promise<void>;
};

/** Prefer Capacitor Geolocation on native shells for background-capable watches. */
async function resolveGeo(): Promise<GeoLike | null> {
  try {
    const mod = await import("@capacitor/geolocation").catch(() => null);
    if (mod?.Geolocation) {
      return {
        watchPosition: (success, error, opts) =>
          mod.Geolocation.watchPosition(
            {
              enableHighAccuracy: opts?.enableHighAccuracy ?? true,
              timeout: opts?.timeout,
              maximumAge: opts?.maximumAge,
            },
            (pos, err) => {
              if (err) {
                error?.({ message: err.message });
                return;
              }
              if (pos) success(pos as GeolocationPosition);
            }
          ),
        clearWatch: (id) => mod.Geolocation.clearWatch({ id: String(id) }),
        getCurrentPosition: async (success, error, opts) => {
          try {
            const pos = await mod.Geolocation.getCurrentPosition({
              enableHighAccuracy: opts?.enableHighAccuracy ?? true,
              timeout: opts?.timeout,
              maximumAge: opts?.maximumAge,
            });
            success(pos as GeolocationPosition);
          } catch (e) {
            error?.({ message: e instanceof Error ? e.message : "Location error" });
          }
        },
      };
    }
  } catch {
    // fall through to browser
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  const browser = navigator.geolocation;
  return {
    watchPosition: (success, error, opts) =>
      browser.watchPosition(success, error, opts),
    clearWatch: (id) => browser.clearWatch(Number(id)),
    getCurrentPosition: (success, error, opts) =>
      browser.getCurrentPosition(success, error, opts),
  };
}

export function useFamilyLocationShare({ enabled, onState, intervalMs = 12_000 }: Options) {
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [lastFixAt, setLastFixAt] = useState<string | null>(null);
  const watchId = useRef<string | number | null>(null);
  const lastSent = useRef(0);
  const onStateRef = useRef(onState);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  onStateRef.current = onState;

  const pushFix = useCallback(async (coords: GeolocationCoordinates) => {
    const now = Date.now();
    if (now - lastSent.current < 4000) return;
    lastSent.current = now;

    const speedKmh =
      coords.speed != null && coords.speed >= 0 ? coords.speed * 3.6 : null;

    let batteryPercent: number | null = null;
    try {
      const nav = navigator as Navigator & {
        getBattery?: () => Promise<{ level: number }>;
      };
      if (nav.getBattery) {
        const bat = await nav.getBattery();
        batteryPercent = Math.round(bat.level * 100);
      }
    } catch {
      // optional
    }

    try {
      const payload = {
        lat: coords.latitude,
        lng: coords.longitude,
        accuracyM: coords.accuracy,
        speedKmh,
        headingDeg: coords.heading != null && coords.heading >= 0 ? coords.heading : null,
        batteryPercent,
      };
      const res = await fetch("/api/family/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not share location.");
        return;
      }
      const state = (await res.json()) as FamilyMapState;
      setLastFixAt(new Date().toISOString());
      setError(null);
      onStateRef.current?.(state);

      // Also fan out to active Friends circles (session share) — fire and forget
      void fetch("/api/circles/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: coords.latitude,
          lng: coords.longitude,
          batteryPercent,
        }),
      }).catch(() => undefined);
    } catch {
      setError("Network error while sharing location.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let poll: number | undefined;
    let geo: GeoLike | null = null;

    async function start() {
      if (!enabled) return;
      geo = await resolveGeo();
      if (cancelled) return;
      if (!geo) {
        setError("Geolocation is not available.");
        return;
      }

      setSharing(true);

      // Keep screen/process more alive on mobile browsers while map is open
      try {
        if ("wakeLock" in navigator) {
          wakeLock.current = await navigator.wakeLock.request("screen");
        }
      } catch {
        // optional
      }

      const opts: PositionOptions = {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20_000,
      };

      const id = await Promise.resolve(
        geo.watchPosition(
          (pos) => {
            void pushFix(pos.coords);
          },
          (err) => {
            setError(err.message || "Location permission denied.");
            setSharing(false);
          },
          opts
        )
      );
      watchId.current = id;

      poll = window.setInterval(() => {
        void geo?.getCurrentPosition(
          (pos) => void pushFix(pos.coords),
          () => undefined,
          { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
        );
      }, intervalMs);

      // Resume watch when tab becomes visible again
      const onVis = () => {
        if (document.visibilityState === "visible") {
          void geo?.getCurrentPosition(
            (pos) => void pushFix(pos.coords),
            () => undefined,
            opts
          );
        }
      };
      document.addEventListener("visibilitychange", onVis);
      (start as { _onVis?: () => void })._onVis = onVis;
    }

    if (!enabled) {
      setSharing(false);
      return;
    }

    void start();

    return () => {
      cancelled = true;
      const onVis = (start as { _onVis?: () => void })._onVis;
      if (onVis) document.removeEventListener("visibilitychange", onVis);
      if (watchId.current != null && geo) {
        void geo.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (poll) window.clearInterval(poll);
      if (wakeLock.current) {
        void wakeLock.current.release();
        wakeLock.current = null;
      }
    };
  }, [enabled, intervalMs, pushFix]);

  return { sharing, error, lastFixAt };
}
