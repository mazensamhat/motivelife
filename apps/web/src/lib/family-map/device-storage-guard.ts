/**
 * Automatic on-device storage housekeeping so Family Map history / caches
 * cannot grow until the browser or WebView starts thrashing.
 */

import {
  estimateLocalHistoryBytes,
  maintainLocalHistoryStorage,
  type LocalHistoryMaintainResult,
} from "./local-history-store";

const GUARD_META_KEY = "motivelife-device-storage-guard-v1";
/** Soft cap for Family history IndexedDB (bytes). */
export const LOCAL_HISTORY_SOFT_BUDGET_BYTES = 18 * 1024 * 1024;
/** Run full maintenance at most this often unless pressure is high. */
const MAINTENANCE_COOLDOWN_MS = 6 * 60 * 60_000;
/** High pressure → run immediately. */
const QUOTA_PRESSURE_RATIO = 0.82;

export type DeviceStorageSnapshot = {
  usage: number | null;
  quota: number | null;
  historyBytes: number;
  pressure: "ok" | "elevated" | "critical";
};

export type DeviceStorageMaintainResult = {
  snapshot: DeviceStorageSnapshot;
  history: LocalHistoryMaintainResult | null;
  cachesCleared: number;
  skipped: boolean;
};

function readLastRunAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(GUARD_META_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { at?: number };
    return typeof parsed.at === "number" ? parsed.at : 0;
  } catch {
    return 0;
  }
}

function writeLastRunAt(at: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GUARD_META_KEY, JSON.stringify({ at }));
  } catch {
    /* quota / private mode */
  }
}

export async function getDeviceStorageSnapshot(): Promise<DeviceStorageSnapshot> {
  let usage: number | null = null;
  let quota: number | null = null;
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      usage = typeof est.usage === "number" ? est.usage : null;
      quota = typeof est.quota === "number" ? est.quota : null;
    }
  } catch {
    /* ignore */
  }

  let historyBytes = 0;
  try {
    historyBytes = await estimateLocalHistoryBytes();
  } catch {
    historyBytes = 0;
  }

  let pressure: DeviceStorageSnapshot["pressure"] = "ok";
  if (
    (quota != null && usage != null && quota > 0 && usage / quota >= QUOTA_PRESSURE_RATIO) ||
    historyBytes >= LOCAL_HISTORY_SOFT_BUDGET_BYTES
  ) {
    pressure = "critical";
  } else if (
    (quota != null && usage != null && quota > 0 && usage / quota >= 0.65) ||
    historyBytes >= LOCAL_HISTORY_SOFT_BUDGET_BYTES * 0.7
  ) {
    pressure = "elevated";
  }

  return { usage, quota, historyBytes, pressure };
}

/** Drop stale Cache Storage entries (PWA shell leftovers). */
export async function clearStaleAppCaches(keepName = "motivelife-shell-v7"): Promise<number> {
  if (typeof caches === "undefined") return 0;
  let cleared = 0;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key !== keepName)
        .map(async (key) => {
          const ok = await caches.delete(key);
          if (ok) cleared += 1;
        })
    );
  } catch {
    /* ignore */
  }
  return cleared;
}

/**
 * Compact history, prune by age/budget, and clear old Cache Storage.
 * Safe to call often — cooldown skips unless storage pressure is high.
 */
export async function runDeviceStorageMaintenance(opts?: {
  force?: boolean;
  memberId?: string | null;
}): Promise<DeviceStorageMaintainResult> {
  const snapshot = await getDeviceStorageSnapshot();
  const last = readLastRunAt();
  const due = Date.now() - last >= MAINTENANCE_COOLDOWN_MS;
  const pressure = snapshot.pressure !== "ok";

  if (!opts?.force && !due && !pressure) {
    return { snapshot, history: null, cachesCleared: 0, skipped: true };
  }

  let history: LocalHistoryMaintainResult | null = null;
  try {
    history = await maintainLocalHistoryStorage({
      memberId: opts?.memberId ?? null,
      softBudgetBytes: LOCAL_HISTORY_SOFT_BUDGET_BYTES,
      aggressive: snapshot.pressure === "critical",
    });
  } catch {
    history = null;
  }

  const cachesCleared = await clearStaleAppCaches();
  writeLastRunAt(Date.now());

  const after = await getDeviceStorageSnapshot();
  return { snapshot: after, history, cachesCleared, skipped: false };
}
