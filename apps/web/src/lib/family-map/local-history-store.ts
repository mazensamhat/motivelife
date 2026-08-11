/**
 * IndexedDB store for MyMotiveFamily location history on this device.
 * Primary storage is local — user can delete anytime. Cloud is not required.
 *
 * Storage strategy (device-friendly):
 * - Trip paths stored as compact packed arrays (same map quality, far fewer bytes)
 * - Raw GPS "fixes" are no longer retained (trip paths already hold the trail)
 * - Automatic prune by age + soft byte budget so the DB cannot grow forever
 */

import {
  compactPath,
  expandPath,
  MAX_TRIP_PATH_POINTS,
  thinPathInPlace,
  type CompactTripPath,
} from "./path-compact";
import type { LocalHistoryFix, LocalHistoryPathPoint, LocalHistoryTrip } from "./local-history-types";

const DB_NAME = "mymotivelife-family-history";
const DB_VERSION = 1;
const FIXES = "fixes";
const TRIPS = "trips";
const META = "meta";

/** Default keep window for finished on-device trips. */
export const LOCAL_TRIP_KEEP_DAYS = 90;
/** Under storage pressure, keep a tighter window. */
export const LOCAL_TRIP_KEEP_DAYS_PRESSURE = 30;

type StoredTrip = Omit<LocalHistoryTrip, "path"> & {
  /** Legacy fat path — migrated on read. */
  path?: LocalHistoryPathPoint[];
  /** Compact packed path (preferred). */
  pathC?: CompactTripPath;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FIXES)) {
        const store = db.createObjectStore(FIXES, { keyPath: "id" });
        store.createIndex("byMemberTime", ["memberId", "recordedAt"], { unique: false });
        store.createIndex("byTime", "recordedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(TRIPS)) {
        const store = db.createObjectStore(TRIPS, { keyPath: "id" });
        store.createIndex("byMemberTime", ["memberId", "startedAt"], { unique: false });
        store.createIndex("byStarted", "startedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB tx failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB tx aborted"));
  });
}

function hydrateTrip(row: StoredTrip): LocalHistoryTrip {
  const path =
    row.pathC && row.pathC.v?.length
      ? expandPath(row.pathC)
      : Array.isArray(row.path)
        ? row.path
        : [];
  const { pathC: _drop, ...rest } = row;
  return { ...rest, path };
}

function serializeTrip(
  trip: LocalHistoryTrip,
  mode: "final" | "draft" = "final"
): StoredTrip {
  let path = trip.path.map((p) => ({ ...p }));
  if (mode === "final" || path.length > MAX_TRIP_PATH_POINTS) {
    path = thinPathInPlace(path);
  }
  const { path: _path, ...rest } = trip;
  return {
    ...rest,
    path: [],
    pathC: compactPath(path),
  };
}

/**
 * @deprecated Raw fixes are unused by the UI (trip paths hold trails).
 * Kept as a no-op so callers don’t break; maintenance clears the store.
 */
export async function putLocalFix(_fix: LocalHistoryFix): Promise<void> {
  // Intentionally empty — avoids writing megabytes of unused GPS samples.
}

export async function putLocalTrip(trip: LocalHistoryTrip): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(TRIPS, "readwrite");
  tx.objectStore(TRIPS).put(serializeTrip(trip));
  await txDone(tx);
  db.close();
}

export async function listLocalTrips(memberId: string): Promise<LocalHistoryTrip[]> {
  const db = await openDb();
  const tx = db.transaction(TRIPS, "readonly");
  const store = tx.objectStore(TRIPS);
  const index = store.index("byMemberTime");
  const req = index.getAll(IDBKeyRange.bound([memberId, ""], [memberId, "\uffff"]));
  const rows = await new Promise<StoredTrip[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as StoredTrip[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows.map(hydrateTrip);
}

export async function getLocalTrip(id: string): Promise<LocalHistoryTrip | null> {
  const db = await openDb();
  const tx = db.transaction(TRIPS, "readonly");
  const req = tx.objectStore(TRIPS).get(id);
  const row = await new Promise<StoredTrip | null>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as StoredTrip) ?? null);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return row ? hydrateTrip(row) : null;
}

export async function deleteLocalTrip(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(TRIPS, "readwrite");
  tx.objectStore(TRIPS).delete(id);
  await txDone(tx);
  db.close();
}

export async function clearLocalHistory(memberId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([TRIPS, FIXES], "readwrite");

  const tripStore = tx.objectStore(TRIPS);
  const tripIdx = tripStore.index("byMemberTime");
  const tripReq = tripIdx.openCursor(IDBKeyRange.bound([memberId, ""], [memberId, "\uffff"]));
  await new Promise<void>((resolve, reject) => {
    tripReq.onsuccess = () => {
      const cursor = tripReq.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    };
    tripReq.onerror = () => reject(tripReq.error);
  });

  const fixStore = tx.objectStore(FIXES);
  const fixIdx = fixStore.index("byMemberTime");
  const fixReq = fixIdx.openCursor(IDBKeyRange.bound([memberId, ""], [memberId, "\uffff"]));
  await new Promise<void>((resolve, reject) => {
    fixReq.onsuccess = () => {
      const cursor = fixReq.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    };
    fixReq.onerror = () => reject(fixReq.error);
  });

  await txDone(tx);
  db.close();
}

/** Clear legacy raw-fix store entirely (never read by UI). */
export async function clearAllLocalFixes(): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(FIXES, "readwrite");
  const store = tx.objectStore(FIXES);
  const countReq = store.count();
  const count = await new Promise<number>((resolve, reject) => {
    countReq.onsuccess = () => resolve(countReq.result ?? 0);
    countReq.onerror = () => reject(countReq.error);
  });
  store.clear();
  await txDone(tx);
  db.close();
  return count;
}

/** @deprecated Prefer clearAllLocalFixes — kept for call-site compatibility. */
export async function pruneOldFixes(memberId: string, keepDays = 14): Promise<void> {
  const cutoff = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000).toISOString();
  const db = await openDb();
  const tx = db.transaction(FIXES, "readwrite");
  const idx = tx.objectStore(FIXES).index("byMemberTime");
  const req = idx.openCursor(IDBKeyRange.bound([memberId, ""], [memberId, cutoff]));
  await new Promise<void>((resolve, reject) => {
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
}

/** Drop finished on-device trips older than keepDays (default 90). */
export async function pruneOldLocalTrips(
  memberId: string,
  keepDays = LOCAL_TRIP_KEEP_DAYS
): Promise<number> {
  const cutoff = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000).toISOString();
  const db = await openDb();
  const tx = db.transaction(TRIPS, "readwrite");
  const idx = tx.objectStore(TRIPS).index("byMemberTime");
  let deleted = 0;
  const req = idx.openCursor(IDBKeyRange.bound([memberId, ""], [memberId, cutoff]));
  await new Promise<void>((resolve, reject) => {
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      deleted += 1;
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return deleted;
}

/** Age-prune across all members (maintenance when memberId unknown). */
export async function pruneAllOldLocalTrips(
  keepDays = LOCAL_TRIP_KEEP_DAYS
): Promise<number> {
  const cutoff = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000).toISOString();
  const db = await openDb();
  const tx = db.transaction(TRIPS, "readwrite");
  const idx = tx.objectStore(TRIPS).index("byStarted");
  let deleted = 0;
  const req = idx.openCursor(IDBKeyRange.upperBound(cutoff));
  await new Promise<void>((resolve, reject) => {
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      deleted += 1;
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return deleted;
}

/** Approximate serialized size of all trips + fixes (UTF-16 JSON estimate). */
export async function estimateLocalHistoryBytes(): Promise<number> {
  const db = await openDb();
  const tx = db.transaction([TRIPS, FIXES], "readonly");
  const tripsReq = tx.objectStore(TRIPS).getAll();
  const fixesReq = tx.objectStore(FIXES).getAll();
  const [trips, fixes] = await Promise.all([
    new Promise<unknown[]>((resolve, reject) => {
      tripsReq.onsuccess = () => resolve((tripsReq.result as unknown[]) ?? []);
      tripsReq.onerror = () => reject(tripsReq.error);
    }),
    new Promise<unknown[]>((resolve, reject) => {
      fixesReq.onsuccess = () => resolve((fixesReq.result as unknown[]) ?? []);
      fixesReq.onerror = () => reject(fixesReq.error);
    }),
  ]);
  await txDone(tx);
  db.close();
  let bytes = 0;
  try {
    bytes += JSON.stringify(trips).length * 2;
    bytes += JSON.stringify(fixes).length * 2;
  } catch {
    bytes = trips.length * 8_000 + fixes.length * 120;
  }
  return bytes;
}

/**
 * Rewrite legacy fat `path` trips to compact `pathC` (idempotent).
 * Returns number of trips rewritten.
 */
export async function migrateTripsToCompactPaths(): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(TRIPS, "readwrite");
  const store = tx.objectStore(TRIPS);
  const req = store.openCursor();
  let rewritten = 0;
  await new Promise<void>((resolve, reject) => {
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve();
        return;
      }
      const row = cursor.value as StoredTrip;
      const needsMigrate =
        Array.isArray(row.path) &&
        row.path.length > 0 &&
        !(row.pathC && row.pathC.v && row.pathC.v.length > 0);
      if (needsMigrate) {
        const hydrated = hydrateTrip(row);
        cursor.update(serializeTrip(hydrated));
        rewritten += 1;
      } else if (Array.isArray(row.path) && row.path.length > 0 && row.pathC) {
        // Already compact — drop leftover fat path array.
        cursor.update({ ...row, path: [] });
        rewritten += 1;
      }
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rewritten;
}

/**
 * Under budget pressure: delete oldest trips globally until under softBudgetBytes.
 */
export async function pruneTripsToBudget(
  softBudgetBytes: number,
  depth = 0
): Promise<number> {
  if (depth > 12) return 0;
  let bytes = await estimateLocalHistoryBytes();
  if (bytes <= softBudgetBytes) return 0;

  const db = await openDb();
  const tx = db.transaction(TRIPS, "readwrite");
  const idx = tx.objectStore(TRIPS).index("byStarted");
  const req = idx.openCursor(); // oldest first
  let deleted = 0;
  await new Promise<void>((resolve, reject) => {
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve();
        return;
      }
      // Batch, then re-estimate.
      if (deleted >= 40) {
        resolve();
        return;
      }
      cursor.delete();
      deleted += 1;
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();

  bytes = await estimateLocalHistoryBytes();
  if (bytes > softBudgetBytes && deleted > 0) {
    deleted += await pruneTripsToBudget(softBudgetBytes, depth + 1);
  }
  return deleted;
}

export type LocalHistoryMaintainResult = {
  fixesCleared: number;
  tripsPruned: number;
  tripsRewritten: number;
  budgetPruned: number;
  bytesBefore: number;
  bytesAfter: number;
};

export async function maintainLocalHistoryStorage(opts: {
  memberId?: string | null;
  softBudgetBytes: number;
  aggressive?: boolean;
}): Promise<LocalHistoryMaintainResult> {
  const bytesBefore = await estimateLocalHistoryBytes().catch(() => 0);
  const keepDays = opts.aggressive ? LOCAL_TRIP_KEEP_DAYS_PRESSURE : LOCAL_TRIP_KEEP_DAYS;

  const fixesCleared = await clearAllLocalFixes().catch(() => 0);
  const tripsPruned = opts.memberId
    ? await pruneOldLocalTrips(opts.memberId, keepDays).catch(() => 0)
    : await pruneAllOldLocalTrips(keepDays).catch(() => 0);
  const tripsRewritten = await migrateTripsToCompactPaths().catch(() => 0);
  let budgetPruned = 0;
  const mid = await estimateLocalHistoryBytes().catch(() => bytesBefore);
  if (mid > opts.softBudgetBytes || opts.aggressive) {
    budgetPruned = await pruneTripsToBudget(
      opts.aggressive ? Math.floor(opts.softBudgetBytes * 0.6) : opts.softBudgetBytes
    ).catch(() => 0);
  }
  const bytesAfter = await estimateLocalHistoryBytes().catch(() => mid);

  return {
    fixesCleared,
    tripsPruned,
    tripsRewritten,
    budgetPruned,
    bytesBefore,
    bytesAfter,
  };
}

export async function getActiveTripDraft(memberId: string): Promise<LocalHistoryTrip | null> {
  const db = await openDb();
  const tx = db.transaction(META, "readonly");
  const req = tx.objectStore(META).get(`activeTrip:${memberId}`);
  const row = await new Promise<{ key: string; value: StoredTrip | LocalHistoryTrip } | undefined>(
    (resolve, reject) => {
      req.onsuccess = () =>
        resolve(req.result as { key: string; value: StoredTrip | LocalHistoryTrip } | undefined);
      req.onerror = () => reject(req.error);
    }
  );
  await txDone(tx);
  db.close();
  if (!row?.value) return null;
  return hydrateTrip(row.value as StoredTrip);
}

export async function setActiveTripDraft(
  memberId: string,
  trip: LocalHistoryTrip | null
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(META, "readwrite");
  const store = tx.objectStore(META);
  const key = `activeTrip:${memberId}`;
  if (trip) {
    // Drafts stay high-fidelity until complete; still pack as pathC to save bytes.
    store.put({
      key,
      value: serializeTrip(trip, "draft"),
    });
  } else {
    store.delete(key);
  }
  await txDone(tx);
  db.close();
}
