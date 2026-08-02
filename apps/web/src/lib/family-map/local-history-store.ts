/**
 * IndexedDB store for MyMotiveFamily location history on this device.
 * Primary storage is local — user can delete anytime. Cloud is not required.
 */

import type { LocalHistoryFix, LocalHistoryTrip } from "./local-history-types";

const DB_NAME = "mymotivelife-family-history";
const DB_VERSION = 1;
const FIXES = "fixes";
const TRIPS = "trips";
const META = "meta";

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

export async function putLocalFix(fix: LocalHistoryFix): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(FIXES, "readwrite");
  tx.objectStore(FIXES).put(fix);
  await txDone(tx);
  db.close();
}

export async function putLocalTrip(trip: LocalHistoryTrip): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(TRIPS, "readwrite");
  tx.objectStore(TRIPS).put(trip);
  await txDone(tx);
  db.close();
}

export async function listLocalTrips(memberId: string): Promise<LocalHistoryTrip[]> {
  const db = await openDb();
  const tx = db.transaction(TRIPS, "readonly");
  const store = tx.objectStore(TRIPS);
  const index = store.index("byMemberTime");
  const req = index.getAll(IDBKeyRange.bound([memberId, ""], [memberId, "\uffff"]));
  const rows = await new Promise<LocalHistoryTrip[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as LocalHistoryTrip[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows;
}

export async function getLocalTrip(id: string): Promise<LocalHistoryTrip | null> {
  const db = await openDb();
  const tx = db.transaction(TRIPS, "readonly");
  const req = tx.objectStore(TRIPS).get(id);
  const row = await new Promise<LocalHistoryTrip | null>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as LocalHistoryTrip) ?? null);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return row;
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

/** Keep raw fixes for ~14 days so the device doesn’t grow forever. */
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

export async function getActiveTripDraft(memberId: string): Promise<LocalHistoryTrip | null> {
  const db = await openDb();
  const tx = db.transaction(META, "readonly");
  const req = tx.objectStore(META).get(`activeTrip:${memberId}`);
  const row = await new Promise<{ key: string; value: LocalHistoryTrip } | undefined>(
    (resolve, reject) => {
      req.onsuccess = () => resolve(req.result as { key: string; value: LocalHistoryTrip } | undefined);
      req.onerror = () => reject(req.error);
    }
  );
  await txDone(tx);
  db.close();
  return row?.value ?? null;
}

export async function setActiveTripDraft(
  memberId: string,
  trip: LocalHistoryTrip | null
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(META, "readwrite");
  const store = tx.objectStore(META);
  const key = `activeTrip:${memberId}`;
  if (trip) store.put({ key, value: trip });
  else store.delete(key);
  await txDone(tx);
  db.close();
}
