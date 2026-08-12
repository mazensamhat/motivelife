import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

export type FusedLocationFix = {
  lat: number;
  lng: number;
  accuracyM?: number | null;
  speedMps?: number | null;
  headingDeg?: number | null;
  recordedAtMs: number;
  provider?: string;
};

export type FusedStartOptions = {
  intervalMs?: number;
  fastestIntervalMs?: number;
  /** high | balanced | low */
  priority?: "high" | "balanced" | "low";
  notificationTitle?: string;
  notificationBody?: string;
};

type FusedLocationNative = {
  isAvailable: () => boolean;
  isRunning: () => boolean;
  start: (options?: FusedStartOptions) => Promise<boolean>;
  update: (options?: FusedStartOptions) => Promise<boolean>;
  stop: () => Promise<boolean>;
  getCurrentPosition: () => Promise<FusedLocationFix | null>;
  addListener: (
    eventName: string,
    listener: (event: Record<string, unknown>) => void
  ) => { remove: () => void };
};

let native: FusedLocationNative | null = null;

function loadNative(): FusedLocationNative | null {
  if (Platform.OS !== "android") return null;
  if (native) return native;
  try {
    native = requireNativeModule<FusedLocationNative>("FusedLocation");
  } catch {
    native = null;
  }
  return native;
}

export function isFusedLocationAvailable(): boolean {
  const mod = loadNative();
  if (!mod) return false;
  try {
    return Boolean(mod.isAvailable());
  } catch {
    return false;
  }
}

export function isFusedLocationRunning(): boolean {
  const mod = loadNative();
  if (!mod) return false;
  try {
    return Boolean(mod.isRunning());
  } catch {
    return false;
  }
}

export async function startFusedLocation(
  options?: FusedStartOptions
): Promise<boolean> {
  const mod = loadNative();
  if (!mod) return false;
  return Boolean(await mod.start(options));
}

export async function updateFusedLocation(
  options?: FusedStartOptions
): Promise<boolean> {
  const mod = loadNative();
  if (!mod) return false;
  return Boolean(await mod.update(options));
}

export async function stopFusedLocation(): Promise<boolean> {
  const mod = loadNative();
  if (!mod) return false;
  return Boolean(await mod.stop());
}

export async function getFusedCurrentPosition(): Promise<FusedLocationFix | null> {
  const mod = loadNative();
  if (!mod) return null;
  try {
    return await mod.getCurrentPosition();
  } catch {
    return null;
  }
}

export function addFusedLocationListener(
  listener: (fix: FusedLocationFix) => void
): { remove: () => void } {
  const mod = loadNative();
  if (!mod?.addListener) {
    return { remove: () => undefined };
  }
  const sub = mod.addListener("onLocation", (event) => {
    listener(event as unknown as FusedLocationFix);
  });
  return {
    remove: () => {
      try {
        sub.remove();
      } catch {
        // ignore
      }
    },
  };
}

export function addFusedLocationErrorListener(
  listener: (message: string) => void
): { remove: () => void } {
  const mod = loadNative();
  if (!mod?.addListener) {
    return { remove: () => undefined };
  }
  const sub = mod.addListener("onError", (event) => {
    listener(String((event as { message?: string })?.message ?? "fused location error"));
  });
  return {
    remove: () => {
      try {
        sub.remove();
      } catch {
        // ignore
      }
    },
  };
}

export default {
  isFusedLocationAvailable,
  isFusedLocationRunning,
  startFusedLocation,
  updateFusedLocation,
  stopFusedLocation,
  getFusedCurrentPosition,
  addFusedLocationListener,
  addFusedLocationErrorListener,
};
