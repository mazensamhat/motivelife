"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FamilyMapState } from "@forward/shared";

type Options = {
  enabled: boolean;
  onState?: (state: FamilyMapState) => void;
  onDenied?: () => void;
  intervalMs?: number;
};

type GeoLike = {
  watchPosition: (
    success: (pos: { coords: GeolocationCoordinates; timestamp: number }) => void,
    error?: (err: { code?: number; message?: string }) => void,
    opts?: PositionOptions
  ) => Promise<string> | number | string;
  clearWatch: (id: string | number) => void | Promise<void>;
  getCurrentPosition: (
    success: (pos: { coords: GeolocationCoordinates; timestamp: number }) => void,
    error?: (err: { code?: number; message?: string }) => void,
    opts?: PositionOptions
  ) => void | Promise<void>;
};

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
                error?.({ message: err.message, code: 1 });
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
            error?.({
              message: e instanceof Error ? e.message : "Location error",
              code: 1,
            });
          }
        },
      };
    }
  } catch {
    // browser
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  const browser = navigator.geolocation;
  return {
    watchPosition: (success, error, opts) =>
      browser.watchPosition(success, error as PositionErrorCallback, opts),
    clearWatch: (id) => browser.clearWatch(Number(id)),
    getCurrentPosition: (success, error, opts) =>
      browser.getCurrentPosition(success, error as PositionErrorCallback, opts),
  };
}

function isDenied(err: { code?: number; message?: string } | undefined) {
  if (!err) return false;
  if (err.code === 1) return true;
  return /denied|permission/i.test(err.message ?? "");
}

export function useFamilyLocationShare({
  enabled,
  onState,
  onDenied,
  intervalMs = 12_000,
}: Options) {
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [lastFixAt, setLastFixAt] = useState<string | null>(null);
  const watchId = useRef<string | number | null>(null);
  const lastSent = useRef(0);
  const onStateRef = useRef(onState);
  const onDeniedRef = useRef(onDenied);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  onStateRef.current = onState;
  onDeniedRef.current = onDenied;

  const clearError = useCallback(() => setError(null), []);

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
      const res = await fetch("/api/family/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracyM: coords.accuracy,
          speedKmh,
          headingDeg: coords.heading != null && coords.heading >= 0 ? coords.heading : null,
          batteryPercent,
        }),
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
    if (!enabled) {
      setSharing(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let poll: number | undefined;
    let geo: GeoLike | null = null;
    let onVis: (() => void) | undefined;

    async function start() {
      geo = await resolveGeo();
      if (cancelled) return;
      if (!geo) {
        setError("Location isn’t available here.");
        setSharing(false);
        onDeniedRef.current?.();
        return;
      }

      const opts: PositionOptions = {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 12_000,
      };

      const handleErr = (err: { code?: number; message?: string }) => {
        if (isDenied(err)) {
          setError(
            "Location permission is off. Use Enable location below — or allow it in your phone / browser settings."
          );
          setSharing(false);
          onDeniedRef.current?.();
          return;
        }
        setError(err.message || "Could not get location.");
        setSharing(false);
      };

      setSharing(true);

      try {
        if ("wakeLock" in navigator) {
          wakeLock.current = await navigator.wakeLock.request("screen");
        }
      } catch {
        // optional
      }

      try {
        const id = await Promise.resolve(
          geo.watchPosition((pos) => void pushFix(pos.coords), handleErr, opts)
        );
        watchId.current = id;
      } catch (e) {
        handleErr({
          message: e instanceof Error ? e.message : "Location error",
          code: 1,
        });
        return;
      }

      poll = window.setInterval(() => {
        void geo?.getCurrentPosition(
          (pos) => void pushFix(pos.coords),
          () => undefined,
          { enableHighAccuracy: true, maximumAge: 15_000, timeout: 10_000 }
        );
      }, intervalMs);

      onVis = () => {
        if (document.visibilityState !== "visible") return;
        void geo?.getCurrentPosition(
          (pos) => void pushFix(pos.coords),
          () => undefined,
          opts
        );
      };
      document.addEventListener("visibilitychange", onVis);
    }

    void start();

    return () => {
      cancelled = true;
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

  return { sharing, error, lastFixAt, clearError };
}
