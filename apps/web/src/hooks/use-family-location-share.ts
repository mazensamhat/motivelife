"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FamilyMapState } from "@forward/shared";
import {
  canUseNativeLocationBridge,
  fetchNativeSessionToken,
  requestNativeLocationFix,
  startNativeBackgroundLocation,
} from "@/lib/family-map/native-location-bridge";
import { ingestLocalHistoryFix } from "@/lib/family-map/local-trip-engine";
import type { VehicleFuelHints } from "@/lib/family-map/local-history-types";
import { postFamilyLocationFix } from "@/lib/family-map/post-location-fix";

type Options = {
  enabled: boolean;
  onState?: (state: FamilyMapState) => void;
  /** Immediate GPS preview (not throttled) — keeps your pin sliding between server posts. */
  onLocalFix?: (fix: {
    lat: number;
    lng: number;
    speedKmh: number | null;
    headingDeg: number | null;
    accuracyM: number | null;
  }) => void;
  /**
   * Phone is alive (GPS sample and/or successful post). Refresh your
   * "Updated Now" without necessarily moving the pin (fuzzy indoor GPS).
   */
  onLiveness?: (atIso: string) => void;
  onDenied?: () => void;
  intervalMs?: number;
  /** Your household member id — required to write on-device history. */
  memberId?: string | null;
  placeName?: string | null;
  vehicle?: VehicleFuelHints | null;
  onLocalTripComplete?: () => void;
};

function withSelfLiveness(state: FamilyMapState, atIso: string): FamilyMapState {
  const idx = state.members.findIndex((m) => m.isYou);
  if (idx < 0) return state;
  const you = state.members[idx]!;
  const members = state.members.slice();
  members[idx] = { ...you, lastLocationAt: atIso };
  return { ...state, members };
}

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
  onLocalFix,
  onLiveness,
  onDenied,
  intervalMs = 8_000,
  memberId = null,
  placeName = null,
  vehicle = null,
  onLocalTripComplete,
}: Options) {
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [lastFixAt, setLastFixAt] = useState<string | null>(null);
  const watchId = useRef<string | number | null>(null);
  const lastSent = useRef(0);
  const onStateRef = useRef(onState);
  const onLocalFixRef = useRef(onLocalFix);
  const onLivenessRef = useRef(onLiveness);
  const onDeniedRef = useRef(onDenied);
  const memberIdRef = useRef(memberId);
  const placeNameRef = useRef(placeName);
  const vehicleRef = useRef(vehicle);
  const onLocalTripCompleteRef = useRef(onLocalTripComplete);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  onStateRef.current = onState;
  onLocalFixRef.current = onLocalFix;
  onLivenessRef.current = onLiveness;
  onDeniedRef.current = onDenied;
  memberIdRef.current = memberId;
  placeNameRef.current = placeName;
  vehicleRef.current = vehicle;
  onLocalTripCompleteRef.current = onLocalTripComplete;

  const clearError = useCallback(() => setError(null), []);

  const lastLocalFix = useRef<{
    lat: number;
    lng: number;
    at: number;
  } | null>(null);

  const pushFix = useCallback(async (coords: GeolocationCoordinates, recordedAtMs?: number) => {
    const recordedAt =
      recordedAtMs && Number.isFinite(recordedAtMs) ? recordedAtMs : Date.now();
    const ageMs = Math.max(0, Date.now() - recordedAt);
    let speedKmh =
      coords.speed != null && coords.speed >= 0
        ? Math.round(coords.speed * 3.6 * 10) / 10
        : null;
    // Stale Doppler while sitting at a park / couch.
    if (ageMs > 20_000 && (speedKmh == null || speedKmh < 55)) speedKmh = 0;
    if (speedKmh != null && speedKmh < 1.5) speedKmh = 0;
    if (
      speedKmh != null &&
      speedKmh > 0 &&
      speedKmh <= 50 &&
      coords.accuracy != null &&
      coords.accuracy > 45 &&
      speedKmh < 12
    ) {
      speedKmh = 0;
    }
    // Zero reported speed when the pin barely moved since the last fix.
    // First sample after login/wake has no prior pin — drop walking-band
    // leftover Doppler so we don't flash Walking while sitting.
    const prev = lastLocalFix.current;
    if (!prev && speedKmh != null && speedKmh > 0 && speedKmh < 12) {
      speedKmh = 0;
    } else if (prev && speedKmh != null && speedKmh > 0 && speedKmh <= 50) {
      const dn = (coords.latitude - prev.lat) * 111_320;
      const de =
        (coords.longitude - prev.lng) *
        111_320 *
        Math.max(0.2, Math.cos((coords.latitude * Math.PI) / 180));
      const movedM = Math.hypot(dn, de);
      const stillFloor = Math.max(18, (coords.accuracy ?? 40) * 0.5);
      if (movedM < stillFloor) speedKmh = 0;
    }
    lastLocalFix.current = {
      lat: coords.latitude,
      lng: coords.longitude,
      at: recordedAt,
    };
    const headingDeg =
      coords.heading != null && coords.heading >= 0 ? coords.heading : null;

    // Fuzzy indoor GPS — do not slide the optimistic pin (bounce), but still
    // heartbeat below so households see "Updated Now".
    const fuzzyStationary =
      coords.accuracy != null &&
      coords.accuracy > 150 &&
      (speedKmh == null || speedKmh < 1.5);

    const liveAt = new Date().toISOString();
    // Always refresh self liveness when GPS ticks — even fuzzy / throttled posts.
    onLivenessRef.current?.(liveAt);

    if (!fuzzyStationary) {
      onLocalFixRef.current?.({
        lat: coords.latitude,
        lng: coords.longitude,
        speedKmh,
        headingDeg,
        accuracyM: coords.accuracy ?? null,
      });
    }

    const now = Date.now();
    // Moving: post often so household pins stay fluid on the highway.
    // Fuzzy stationary: heartbeat every ~12s for liveness without spam.
    const moving = speedKmh != null && speedKmh >= 5;
    const minGap = fuzzyStationary ? 12_000 : moving ? 500 : 2_500;
    if (lastSent.current > 0 && now - lastSent.current < minGap) return;

    // On-device history first — survives network hiccups; user-owned on this phone.
    const mid = memberIdRef.current;
    if (mid) {
      try {
        const local = await ingestLocalHistoryFix({
          memberId: mid,
          lat: coords.latitude,
          lng: coords.longitude,
          speedKmh,
          headingDeg,
          accuracyM: coords.accuracy ?? null,
          placeName: placeNameRef.current,
          vehicle: vehicleRef.current,
        });
        if (local.completedTrip) onLocalTripCompleteRef.current?.();
      } catch {
        // history is best-effort
      }
    }

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

    const recordedAtIso =
      recordedAtMs && Number.isFinite(recordedAtMs)
        ? new Date(recordedAtMs).toISOString()
        : undefined;

    const posted = await postFamilyLocationFix({
      lat: coords.latitude,
      lng: coords.longitude,
      accuracyM: coords.accuracy,
      speedKmh,
      headingDeg,
      batteryPercent,
      recordedAt: recordedAtIso,
    });
    if (!posted.ok) {
      setError(posted.error);
      return;
    }

    lastSent.current = now;
    // Use receive time — deferred GPS clocks must not make "Live" look stale.
    setLastFixAt(liveAt);
    setError(null);
    onLivenessRef.current?.(liveAt);
    // Light ingest ack has no map payload — SSE / poll refreshes pins.
    if (posted.state) {
      onStateRef.current?.(withSelfLiveness(posted.state, liveAt));
    }

    void fetch("/api/circles/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        lat: coords.latitude,
        lng: coords.longitude,
        batteryPercent,
      }),
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!enabled) {
      // Web watch / poll only. Do NOT stop the native Always task here —
      // leaving Family Map, a brief state gap, or remount used to kill iOS
      // background tracking. Native stop happens only via explicit user Off
      // (disableLocationSharing → stopBackgroundLocationSharing).
      setSharing(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let poll: number | undefined;
    let heartbeat: number | undefined;
    let geo: GeoLike | null = null;
    let onVis: (() => void) | undefined;

    async function pushNativeFix() {
      // Silent — never re-prompt permissions on poll / resume.
      const result = await requestNativeLocationFix({ timeoutMs: 12_000, silent: true });
      if (cancelled) return;
      if (!result.ok) {
        // Do not clear Share Live on silent failures — probes can flake, and older
        // app builds may not support silent reads yet. Keep retrying quietly.
        setError(result.message);
        return;
      }
      const coords = {
        latitude: result.fix.lat,
        longitude: result.fix.lng,
        accuracy: result.fix.accuracyM ?? 25,
        altitude: null,
        altitudeAccuracy: null,
        heading: result.fix.headingDeg,
        speed:
          result.fix.speedKmh != null ? result.fix.speedKmh / 3.6 : null,
      } as GeolocationCoordinates;
      setSharing(true);
      setError(null);
      const recordedAtMs = result.fix.recordedAt
        ? Date.parse(result.fix.recordedAt)
        : undefined;
      await pushFix(coords, Number.isFinite(recordedAtMs) ? recordedAtMs : undefined);
    }

    async function start() {
      // Expo AppShell (Fold / Play) — native expo-location bridge
      if (canUseNativeLocationBridge()) {
        setSharing(true);
        // Resume path: arm background task without Always / permission nags.
        const token = await fetchNativeSessionToken();
        if (!cancelled && token) {
          await startNativeBackgroundLocation(token, { promptAlways: false });
        }
        if (cancelled) return;
        await pushNativeFix();
        if (cancelled) return;
        poll = window.setInterval(() => {
          void pushNativeFix();
        }, intervalMs);
        // If native probes go quiet, keep proving liveness from last good coords.
        heartbeat = window.setInterval(() => {
          const prev = lastLocalFix.current;
          if (!prev) return;
          if (Date.now() - lastSent.current < 18_000) return;
          const coords = {
            latitude: prev.lat,
            longitude: prev.lng,
            accuracy: 80,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: 0,
          } as GeolocationCoordinates;
          void pushFix(coords, prev.at);
        }, 20_000);
        onVis = () => {
          if (document.visibilityState !== "visible") return;
          void pushNativeFix();
        };
        document.addEventListener("visibilitychange", onVis);
        return;
      }

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
        maximumAge: 1_000,
        timeout: 12_000,
      };

      const handleErr = (err: { code?: number; message?: string }) => {
        if (isDenied(err)) {
          setError(
            "Location permission is off. Use Enable location below — or allow it in your phone Settings → MotiveLife → Location."
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
          geo.watchPosition(
            (pos) => void pushFix(pos.coords, pos.timestamp),
            handleErr,
            opts
          )
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
          (pos) => void pushFix(pos.coords, pos.timestamp),
          () => undefined,
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
        );
      }, intervalMs);

      heartbeat = window.setInterval(() => {
        const prev = lastLocalFix.current;
        if (!prev) return;
        if (Date.now() - lastSent.current < 18_000) return;
        const coords = {
          latitude: prev.lat,
          longitude: prev.lng,
          accuracy: 80,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: 0,
        } as GeolocationCoordinates;
        void pushFix(coords, prev.at);
      }, 20_000);

      onVis = () => {
        if (document.visibilityState !== "visible") return;
        void geo?.getCurrentPosition(
          (pos) => void pushFix(pos.coords, pos.timestamp),
          () => undefined,
          { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 }
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
      if (heartbeat) window.clearInterval(heartbeat);
      if (wakeLock.current) {
        void wakeLock.current.release();
        wakeLock.current = null;
      }
    };
  }, [enabled, intervalMs, pushFix]);

  return { sharing, error, lastFixAt, clearError };
}
