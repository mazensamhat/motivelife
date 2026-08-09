/**
 * MyMotiveFamily background / Always location updates.
 * Task must be defined at module scope (imported from index.ts).
 *
 * Sampling cadence is owned by locationCore (motion-aware adaptive profiles).
 */
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { Alert, AppState, Dimensions, Linking, Platform } from "react-native";
import {
  checkAndroidForegroundLocation,
  requestAndroidBackgroundLocation,
  requestAndroidForegroundLocation,
} from "./androidLocationPermissions";
import { WEB_URL } from "./config";
import type { SamplingProfile } from "./locationCore";

export const FAMILY_LOCATION_TASK = "motivelife-family-location";
const SESSION_KEY = "motivelife.sessionToken";
const SHARE_KEY = "motivelife.familyShareEnabled";
/** ISO timestamp of last successful /api/family/location POST from native. */
const LAST_OK_POST_KEY = "motivelife.familyLastOkPostAt";
/** Bump when iOS update options change so a soft resume upgrades a stale task. */
const IOS_BG_OPTIONS_VERSION = "12";
const IOS_BG_OPTIONS_VERSION_KEY = "motivelife.familyBgOptsVer";
/** If we haven’t successfully posted in this long, force-restart the BG task. */
const STALE_POST_FORCE_RESTART_MS = 12 * 60_000;
/** Last good lat/lng JSON — used for heartbeat when GPS goes quiet indoors. */
const LAST_KNOWN_KEY = "motivelife.familyLastKnownFix";
export const FAMILY_HEARTBEAT_TASK = "motivelife-family-heartbeat";
/**
 * Stationary wake fence — iOS continuous GPS goes quiet with no movement.
 * A tight geofence still fires on GPS jitter / short walks so we can heartbeat.
 */
export const FAMILY_STATIONARY_GEOFENCE_TASK = "motivelife-family-stationary-geofence";
const STATIONARY_FENCE_RADIUS_M = 55;
const STATIONARY_FENCE_RECENTER_M = 25;
const STATIONARY_FENCE_KEY = "motivelife.familyStationaryFence";

/**
 * BG tasks run while the phone is locked. Default SecureStore (WHEN_UNLOCKED)
 * cannot read the session/share flag then — posts silently no-op and the
 * household sees "Updated 33m ago" until the app is opened again.
 */
const BG_STORE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const BG_STORE_KEYS = [
  SESSION_KEY,
  SHARE_KEY,
  LAST_OK_POST_KEY,
  LAST_KNOWN_KEY,
  STATIONARY_FENCE_KEY,
  IOS_BG_OPTIONS_VERSION_KEY,
  "motivelife.androidFamilyBgOptsVer",
] as const;

async function getBgStore(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (e) {
    console.warn(
      "[backgroundLocation] SecureStore get failed",
      key,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

async function setBgStore(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, BG_STORE_OPTS);
}

async function deleteBgStore(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}

/** Rewrite legacy WHEN_UNLOCKED items so locked-phone BG tasks can read them. */
let bgStoreMigrated = false;
async function migrateBgStoreAccessibility(): Promise<void> {
  if (bgStoreMigrated) return;
  bgStoreMigrated = true;
  for (const key of BG_STORE_KEYS) {
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value == null) continue;
      await SecureStore.deleteItemAsync(key);
      await SecureStore.setItemAsync(key, value, BG_STORE_OPTS);
    } catch (e) {
      console.warn(
        "[backgroundLocation] SecureStore migrate failed",
        key,
        e instanceof Error ? e.message : e
      );
    }
  }
}

/** Coalesce deferred FGS starts so permission UI + enable tap don't race on Fold. */
let androidFgsTimer: ReturnType<typeof setTimeout> | null = null;
let androidFgsInFlight = false;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Galaxy Z Fold / Flip detection.
 * Prefer model/brand (SM-F*) over aspect ratio so unfolded inner display still matches.
 */
export function isLikelyAndroidFoldable(): boolean {
  if (Platform.OS !== "android") return false;
  try {
    const c = Platform.constants as {
      Brand?: string;
      Manufacturer?: string;
      Model?: string;
      Fingerprint?: string;
    };
    const hay =
      `${c.Brand ?? ""} ${c.Manufacturer ?? ""} ${c.Model ?? ""} ${c.Fingerprint ?? ""}`.toLowerCase();
    // Galaxy Z Fold / Flip model codes are SM-F…
    if (/sm-f\d|z[\s_-]*fold|z[\s_-]*flip|galaxy[\s_-]*fold|galaxy[\s_-]*flip/.test(hay)) {
      return true;
    }
    if (hay.includes("fold") || hay.includes("flip")) return true;
  } catch {
    // fall through to geometry
  }
  const win = Dimensions.get("window");
  const screen = Dimensions.get("screen");
  const min = Math.min(win.width, win.height, screen.width, screen.height);
  const max = Math.max(win.width, win.height, screen.width, screen.height);
  const aspect = max / Math.max(min, 1);
  return aspect >= 2.05 || min >= 580;
}

/**
 * Location FGS hard-crashes Z Fold — keep Fold on foreground poll only.
 * Regular Android phones (wife's) need real background updates or the pin stalls.
 */
export function shouldAvoidAndroidLocationFgs(): boolean {
  return Platform.OS === "android" && isLikelyAndroidFoldable();
}

function androidDeviceLabel(): string {
  try {
    const c = Platform.constants as { Brand?: string; Model?: string };
    return `${c.Brand ?? "android"} ${c.Model ?? ""}`.trim();
  } catch {
    return "android";
  }
}

/** Wait until the app is active again after permission / GPS settings UIs. */
async function waitForAppActive(timeoutMs = 8_000): Promise<void> {
  if (AppState.currentState === "active") return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      sub.remove();
      resolve();
    }, timeoutMs);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        clearTimeout(timer);
        sub.remove();
        resolve();
      }
    });
  });
}

/**
 * Z Fold / Android 12+: starting a location foreground service while the
 * activity is still settling after a permission or settings UI can hard-crash
 * the process. Always wait for active + a short settle, even if already active.
 */
export async function settleAfterAndroidUi(extraMs = 650): Promise<void> {
  if (Platform.OS !== "android") return;
  await waitForAppActive();
  await sleep(extraMs);
}

/** Wait until AppState has stayed active continuously for `stableMs`. */
async function waitForStableActive(stableMs = 2_000, timeoutMs = 12_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await waitForAppActive(Math.max(500, deadline - Date.now()));
    if (AppState.currentState !== "active") continue;
    const startedAt = Date.now();
    let interrupted = false;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        sub.remove();
        resolve();
      }, stableMs);
      const sub = AppState.addEventListener("change", (state) => {
        if (state !== "active") {
          interrupted = true;
          clearTimeout(timer);
          sub.remove();
          resolve();
        }
      });
    });
    if (!interrupted && Date.now() - startedAt >= stableMs - 50) return true;
  }
  return AppState.currentState === "active";
}

const ANDROID_BG_OPTIONS_VERSION = "7";
const ANDROID_BG_OPTIONS_VERSION_KEY = "motivelife.androidFamilyBgOptsVer";

/** Active adaptive profile id — avoids restart thrash. */
let activeProfileId: string | null = null;
let profileListenerReady = false;
/** Profile change while suspended — apply on next foreground re-arm. */
let pendingProfile: SamplingProfile | null = null;

function locationTaskOptionsFromProfile(profile: SamplingProfile): Location.LocationTaskOptions {
  if (Platform.OS === "ios") {
    // expo-location on iOS maps distanceInterval → CLLocationManager.distanceFilter
    // and IGNORES timeInterval. Moving: real distance filters (storm-safe).
    // Stationary/unknown: distanceInterval 0 so indoor GPS jitter still delivers
    // BG callbacks when the app is killed — geofence/heartbeat alone were too
    // sparse. Post storm is prevented by minPostGapMs + one-POST-per-batch.
    const moving = profile.id === "driving" || profile.id === "walking";
    const distanceInterval = moving
      ? profile.id === "driving"
        ? Math.max(8, profile.distanceInterval || 8)
        : Math.max(5, profile.distanceInterval || 5)
      : 0;
    return {
      accuracy: moving
        ? Location.Accuracy.BestForNavigation
        : Location.Accuracy.Balanced,
      distanceInterval,
      deferredUpdatesDistance: 0,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      // Fitness for walk/stationary so Core Motion notices steps and re-powers GPS.
      activityType:
        profile.id === "driving"
          ? Location.ActivityType.AutomotiveNavigation
          : Location.ActivityType.Fitness,
      foregroundService: {
        notificationTitle: "MyMotiveFamily",
        notificationBody: "Sharing live location with your household",
        notificationColor: "#00c6ff",
      },
    };
  }

  // Android honors timeInterval — keep posting while sitting still (FGS phones).
  // distanceInterval: 0 so a 25m filter can't silence home heartbeats.
  // Walking floor was 8s and left the pin lagging behind iOS; keep denser.
  const moving = profile.id === "walking" || profile.id === "driving";
  // Driving ~2s; walking ~4s so neighborhood walks and arrive-at-work update faster.
  const minMovingMs = profile.id === "driving" ? 2_000 : 4_000;
  const base: Location.LocationTaskOptions = {
    accuracy: moving
      ? Location.Accuracy.BestForNavigation
      : Location.Accuracy.Balanced,
    timeInterval: moving
      ? Math.max(minMovingMs, profile.timeInterval)
      : Math.max(15_000, profile.timeInterval),
    distanceInterval: 0,
    deferredUpdatesInterval: moving
      ? Math.max(minMovingMs, profile.deferredUpdatesInterval)
      : Math.max(15_000, profile.deferredUpdatesInterval),
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    activityType:
      profile.id === "driving"
        ? Location.ActivityType.AutomotiveNavigation
        : Location.ActivityType.Fitness,
  };
  if (!shouldAvoidAndroidLocationFgs()) {
    return {
      ...base,
      foregroundService: {
        notificationTitle: "MyMotiveFamily",
        notificationBody: "Sharing live location with your household",
        notificationColor: "#00c6ff",
      },
    };
  }
  return base;
}

async function loadCurrentProfile(): Promise<SamplingProfile> {
  const { getCurrentSamplingProfile, defaultSamplingProfile } = await import("./locationCore");
  try {
    return getCurrentSamplingProfile();
  } catch {
    return defaultSamplingProfile();
  }
}

/**
 * Re-arm the OS location task when motion mode changes (e.g. parked → driving).
 * Skips Fold FGS path — that device stays on foreground poll only.
 */
export async function applySamplingProfile(profile: SamplingProfile): Promise<void> {
  if (activeProfileId === profile.id && !pendingProfile) return;

  const share = await getBgStore(SHARE_KEY);
  if (share !== "1") return;

  // iOS: stop/start CLLocationManager while suspended can stall deliveries —
  // queue and apply on resume. Android FGS: re-arm now so driving→dense
  // sampling isn't stuck on a sparse profile until the user opens the app.
  // Fold (no FGS): still defer — foreground poll is the only path there.
  if (AppState.currentState !== "active") {
    if (
      Platform.OS === "ios" ||
      (Platform.OS === "android" && shouldAvoidAndroidLocationFgs())
    ) {
      pendingProfile = profile;
      return;
    }
  }

  activeProfileId = profile.id;
  pendingProfile = null;

  if (Platform.OS === "android" && shouldAvoidAndroidLocationFgs()) {
    // Fold poll interval: denser while driving, sparse when still.
    stopAndroidForegroundPoll();
    startAndroidForegroundPoll(profile.timeInterval);
    return;
  }

  const options = locationTaskOptionsFromProfile(profile);
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(FAMILY_LOCATION_TASK);
    if (started) {
      try {
        await Location.stopLocationUpdatesAsync(FAMILY_LOCATION_TASK);
      } catch {
        // ignore
      }
    }
    await Location.startLocationUpdatesAsync(FAMILY_LOCATION_TASK, options);
    if (Platform.OS === "ios") {
      await setBgStore(IOS_BG_OPTIONS_VERSION_KEY, IOS_BG_OPTIONS_VERSION);
    } else {
      await setBgStore(ANDROID_BG_OPTIONS_VERSION_KEY, ANDROID_BG_OPTIONS_VERSION);
    }
  } catch (e) {
    console.warn(
      "[backgroundLocation] applySamplingProfile failed",
      e instanceof Error ? e.message : e
    );
  }
}

async function ensureProfileListener(): Promise<void> {
  if (profileListenerReady) return;
  profileListenerReady = true;
  const { onSamplingProfileChange } = await import("./locationCore");
  onSamplingProfileChange((profile) => {
    void applySamplingProfile(profile);
  });
}

async function startAndroidLocationUpdatesOnce(): Promise<void> {
  const profile = await loadCurrentProfile();
  const options = locationTaskOptionsFromProfile(profile);

  const started = await Location.hasStartedLocationUpdatesAsync(FAMILY_LOCATION_TASK);
  const storedVer = await getBgStore(ANDROID_BG_OPTIONS_VERSION_KEY);
  if (started && storedVer === ANDROID_BG_OPTIONS_VERSION && activeProfileId === profile.id) {
    return;
  }
  if (started) {
    try {
      await Location.stopLocationUpdatesAsync(FAMILY_LOCATION_TASK);
    } catch {
      // ignore
    }
  }
  await Location.startLocationUpdatesAsync(FAMILY_LOCATION_TASK, options);
  await setBgStore(ANDROID_BG_OPTIONS_VERSION_KEY, ANDROID_BG_OPTIONS_VERSION);
  activeProfileId = profile.id;
  await ensureProfileListener();
}

/** Hard client throttle — iOS BestForNavigation can emit many fixes per second. */
let lastPostAttemptAt = 0;
let postInFlight = false;
let authBackoffUntil = 0;
let errorBackoffUntil = 0;
let consecutiveErrors = 0;

function minPostGapMs(speedKmh: number | null, motion: string | null): number {
  // Align with server MIN_INGEST_GAP_MS (~1.8s) so Android isn't double-throttled.
  if (motion === "driving" || (speedKmh != null && speedKmh >= 14)) return 1_800;
  if (motion === "walking" || (speedKmh != null && speedKmh >= 3.5)) return 4_000;
  return 12_000;
}

/** Prefer the freshest accurate fix in a batch (Android often delivers several). */
function pickBestLocationSample(
  locations: Location.LocationObject[]
): Location.LocationObject {
  if (locations.length === 1) return locations[0]!;
  const now = Date.now();
  let best = locations[locations.length - 1]!;
  let bestScore = -Infinity;
  for (const loc of locations) {
    const ageSec = Math.max(0, (now - (loc.timestamp || now)) / 1000);
    const acc = loc.coords.accuracy ?? 80;
    const score = -acc - ageSec * 2;
    if (score > bestScore) {
      bestScore = score;
      best = loc;
    }
  }
  return best;
}

async function postFamilyLocationFix(pos: Location.LocationObject): Promise<boolean> {
  const now = Date.now();
  if (now < authBackoffUntil || now < errorBackoffUntil) return false;
  if (postInFlight) return false;

  const token = await getBgStore(SESSION_KEY);
  if (!token) return false;
  const sampleAgeMs = Math.max(0, Date.now() - (pos.timestamp || Date.now()));
  // Stale last-known must not look like a live drive — zero Doppler so the
  // server won't flip Stationary↔Driving while rubber-banding the pin.
  let speedKmh = speedKmhFromLocation(pos);
  if (sampleAgeMs > 25_000) {
    speedKmh = 0;
  }
  let motionActivity: "stationary" | "walking" | "driving" | "unknown" | null = null;
  try {
    const { getLocationCoreState } = await import("./locationCore");
    const motion = getLocationCoreState().motion;
    if (
      motion === "stationary" ||
      motion === "walking" ||
      motion === "driving" ||
      motion === "unknown"
    ) {
      motionActivity = motion;
    }
  } catch {
    // core not loaded yet
  }

  const gap = minPostGapMs(speedKmh, motionActivity);
  if (lastPostAttemptAt > 0 && now - lastPostAttemptAt < gap) return false;
  lastPostAttemptAt = now;
  postInFlight = true;

  try {
    const res = await fetch(`${WEB_URL}/api/family/location`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-MotiveLife-Session": token,
      },
      body: JSON.stringify({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyM: pos.coords.accuracy,
        speedKmh,
        headingDeg:
          pos.coords.heading != null && pos.coords.heading >= 0 ? pos.coords.heading : null,
        recordedAt: new Date(pos.timestamp).toISOString(),
        motionActivity,
        // App on screen while this fix is posted → phone-in-use while driving.
        phoneInUse: AppState.currentState === "active",
      }),
    });
    if (res.status === 401 || res.status === 403) {
      // Bad/expired JWT — do not hammer the API (alert: 1.7k× 401 from one phone).
      authBackoffUntil = Date.now() + 5 * 60_000;
      consecutiveErrors = 0;
      console.warn("[backgroundLocation] post auth failed — backing off 5m", res.status);
      return false;
    }
    if (!res.ok) {
      consecutiveErrors += 1;
      const backoff = Math.min(60_000, 2_000 * 2 ** Math.min(5, consecutiveErrors - 1));
      errorBackoffUntil = Date.now() + backoff;
      console.warn("[backgroundLocation] post HTTP", res.status, "backoff", backoff);
      return false;
    }
    consecutiveErrors = 0;
    errorBackoffUntil = 0;
    await setBgStore(LAST_OK_POST_KEY, new Date().toISOString());
    await setBgStore(
      LAST_KNOWN_KEY,
      JSON.stringify({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyM: pos.coords.accuracy ?? null,
        at: Date.now(),
        // Keep the real GPS clock — inventing Date.now() on replay made stale
        // coords look fresh and skipped the server's out-of-order gate.
        gpsAt: pos.timestamp || Date.now(),
      })
    );
    void ensureStationaryGeofence(pos.coords.latitude, pos.coords.longitude);
    try {
      const { noteLocationSample } = await import("./locationCore");
      noteLocationSample({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        speedKmh,
        atMs: pos.timestamp,
      });
      await ensureProfileListener();
    } catch {
      // Core is optional for posting reliability
    }
    return true;
  } catch (e) {
    consecutiveErrors += 1;
    const backoff = Math.min(60_000, 2_000 * 2 ** Math.min(5, consecutiveErrors - 1));
    errorBackoffUntil = Date.now() + backoff;
    console.warn("[backgroundLocation] post failed", e);
    return false;
  } finally {
    postInFlight = false;
  }
}

async function lastOkPostAgeMs(): Promise<number | null> {
  try {
    const raw = await getBgStore(LAST_OK_POST_KEY);
    if (!raw) return null;
    const t = Date.parse(raw);
    if (!Number.isFinite(t)) return null;
    return Math.max(0, Date.now() - t);
  } catch {
    return null;
  }
}

/** Last posted coords — used to kill Doppler when the pin hasn’t actually moved. */
let lastSpeedGate:
  | { lat: number; lng: number; at: number }
  | null = null;

function metersBetweenLatLng(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dn = (b.lat - a.lat) * 111_320;
  const de =
    (b.lng - a.lng) * 111_320 * Math.max(0.2, Math.cos((a.lat * Math.PI) / 180));
  return Math.hypot(dn, de);
}

/**
 * GPS often reports leftover walking/driving speed from a stale last-known fix
 * while the person is sitting still (park, couch). Zero those out — but if the
 * pin clearly moved since the last sample, trust displacement (deferred BG
 * batches were wiping Tim Hortons drives to "Stationary / At Home").
 */
export function speedKmhFromLocation(pos: Location.LocationObject): number | null {
  const ageMs = Math.max(0, Date.now() - pos.timestamp);
  const accuracy = pos.coords.accuracy;
  const speedMs = pos.coords.speed;
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  let movedM: number | null = null;
  let dtSec: number | null = null;
  if (lastSpeedGate) {
    movedM = metersBetweenLatLng(lastSpeedGate, { lat, lng });
    dtSec = Math.max(0.5, (pos.timestamp - lastSpeedGate.at) / 1000);
  }

  // Deferred / last-known sample: don't invent Doppler, but keep real travel.
  if (ageMs > 20_000) {
    let fromMove: number | null = null;
    if (movedM != null && dtSec != null && movedM >= 40 && dtSec >= 3) {
      fromMove = Math.round(((movedM / 1000) / (dtSec / 3600)) * 10) / 10;
      if (fromMove > 200) fromMove = null;
      if (fromMove != null && fromMove < 1.5) fromMove = 0;
    }
    lastSpeedGate = { lat, lng, at: pos.timestamp };
    return fromMove;
  }

  if (speedMs == null || !Number.isFinite(speedMs) || speedMs < 0) {
    // No Doppler — still allow displacement when the task batched a jump.
    if (movedM != null && dtSec != null && movedM >= 40 && dtSec >= 3) {
      const fromMove = Math.round(((movedM / 1000) / (dtSec / 3600)) * 10) / 10;
      lastSpeedGate = { lat, lng, at: pos.timestamp };
      if (fromMove > 200) return null;
      return fromMove < 1.5 ? 0 : fromMove;
    }
    lastSpeedGate = { lat, lng, at: pos.timestamp };
    return null;
  }

  let speedKmh = Math.round(speedMs * 3.6 * 10) / 10;
  if (speedKmh < 1.5) speedKmh = 0;

  // Poor accuracy + moderate speed ≈ GPS jitter, not real motion.
  if (typeof accuracy === "number") {
    if (accuracy > 80 && speedKmh < 40) speedKmh = 0;
    if (accuracy > 55 && speedKmh < 20) speedKmh = 0;
    if (accuracy > 45 && speedKmh < 14) speedKmh = 0;
  }

  // First sample after process/login wake — seed the gate, don't trust
  // leftover last-known walking Doppler while the person is sitting.
  if (movedM == null) {
    lastSpeedGate = { lat, lng, at: pos.timestamp };
    if (speedKmh > 200) return null;
    return speedKmh >= 12 ? speedKmh : 0;
  }

  // Pin barely moved → leftover Doppler (Mic Mac Park “Driving 25”,
  // Hamoudi “42 km/h” over a house). Driving needs real metres.
  if (speedKmh > 0) {
    if (speedKmh < 8) {
      const stillFloor = Math.max(
        12,
        typeof accuracy === "number" ? accuracy * 0.35 : 14
      );
      if (movedM < stillFloor) speedKmh = 0;
    } else if (speedKmh < 12) {
      const stillFloor = Math.max(
        14,
        typeof accuracy === "number" ? accuracy * 0.4 : 16
      );
      if (movedM < stillFloor) speedKmh = 0;
    } else {
      if (dtSec != null && dtSec <= 5 && movedM < 15) speedKmh = 0;
      else if (speedKmh >= 25 && movedM < 25) speedKmh = 0;
      else if (dtSec != null && dtSec >= 1 && dtSec <= 90) {
        const dispKmh = movedM / 1000 / (dtSec / 3600);
        if (Number.isFinite(dispKmh) && dispKmh < Math.max(5, speedKmh * 0.35)) {
          speedKmh = dispKmh < 1.5 ? 0 : Math.round(dispKmh * 10) / 10;
        }
      } else if (movedM < 18) {
        speedKmh = 0;
      }
    }
  }

  lastSpeedGate = { lat, lng, at: pos.timestamp };

  if (speedKmh > 200) return null;
  return speedKmh;
}

/**
 * Android (esp. Z Fold) cannot safely call getCurrentPositionAsync after
 * permission UI — it hard-crashes. Prefer last-known, relaxing age/accuracy
 * until we get a pin. Speed is still sanitized separately for stale samples.
 */
const ANDROID_LAST_KNOWN_TIERS: Array<{
  maxAge: number;
  requiredAccuracy: number;
}> = [
  { maxAge: 90_000, requiredAccuracy: 150 },
  { maxAge: 5 * 60_000, requiredAccuracy: 500 },
  { maxAge: 20 * 60_000, requiredAccuracy: 2_000 },
  { maxAge: 60 * 60_000, requiredAccuracy: 5_000 },
];

export async function readAndroidBestEffortPosition(opts?: {
  /** How long to keep polling last-known (enable-location needs longer). */
  timeoutMs?: number;
  /** Allow getCurrentPosition on non-fold phones after last-known fails. */
  allowFreshRead?: boolean;
}): Promise<Location.LocationObject | null> {
  if (Platform.OS !== "android") return null;

  const timeoutMs = opts?.timeoutMs ?? 12_000;
  const allowFreshRead = opts?.allowFreshRead === true && !isLikelyAndroidFoldable();
  const deadline = Date.now() + timeoutMs;
  // Leave time for a careful current-position attempt on non-fold phones.
  const lastKnownDeadline = allowFreshRead
    ? Math.min(deadline, Date.now() + Math.max(4_000, timeoutMs - 9_000))
    : deadline;
  let attempt = 0;

  while (Date.now() < lastKnownDeadline) {
    const tier =
      ANDROID_LAST_KNOWN_TIERS[Math.min(attempt, ANDROID_LAST_KNOWN_TIERS.length - 1)]!;
    try {
      const pos = await Location.getLastKnownPositionAsync({
        maxAge: tier.maxAge,
        requiredAccuracy: tier.requiredAccuracy,
      });
      if (pos) return pos;
    } catch {
      // keep trying
    }

    // Absolute fallback: any cached fix Android still has.
    if (attempt >= ANDROID_LAST_KNOWN_TIERS.length - 1) {
      try {
        const any = await Location.getLastKnownPositionAsync();
        if (any) return any;
      } catch {
        // ignore
      }
    }

    attempt += 1;
    await sleep(450);
  }

  // Phones (not Fold): one careful current-position attempt after settle.
  if (allowFreshRead && Date.now() < deadline) {
    try {
      await settleAfterAndroidUi(400);
      const remaining = Math.max(2_000, deadline - Date.now());
      const fresh = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          mayShowUserSettingsDialog: false,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), remaining)),
      ]);
      if (fresh) return fresh;
    } catch (e) {
      console.warn(
        "[backgroundLocation] android fresh read failed",
        e instanceof Error ? e.message : e
      );
    }
  }

  return null;
}

export function fixPayloadFromLocation(pos: Location.LocationObject) {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracyM: pos.coords.accuracy ?? null,
    speedKmh: speedKmhFromLocation(pos),
    headingDeg:
      pos.coords.heading != null && pos.coords.heading >= 0 ? pos.coords.heading : null,
    recordedAt: new Date(pos.timestamp).toISOString(),
  };
}

/** Android live sharing without a foreground service (Fold-safe). */
let androidPollTimer: ReturnType<typeof setInterval> | null = null;

async function postAndroidForegroundFix(): Promise<void> {
  try {
    const share = await getBgStore(SHARE_KEY);
    if (share !== "1") return;
    if (AppState.currentState !== "active") return;
    // Prefer best-effort last-known (Fold-safe). Speed is sanitized for stale fixes.
    const pos = await readAndroidBestEffortPosition({
      timeoutMs: 2_500,
      allowFreshRead: false,
    });
    if (!pos) return;
    await postFamilyLocationFix(pos);
  } catch (e) {
    console.warn(
      "[backgroundLocation] android poll failed",
      e instanceof Error ? e.message : e
    );
  }
}

function startAndroidForegroundPoll(intervalMs = 6_000): void {
  if (androidPollTimer) return;
  console.warn(
    `[backgroundLocation] Android FGS disabled (${androidDeviceLabel()}) — last-known poll only`
  );
  // Delay first poll so we are clear of any permission UI.
  setTimeout(() => {
    void postAndroidForegroundFix();
  }, 2_500);
  androidPollTimer = setInterval(() => {
    void postAndroidForegroundFix();
  }, Math.max(4_000, intervalMs));
}

function stopAndroidForegroundPoll(): void {
  if (androidPollTimer) {
    clearInterval(androidPollTimer);
    androidPollTimer = null;
  }
}

/**
 * Android location updates.
 * Foldable: foreground last-known poll only (FGS hard-crashes Z Fold).
 * Other Android phones: real background FGS so pins keep moving while locked.
 */
function scheduleAndroidLocationUpdates(_opts?: { delayMs?: number }): void {
  if (Platform.OS !== "android") return;

  if (androidFgsTimer) {
    clearTimeout(androidFgsTimer);
    androidFgsTimer = null;
  }

  if (shouldAvoidAndroidLocationFgs()) {
    // Stop any FGS an older APK may have left running on Fold.
    void (async () => {
      try {
        const started = await Location.hasStartedLocationUpdatesAsync(FAMILY_LOCATION_TASK);
        if (started) await Location.stopLocationUpdatesAsync(FAMILY_LOCATION_TASK);
      } catch {
        // ignore
      }
      // No FGS on Fold — geofence + motion still wake closed-app heartbeats.
      await armStationaryGeofenceFromCache({ force: true });
      await ensureHeartbeatTaskRegistered();
    })();
    startAndroidForegroundPoll();
    return;
  }

  stopAndroidForegroundPoll();
  const delayMs = 900;
  androidFgsTimer = setTimeout(() => {
    androidFgsTimer = null;
    void (async () => {
      if (androidFgsInFlight) return;
      androidFgsInFlight = true;
      try {
        const share = await getBgStore(SHARE_KEY);
        if (share !== "1") return;
        const stable = await waitForStableActive(800, 15_000);
        if (!stable) return;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await settleAfterAndroidUi(attempt === 1 ? 400 : 800);
            await startAndroidLocationUpdatesOnce();
            await armStationaryGeofenceFromCache({ force: true });
            await ensureHeartbeatTaskRegistered();
            return;
          } catch (e) {
            console.warn(
              `[backgroundLocation] deferred FGS attempt ${attempt}/3 failed`,
              e instanceof Error ? e.message : e
            );
          }
        }
      } finally {
        androidFgsInFlight = false;
      }
    })();
  }, delayMs);
}

/** Open system Location (GPS) settings — not app-info (where Location may be missing until granted). */
export async function openSystemLocationSettings(): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      await Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS");
      return true;
    }
    // iOS has no public deep-link to Location Services; app settings is closest.
    await Linking.openSettings();
    return true;
  } catch {
    try {
      await Linking.openSettings();
      return true;
    } catch {
      return false;
    }
  }
}

TaskManager.defineTask(FAMILY_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn("[backgroundLocation]", error.message);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  if (!locations?.length) return;

  const enabled = await getBgStore(SHARE_KEY);
  if (enabled !== "1") return;

  const token = await getBgStore(SESSION_KEY);
  if (!token) return;

  // One POST per batch — pick the freshest accurate fix (not always last).
  const loc = pickBestLocationSample(locations);
  await postFamilyLocationFix(loc);
});

/**
 * iOS continuous GPS goes quiet while sitting still (no motion → no callbacks).
 * A tight geofence still wakes on GPS jitter / short walks so we can POST a
 * heartbeat and keep household "Updated Now" without needing a drive.
 */
TaskManager.defineTask(FAMILY_STATIONARY_GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    console.warn("[backgroundLocation] geofence", error.message);
    return;
  }
  try {
    const enabled = await getBgStore(SHARE_KEY);
    if (enabled !== "1") return;

    const payload = data as
      | {
          eventType?: Location.LocationGeofencingEventType;
          region?: Location.LocationRegion;
        }
      | undefined;
    const eventType = payload?.eventType;
    console.warn(
      "[backgroundLocation] stationary geofence event",
      eventType === Location.GeofencingEventType.Enter
        ? "enter"
        : eventType === Location.GeofencingEventType.Exit
          ? "exit"
          : String(eventType ?? "?")
    );

    let pos: Location.LocationObject | null = null;
    try {
      pos = await Location.getLastKnownPositionAsync();
    } catch {
      pos = null;
    }
    if (!pos && payload?.region?.latitude != null && payload.region.longitude != null) {
      pos = {
        coords: {
          latitude: payload.region.latitude,
          longitude: payload.region.longitude,
          altitude: null,
          accuracy: STATIONARY_FENCE_RADIUS_M,
          altitudeAccuracy: null,
          heading: null,
          speed: 0,
        },
        timestamp: Date.now(),
      } as Location.LocationObject;
    }
    if (!pos) {
      await flushFamilyLocationHeartbeat();
      return;
    }
    await postFamilyLocationFix(pos);
    // Exit means we left the bubble — re-center immediately on the new fix.
    if (eventType === Location.GeofencingEventType.Exit) {
      await ensureStationaryGeofence(pos.coords.latitude, pos.coords.longitude, {
        force: true,
      });
    }
  } catch (e) {
    console.warn(
      "[backgroundLocation] geofence handler failed",
      e instanceof Error ? e.message : e
    );
  }
});

async function armStationaryGeofenceFromCache(opts?: { force?: boolean }): Promise<void> {
  try {
    const raw = await getBgStore(LAST_KNOWN_KEY);
    if (!raw) return;
    const cached = JSON.parse(raw) as { lat: number; lng: number };
    if (!Number.isFinite(cached.lat) || !Number.isFinite(cached.lng)) return;
    await ensureStationaryGeofence(cached.lat, cached.lng, {
      force: opts?.force === true,
    });
  } catch {
    // optional
  }
}

async function ensureStationaryGeofence(
  lat: number,
  lng: number,
  opts?: { force?: boolean }
): Promise<void> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  try {
    const share = await getBgStore(SHARE_KEY);
    if (share !== "1") return;

    // Always permission required for geofencing on iOS.
    const bg = await Location.getBackgroundPermissionsAsync();
    const snap = await getFamilyLocationPermissionSnapshot();
    const always =
      bg.status === Location.PermissionStatus.GRANTED || snap.iosScope === "always";
    if (Platform.OS === "ios" && !always) return;

    const raw = await getBgStore(STATIONARY_FENCE_KEY);
    if (raw && !opts?.force) {
      try {
        const prev = JSON.parse(raw) as { lat: number; lng: number; at?: number };
        const movedM = metersBetweenLatLng(
          { lat: prev.lat, lng: prev.lng },
          { lat, lng }
        );
        const ageMs =
          prev.at && Number.isFinite(prev.at) ? Date.now() - prev.at : Number.POSITIVE_INFINITY;
        // Avoid thrashing startGeofencing on every GPS tick while parked.
        if (movedM < STATIONARY_FENCE_RECENTER_M && ageMs < 5 * 60_000) return;
      } catch {
        // re-arm
      }
    }

    await Location.startGeofencingAsync(FAMILY_STATIONARY_GEOFENCE_TASK, [
      {
        identifier: "motivelife-stationary-heartbeat",
        latitude: lat,
        longitude: lng,
        radius: STATIONARY_FENCE_RADIUS_M,
        notifyOnEnter: true,
        notifyOnExit: true,
      },
    ]);
    await setBgStore(
      STATIONARY_FENCE_KEY,
      JSON.stringify({ lat, lng, at: Date.now() })
    );
  } catch (e) {
    console.warn(
      "[backgroundLocation] stationary geofence arm failed",
      e instanceof Error ? e.message : e
    );
  }
}

async function stopStationaryGeofence(): Promise<void> {
  try {
    const started = await Location.hasStartedGeofencingAsync(
      FAMILY_STATIONARY_GEOFENCE_TASK
    );
    if (started) await Location.stopGeofencingAsync(FAMILY_STATIONARY_GEOFENCE_TASK);
  } catch {
    // ignore
  }
  await deleteBgStore(STATIONARY_FENCE_KEY);
}

/**
 * Safety-net heartbeat when Core Location goes quiet indoors.
 * iOS schedules this on its own cadence (often ~15+ min) — not a substitute for
 * continuous location, but keeps lastLocationAt from freezing for hours.
 */
TaskManager.defineTask(FAMILY_HEARTBEAT_TASK, async () => {
  try {
    const { BackgroundTaskResult } = await import("expo-background-task");
    const enabled = await getBgStore(SHARE_KEY);
    if (enabled !== "1") return BackgroundTaskResult.Success;

    const age = await lastOkPostAgeMs();
    // Skip if continuous location already posted recently.
    if (age != null && age < 8 * 60_000) return BackgroundTaskResult.Success;

    let pos: Location.LocationObject | null = null;
    try {
      pos = await Location.getLastKnownPositionAsync();
    } catch {
      pos = null;
    }
    if (!pos) {
      const raw = await getBgStore(LAST_KNOWN_KEY);
      if (raw) {
        try {
          const cached = JSON.parse(raw) as {
            lat: number;
            lng: number;
            accuracyM?: number | null;
            gpsAt?: number;
            at?: number;
          };
          if (
            Number.isFinite(cached.lat) &&
            Number.isFinite(cached.lng)
          ) {
            const gpsAt =
              typeof cached.gpsAt === "number" && Number.isFinite(cached.gpsAt)
                ? cached.gpsAt
                : typeof cached.at === "number" && Number.isFinite(cached.at)
                  ? cached.at
                  : Date.now() - 60_000;
            pos = {
              coords: {
                latitude: cached.lat,
                longitude: cached.lng,
                altitude: null,
                accuracy: cached.accuracyM ?? 80,
                altitudeAccuracy: null,
                heading: null,
                speed: 0,
              },
              timestamp: gpsAt,
            } as Location.LocationObject;
          }
        } catch {
          // ignore
        }
      }
    }
    if (!pos) return BackgroundTaskResult.Failed;
    const ok = await postFamilyLocationFix(pos);
    return ok ? BackgroundTaskResult.Success : BackgroundTaskResult.Failed;
  } catch (e) {
    console.warn(
      "[backgroundLocation] heartbeat failed",
      e instanceof Error ? e.message : e
    );
    try {
      const { BackgroundTaskResult } = await import("expo-background-task");
      return BackgroundTaskResult.Failed;
    } catch {
      return 2;
    }
  }
});

async function ensureHeartbeatTaskRegistered(): Promise<void> {
  try {
    const BackgroundTask = await import("expo-background-task");
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    const registered = await TaskManager.isTaskRegisteredAsync(FAMILY_HEARTBEAT_TASK);
    if (registered) return;
    await BackgroundTask.registerTaskAsync(FAMILY_HEARTBEAT_TASK, {
      // Advisory minimum — iOS often runs less often; still better than never.
      minimumInterval: 15,
    });
  } catch (e) {
    console.warn(
      "[backgroundLocation] heartbeat register failed",
      e instanceof Error ? e.message : e
    );
  }
}

async function stopHeartbeatTask(): Promise<void> {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(FAMILY_HEARTBEAT_TASK);
    if (!registered) return;
    const BackgroundTask = await import("expo-background-task");
    await BackgroundTask.unregisterTaskAsync(FAMILY_HEARTBEAT_TASK);
  } catch {
    // ignore
  }
}

/**
 * iOS Always options — cadence comes from locationCore sampling profile.
 * distanceInterval is forced to 0 in locationTaskOptionsFromProfile.
 */
async function iosFamilyLocationUpdateOptions(): Promise<Location.LocationTaskOptions> {
  const profile = pendingProfile ?? (await loadCurrentProfile());
  return locationTaskOptionsFromProfile(profile);
}

async function ensureIosLocationUpdatesRunning(opts?: {
  forceRestart?: boolean;
}): Promise<void> {
  if (Platform.OS !== "ios") return;
  await migrateBgStoreAccessibility();
  const started = await Location.hasStartedLocationUpdatesAsync(FAMILY_LOCATION_TASK);
  const storedVer = await getBgStore(IOS_BG_OPTIONS_VERSION_KEY);
  const needsUpgrade = storedVer !== IOS_BG_OPTIONS_VERSION;
  const hasPendingProfile = pendingProfile != null;
  if (started && (opts?.forceRestart || needsUpgrade || hasPendingProfile)) {
    try {
      await Location.stopLocationUpdatesAsync(FAMILY_LOCATION_TASK);
    } catch {
      // ignore
    }
  } else if (started) {
    await ensureProfileListener();
    return;
  }
  const options = await iosFamilyLocationUpdateOptions();
  await Location.startLocationUpdatesAsync(FAMILY_LOCATION_TASK, options);
  await setBgStore(IOS_BG_OPTIONS_VERSION_KEY, IOS_BG_OPTIONS_VERSION);
  const profile = pendingProfile ?? (await loadCurrentProfile());
  activeProfileId = profile.id;
  pendingProfile = null;
  await ensureProfileListener();
  await ensureHeartbeatTaskRegistered();
  await armStationaryGeofenceFromCache({ force: true });
}

/**
 * Best-effort last-known POST while iOS still gives us a few seconds on
 * background/inactive. Keeps household "Updated Now" from freezing the moment
 * the user leaves the app — continuous BG still required for long closed-app.
 */
export async function flushFamilyLocationHeartbeat(): Promise<boolean> {
  try {
    await migrateBgStoreAccessibility();
    const share = await getBgStore(SHARE_KEY);
    if (share !== "1") return false;
    const token = await getBgStore(SESSION_KEY);
    if (!token) return false;

    let pos: Location.LocationObject | null = null;
    try {
      pos = await Location.getLastKnownPositionAsync();
    } catch {
      pos = null;
    }
    if (!pos) {
      const raw = await getBgStore(LAST_KNOWN_KEY);
      if (raw) {
        try {
          const cached = JSON.parse(raw) as {
            lat: number;
            lng: number;
            accuracyM?: number | null;
            gpsAt?: number;
            at?: number;
          };
          if (Number.isFinite(cached.lat) && Number.isFinite(cached.lng)) {
            const gpsAt =
              typeof cached.gpsAt === "number" && Number.isFinite(cached.gpsAt)
                ? cached.gpsAt
                : typeof cached.at === "number" && Number.isFinite(cached.at)
                  ? cached.at
                  : Date.now() - 60_000;
            pos = {
              coords: {
                latitude: cached.lat,
                longitude: cached.lng,
                altitude: null,
                accuracy: cached.accuracyM ?? 80,
                altitudeAccuracy: null,
                heading: null,
                speed: 0,
              },
              timestamp: gpsAt,
            } as Location.LocationObject;
          }
        } catch {
          // ignore
        }
      }
    }
    if (!pos) return false;
    return postFamilyLocationFix(pos);
  } catch (e) {
    console.warn(
      "[backgroundLocation] flush heartbeat failed",
      e instanceof Error ? e.message : e
    );
    return false;
  }
}

/**
 * Cold-start / app-active resume: if the user left Share Live on, re-arm the
 * iOS Always task so tracking continues after the app is swiped away (when Always
 * permission is granted). No permission dialogs.
 */
export async function resumeFamilyBackgroundIfNeeded(): Promise<{
  ok: boolean;
  backgroundGranted: boolean;
  message: string;
}> {
  await migrateBgStoreAccessibility();
  const share = await getBgStore(SHARE_KEY);
  if (share !== "1") {
    return { ok: false, backgroundGranted: false, message: "Share live is off." };
  }
  const token = await getBgStore(SESSION_KEY);
  if (!token) {
    return { ok: false, backgroundGranted: false, message: "Not signed in." };
  }

  if (Platform.OS === "android") {
    const age = await lastOkPostAgeMs();
    if (age == null || age > STALE_POST_FORCE_RESTART_MS) {
      // Stale posts — tear down and reschedule so FGS / poll actually run again.
      try {
        const started = await Location.hasStartedLocationUpdatesAsync(FAMILY_LOCATION_TASK);
        if (started) await Location.stopLocationUpdatesAsync(FAMILY_LOCATION_TASK);
      } catch {
        // ignore
      }
      stopAndroidForegroundPoll();
    }
    scheduleAndroidLocationUpdates();
    // Push one fix immediately while the app is open so the household sees movement now.
    if (AppState.currentState === "active") {
      void postAndroidForegroundFix();
    }
    void ensureHeartbeatTaskRegistered();
    void armStationaryGeofenceFromCache({ force: true });
    const snap = await getFamilyLocationPermissionSnapshot();
    return {
      ok: true,
      backgroundGranted: snap.backgroundGranted,
      message: snap.backgroundGranted
        ? "Android background location resumed."
        : "Android live location resumed while MotiveLife is open.",
    };
  }

  const servicesOn = await Location.hasServicesEnabledAsync();
  if (!servicesOn) {
    return { ok: false, backgroundGranted: false, message: "Location Services are off." };
  }
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== Location.PermissionStatus.GRANTED) {
    return { ok: false, backgroundGranted: false, message: "Location permission is off." };
  }
  const bg = await Location.getBackgroundPermissionsAsync();
  const after = await getFamilyLocationPermissionSnapshot();
  const backgroundGranted =
    bg.status === Location.PermissionStatus.GRANTED || after.iosScope === "always";

  try {
    // If we haven't successfully posted in a while, force-restart the task.
    // Soft-only resume left dead Always tasks looking "started" for hours.
    const age = await lastOkPostAgeMs();
    const forceRestart = age == null || age > STALE_POST_FORCE_RESTART_MS;
    await ensureIosLocationUpdatesRunning({ forceRestart });
  } catch (e) {
    console.warn("[backgroundLocation] resume failed", e);
    return {
      ok: false,
      backgroundGranted,
      message: e instanceof Error ? e.message : "Could not resume background location.",
    };
  }

  return {
    ok: true,
    backgroundGranted,
    message: backgroundGranted
      ? "Always location sharing resumed."
      : "Location resumed while using the app. Set Location to Always for tracking after close.",
  };
}

export async function saveNativeSessionToken(token: string | null) {
  if (!token) {
    await deleteBgStore(SESSION_KEY);
    return;
  }
  await setBgStore(SESSION_KEY, token);
}

export async function readNativeSessionToken(): Promise<string | null> {
  try {
    return await getBgStore(SESSION_KEY);
  } catch {
    return null;
  }
}

export type NativeLocationPermissionSnapshot = {
  servicesOn: boolean;
  foregroundGranted: boolean;
  backgroundGranted: boolean;
  /** iOS authorization scope from expo-location */
  iosScope: "whenInUse" | "always" | "none" | null;
  canAskAgain: boolean;
};

export async function getFamilyLocationPermissionSnapshot(): Promise<NativeLocationPermissionSnapshot> {
  const servicesOn = await Location.hasServicesEnabledAsync();
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  const iosScope = fg.ios?.scope ?? null;
  return {
    servicesOn,
    foregroundGranted: fg.status === Location.PermissionStatus.GRANTED,
    backgroundGranted: bg.status === Location.PermissionStatus.GRANTED,
    iosScope,
    canAskAgain: fg.canAskAgain !== false,
  };
}

export function promptAndroidLocationSettingsHelp(kind: "app" | "gps") {
  if (Platform.OS !== "android") return;
  const title = kind === "gps" ? "Turn on phone Location" : "Allow Location for MotiveLife";
  const message =
    kind === "gps"
      ? "Open the Location screen and turn Location ON (GPS). Then return to MotiveLife and tap Enable location again."
      : "In Settings → Apps → MotiveLife → Permissions → Location, choose Allow (or Allow all the time).\n\nIf Location is missing from the list, uninstall MotiveLife and install EAS build v1.0.14+ from apps/mobile-eas.";

  Alert.alert(title, message, [
    { text: "Not now", style: "cancel" },
    {
      text: kind === "gps" ? "Open Location settings" : "Open app settings",
      onPress: () => {
        void (kind === "gps" ? openSystemLocationSettings() : Linking.openSettings());
      },
    },
  ]);
}

/**
 * Android: request app Location permission FIRST (so it appears under
 * Settings → Apps → MotiveLife → Permissions), then prompt to turn on the
 * phone Location / GPS toggle via Play Services or system settings.
 */
export async function ensureAndroidLocationReady(opts?: {
  /** When false, never show permission dialogs — resume path only. */
  prompt?: boolean;
}): Promise<{
  ok: boolean;
  message: string;
  foregroundGranted: boolean;
  servicesOn: boolean;
}> {
  const prompt = opts?.prompt !== false;

  // 1) Prefer check-only when resuming. Only request on an explicit user allow.
  const checked = await checkAndroidForegroundLocation();
  let rn = checked;
  let fg = await Location.getForegroundPermissionsAsync();

  if (fg.status !== Location.PermissionStatus.GRANTED && !(checked.fine || checked.coarse)) {
    if (!prompt) {
      return {
        ok: false,
        foregroundGranted: false,
        servicesOn: await Location.hasServicesEnabledAsync(),
        message: "Location permission is off.",
      };
    }
    rn = await requestAndroidForegroundLocation();
    fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== Location.PermissionStatus.GRANTED) {
      fg = await Location.requestForegroundPermissionsAsync();
    }
  }

  const foregroundGranted =
    fg.status === Location.PermissionStatus.GRANTED || rn.fine || rn.coarse;

  if (!foregroundGranted) {
    if (prompt) {
      promptAndroidLocationSettingsHelp("app");
      if (!rn.canAskAgain || fg.canAskAgain === false) {
        await Linking.openSettings();
      }
    }
    return {
      ok: false,
      foregroundGranted: false,
      servicesOn: await Location.hasServicesEnabledAsync(),
      message:
        !rn.canAskAgain || fg.canAskAgain === false
          ? "Location permission is blocked. In MotiveLife app settings: Permissions → Location → Allow (or Allow all the time)."
          : "Tap Allow on the Location permission dialog so MotiveLife can share your pin with your household.",
    };
  }

  // 2) Phone Location / GPS master switch
  let servicesOn = await Location.hasServicesEnabledAsync();
  if (!servicesOn && prompt) {
    // Never call enableNetworkProviderAsync — Play Services resolution UI
    // hard-crashes the MotiveLife WebView process on Z Fold.
    promptAndroidLocationSettingsHelp("gps");
    await openSystemLocationSettings();
    await sleep(800);
    servicesOn = await Location.hasServicesEnabledAsync();
  }

  if (!servicesOn) {
    if (prompt) {
      promptAndroidLocationSettingsHelp("gps");
      await openSystemLocationSettings();
    }
    return {
      ok: false,
      foregroundGranted: true,
      servicesOn: false,
      message:
        "Phone Location is still off. Turn on Location (GPS) in the system screen that opened, then return to MotiveLife and tap Enable location again.",
    };
  }

  // Permission / GPS settings just closed — give the Fold activity a beat.
  if (prompt) {
    await settleAfterAndroidUi(500);
  }

  return {
    ok: true,
    foregroundGranted: true,
    servicesOn: true,
    message: "Location ready.",
  };
}

/** Read a GPS fix without showing any permission dialogs. */
export async function readFamilyLocationFixSilent(): Promise<
  | {
      ok: true;
      fix: {
        lat: number;
        lng: number;
        accuracyM: number | null;
        speedKmh: number | null;
        headingDeg: number | null;
        recordedAt: string;
      };
    }
  | { ok: false; reason: "denied" | "unavailable" | "error"; message: string }
> {
  const servicesOn = await Location.hasServicesEnabledAsync();
  if (!servicesOn) {
    return {
      ok: false,
      reason: "unavailable",
      message: "Phone Location is off.",
    };
  }

  if (Platform.OS === "android") {
    const ready = await ensureAndroidLocationReady({ prompt: false });
    if (!ready.ok) {
      return {
        ok: false,
        reason: ready.foregroundGranted ? "unavailable" : "denied",
        message: ready.message,
      };
    }
  } else {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== Location.PermissionStatus.GRANTED) {
      return {
        ok: false,
        reason: "denied",
        message: "Location permission is off.",
      };
    }
  }

  try {
    // Android (esp. Z Fold): NEVER call getCurrentPositionAsync — it hard-crashes
    // near permission UI. Best-effort last-known; poll refreshes while the app is open.
    if (Platform.OS === "android") {
      const pos = await readAndroidBestEffortPosition({
        timeoutMs: 8_000,
        allowFreshRead: false,
      });
      if (!pos) {
        return {
          ok: false,
          reason: "error",
          message: "Waiting for a GPS fix — keep MotiveLife open a moment.",
        };
      }
      return {
        ok: true,
        fix: fixPayloadFromLocation(pos),
      };
    }

    // iOS: Prefer a fresh GPS read. Last-known-first was freezing pins at home.
    let pos =
      (await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          mayShowUserSettingsDialog: false,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
      ])) ?? null;

    if (!pos) {
      pos =
        (await Location.getLastKnownPositionAsync({
          maxAge: 12_000,
          requiredAccuracy: 80,
        })) ?? null;
    }

    if (!pos) {
      return { ok: false, reason: "error", message: "Could not read GPS yet." };
    }

    const ageMs = Math.max(0, Date.now() - pos.timestamp);
    if (ageMs > 45_000) {
      return {
        ok: false,
        reason: "error",
        message: "GPS fix is stale — waiting for a fresh read.",
      };
    }

    return {
      ok: true,
      fix: {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyM: pos.coords.accuracy ?? null,
        speedKmh: speedKmhFromLocation(pos),
        headingDeg:
          pos.coords.heading != null && pos.coords.heading >= 0 ? pos.coords.heading : null,
        recordedAt: new Date(pos.timestamp).toISOString(),
      },
    };
  } catch (e) {
    return {
      ok: false,
      reason: "error",
      message: e instanceof Error ? e.message : "Could not read GPS.",
    };
  }
}

/** Native alert that opens Settings so the user can leave “When I Share”. */
export function promptIosLocationSettingsHelp(kind: "whenInUse" | "always") {
  if (Platform.OS !== "ios") return;
  const title =
    kind === "always" ? "Turn on Always location" : "Location stuck on “When I Share”";
  const message =
    kind === "always"
      ? 'In Settings → MotiveLife → Location, choose Always.\n\nIf you only see “Ask Next Time Or When I Share”, tap While Using the App first, return here, then Enable location again for Always.'
      : '“Ask Next Time Or When I Share” is not enough for Family Map.\n\n1. Open Settings → MotiveLife → Location\n2. Tap While Using the App (or Always)\n3. Return to MotiveLife and tap Enable location again\n\nDo not leave it on When I Share. Do not pick Allow Once.';

  Alert.alert(title, message, [
    { text: "Not now", style: "cancel" },
    {
      text: "Open Settings",
      onPress: () => {
        void Linking.openSettings();
      },
    },
  ]);
}

/**
 * Start the background task.
 * - promptAlways=true (user tapped Allow): may request Always / all-the-time.
 * - promptAlways=false (app resume): never show permission dialogs or Always nags.
 */
export async function startFamilyBackgroundLocation(
  sessionToken: string,
  opts?: { promptAlways?: boolean }
): Promise<{
  ok: boolean;
  message: string;
  backgroundGranted: boolean;
  iosScope: "whenInUse" | "always" | "none" | null;
}> {
  const promptAlways = opts?.promptAlways === true;
  await migrateBgStoreAccessibility();
  await saveNativeSessionToken(sessionToken);
  await setBgStore(SHARE_KEY, "1");

  if (Platform.OS === "android") {
    const ready = await ensureAndroidLocationReady({ prompt: promptAlways });
    if (!ready.ok) {
      return {
        ok: false,
        backgroundGranted: false,
        iosScope: null,
        message: ready.message,
      };
    }
    // Request "Allow all the time" when user taps Enable — needed for geofence
    // wakes while closed (Fold has no FGS; other phones use FGS + geofence).
    if (promptAlways) {
      try {
        await requestAndroidBackgroundLocation();
      } catch {
        // May deny — FGS can still run with foreground permission on non-Fold.
      }
    }
    scheduleAndroidLocationUpdates();
    void ensureHeartbeatTaskRegistered();
    void armStationaryGeofenceFromCache({ force: true });
    // One flush as the user backgrounds after enabling.
    void flushFamilyLocationHeartbeat();
    const afterAndroid = await getFamilyLocationPermissionSnapshot();
    return {
      ok: true,
      backgroundGranted: afterAndroid.backgroundGranted,
      iosScope: null,
      message: afterAndroid.backgroundGranted
        ? "Always / background location sharing is on."
        : shouldAvoidAndroidLocationFgs()
          ? "Live location is on while MotiveLife is open. For closed-app updates: Settings → Apps → MotiveLife → Permissions → Location → Allow all the time."
          : "Live sharing on while using the app. For Always: Settings → Apps → MotiveLife → Permissions → Location → Allow all the time.",
    };
  } else {
    const servicesOn = await Location.hasServicesEnabledAsync();
    if (!servicesOn) {
      return {
        ok: false,
        backgroundGranted: false,
        iosScope: null,
        message:
          "Location Services are off. Turn them on in iPhone Settings → Privacy & Security → Location Services.",
      };
    }

    let fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== Location.PermissionStatus.GRANTED) {
      if (!promptAlways) {
        return {
          ok: false,
          backgroundGranted: false,
          iosScope: fg.ios?.scope ?? "none",
          message: "Location permission is off.",
        };
      }
      // "Ask Next Time Or When I Share" reports as not granted — prompt once from user tap.
      fg = await Location.requestForegroundPermissionsAsync();
    }
    if (fg.status !== Location.PermissionStatus.GRANTED) {
      if (promptAlways) promptIosLocationSettingsHelp("whenInUse");
      return {
        ok: false,
        backgroundGranted: false,
        iosScope: fg.ios?.scope ?? "none",
        message:
          'Location is stuck on “When I Share” / not allowed. In Settings → MotiveLife → Location choose While Using the App (or Always), then tap Enable location again.',
      };
    }
    if (promptAlways) {
      // Brief settle so iOS can show the Always upgrade dialog.
      await sleep(1000);
    }
  }

  // iOS path only below (Android returns earlier).
  let bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== Location.PermissionStatus.GRANTED && promptAlways) {
    bg = await Location.requestBackgroundPermissionsAsync();
  }

  const after = await getFamilyLocationPermissionSnapshot();
  const backgroundGranted =
    bg.status === Location.PermissionStatus.GRANTED || after.iosScope === "always";

  if (after.foregroundGranted) {
    try {
      await ensureIosLocationUpdatesRunning({ forceRestart: promptAlways });
    } catch (e) {
      console.warn("[backgroundLocation] start updates failed", e);
    }
  }

  if (!backgroundGranted) {
    if (promptAlways) promptIosLocationSettingsHelp("always");
    return {
      ok: true,
      backgroundGranted: false,
      iosScope: after.iosScope,
      message: promptAlways
        ? 'Still not Always. Open Settings → MotiveLife → Location → Always (set While Using first if you only see “When I Share”). Then return and tap Enable location.'
        : "Live location resumed while using the app.",
    };
  }

  return {
    ok: true,
    backgroundGranted: true,
    iosScope: after.iosScope ?? "always",
    message: "Always / background location sharing is on.",
  };
}

export async function stopFamilyBackgroundLocation(): Promise<void> {
  await setBgStore(SHARE_KEY, "0");
  pendingProfile = null;
  activeProfileId = null;
  if (androidFgsTimer) {
    clearTimeout(androidFgsTimer);
    androidFgsTimer = null;
  }
  stopAndroidForegroundPoll();
  await stopHeartbeatTask();
  await stopStationaryGeofence();
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(FAMILY_LOCATION_TASK);
    if (started) await Location.stopLocationUpdatesAsync(FAMILY_LOCATION_TASK);
  } catch {
    // ignore
  }
}
