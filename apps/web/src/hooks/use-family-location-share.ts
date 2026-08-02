"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FamilyMapState } from "@forward/shared";

type Options = {
  enabled: boolean;
  onState?: (state: FamilyMapState) => void;
  intervalMs?: number;
};

export function useFamilyLocationShare({ enabled, onState, intervalMs = 12_000 }: Options) {
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [lastFixAt, setLastFixAt] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const lastSent = useRef(0);
  const onStateRef = useRef(onState);
  onStateRef.current = onState;

  const pushFix = useCallback(async (coords: GeolocationCoordinates) => {
    const now = Date.now();
    if (now - lastSent.current < 4000) return;
    lastSent.current = now;

    const speedKmh =
      coords.speed != null && coords.speed >= 0 ? coords.speed * 3.6 : null;

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
    } catch {
      setError("Network error while sharing location.");
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (watchId.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      setSharing(false);
      return;
    }

    if (!navigator.geolocation) {
      setError("Geolocation is not available in this browser.");
      return;
    }

    setSharing(true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        void pushFix(pos.coords);
      },
      (err) => {
        setError(err.message || "Location permission denied.");
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20_000 }
    );

    const poll = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => void pushFix(pos.coords),
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
      );
    }, intervalMs);

    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      window.clearInterval(poll);
    };
  }, [enabled, intervalMs, pushFix]);

  return { sharing, error, lastFixAt };
}
