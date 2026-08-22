export type HealthConnectSyncResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

type CapHealthSample = {
  dataType: string;
  value: number;
  startDate: string;
  endDate?: string;
  sleepState?: string;
};

type CapWorkout = {
  duration?: number;
  startDate: string;
  endDate?: string;
  workoutType?: string;
};

type CapHealthPlugin = {
  isAvailable?: () => Promise<{ available: boolean; reason?: string }>;
  requestAuthorization?: (opts: { read: string[]; write?: string[] }) => Promise<void>;
  openHealthConnectSettings?: () => Promise<void>;
  /** Capgo API: one dataType per call */
  readSamples?: (opts: {
    dataType: string;
    startDate: string;
    endDate: string;
    limit?: number;
  }) => Promise<{ samples: CapHealthSample[] }>;
  /** Capgo workout sessions (Samsung exercise → Health Connect). */
  queryWorkouts?: (opts: {
    startDate: string;
    endDate: string;
    limit?: number;
  }) => Promise<{ workouts: CapWorkout[]; anchor?: string | null }>;
};

type HealthMetricPayload = {
  source: "health_connect" | "apple_health";
  metricType:
    | "steps"
    | "sleep_minutes"
    | "resting_hr"
    | "active_minutes"
    | "heart_rate"
    | "sleeping_body_temp";
  value: number;
  unit: string;
  periodStart: string;
  periodEnd: string;
  externalId: string;
};

/** Prefer full set; fall back if older Play builds reject unknown permission types. */
const CAPGO_READ_FULL = [
  "steps",
  "heartRate",
  "restingHeartRate",
  "sleep",
  "calories",
  "workouts",
] as const;
const CAPGO_READ_FALLBACK = ["steps", "heartRate", "calories"] as const;

function getCapacitor() {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
      Plugins?: Record<string, CapHealthPlugin>;
    };
  };
  return w.Capacitor ?? null;
}

function getReactNativeWebView() {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
    __MOTIVELIFE_NATIVE_HEALTH__?: boolean;
    __MOTIVELIFE_NATIVE_PLATFORM__?: "ios" | "android";
  };
  return w;
}

function startOfCivilDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfTodayIso() {
  return startOfCivilDay().toISOString();
}

/** Yesterday 00:00 — overnight Samsung sleep often stamps to the prior civil day. */
function startOfYesterdayIso() {
  const d = startOfCivilDay();
  d.setDate(d.getDate() - 1);
  return d.toISOString();
}

export function civilDayKeyFromIso(iso: string) {
  const t = Date.parse(iso);
  if (Number.isFinite(t)) {
    const d = new Date(t);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return iso.slice(0, 10);
}

function todayKey() {
  return civilDayKeyFromIso(new Date().toISOString());
}

/** Sum numeric samples grouped by civil day of startDate. */
function sumByDay(samples: CapHealthSample[]) {
  const map = new Map<string, number>();
  for (const s of samples) {
    const v = Number(s.value) || 0;
    if (v <= 0) continue;
    const key = civilDayKeyFromIso(s.startDate);
    map.set(key, (map.get(key) ?? 0) + v);
  }
  return map;
}

function avgByDay(samples: CapHealthSample[]) {
  const sums = new Map<string, { total: number; n: number }>();
  for (const s of samples) {
    const v = Number(s.value) || 0;
    if (v <= 0) continue;
    const key = civilDayKeyFromIso(s.startDate);
    const cur = sums.get(key) ?? { total: 0, n: 0 };
    cur.total += v;
    cur.n += 1;
    sums.set(key, cur);
  }
  const out = new Map<string, number>();
  for (const [key, { total, n }] of sums) out.set(key, total / n);
  return out;
}

/**
 * Pure mapper used by Capgo sync + smoke tests.
 * Window may span yesterday+today — emit today-keyed steps/RHR/active, and best overnight sleep.
 */
export function metricsFromCapgoSamples(input: {
  samplesByType: Record<string, CapHealthSample[]>;
  workouts?: CapWorkout[];
  startDate: string;
  endDate: string;
}): HealthMetricPayload[] {
  const { samplesByType, workouts = [], startDate, endDate } = input;
  const metrics: HealthMetricPayload[] = [];
  const today = todayKey();

  const stepDays = sumByDay(samplesByType.steps ?? []);
  const todaySteps = stepDays.get(today) ?? 0;
  if (todaySteps > 0) {
    metrics.push({
      source: "health_connect",
      metricType: "steps",
      value: todaySteps,
      unit: "steps",
      periodStart: startOfTodayIso(),
      periodEnd: endDate,
      externalId: `steps-${today}`,
    });
  }

  const hrDays = avgByDay(samplesByType.heartRate ?? []);
  const todayHr = hrDays.get(today);
  if (todayHr != null && todayHr > 0) {
    metrics.push({
      source: "health_connect",
      metricType: "heart_rate",
      value: Math.round(todayHr),
      unit: "bpm",
      periodStart: startOfTodayIso(),
      periodEnd: endDate,
      externalId: `heart_rate-${today}`,
    });
  }

  // Resting HR: prefer today's average; else most recent day in the window (overnight write).
  const rhrDays = avgByDay(samplesByType.restingHeartRate ?? []);
  let rhrDay = today;
  let rhrVal = rhrDays.get(today);
  if (rhrVal == null) {
    const keys = [...rhrDays.keys()].sort();
    const last = keys[keys.length - 1];
    if (last) {
      rhrDay = last;
      rhrVal = rhrDays.get(last);
    }
  }
  if (rhrVal != null && rhrVal > 0) {
    metrics.push({
      source: "health_connect",
      metricType: "resting_hr",
      value: Math.round(rhrVal),
      unit: "bpm",
      periodStart: startDate,
      periodEnd: endDate,
      externalId: `resting_hr-${rhrDay}`,
    });
  }

  // Sleep: richest single civil night (exclude awake / in-bed).
  const sleepByDay = new Map<string, number>();
  for (const s of samplesByType.sleep ?? []) {
    const state = String(s.sleepState ?? "").toLowerCase();
    if (state && /awake|in.?bed|out.?of.?bed/.test(state)) continue;
    let minutes = Number(s.value) || 0;
    if (minutes <= 0) {
      const a = Date.parse(s.startDate);
      const b = Date.parse(s.endDate ?? s.startDate);
      if (Number.isFinite(a) && Number.isFinite(b) && b > a) minutes = (b - a) / 60_000;
    }
    if (minutes <= 0) continue;
    const key = civilDayKeyFromIso(s.endDate ?? s.startDate);
    sleepByDay.set(key, (sleepByDay.get(key) ?? 0) + minutes);
  }
  let bestSleepDay = "";
  let bestSleep = 0;
  for (const [key, mins] of sleepByDay) {
    if (mins > bestSleep) {
      bestSleep = mins;
      bestSleepDay = key;
    }
  }
  if (bestSleep > 0) {
    metrics.push({
      source: "health_connect",
      metricType: "sleep_minutes",
      value: Math.round(bestSleep),
      unit: "minutes",
      periodStart: startDate,
      periodEnd: endDate,
      externalId: `sleep-${bestSleepDay}`,
    });
  }

  // Active minutes from workout sessions (Samsung exercise → HC → Capgo queryWorkouts).
  let activeMinutes = 0;
  for (const w of workouts) {
    const key = civilDayKeyFromIso(w.endDate ?? w.startDate);
    if (key !== today) continue;
    const seconds = Number(w.duration) || 0;
    if (seconds > 0) activeMinutes += seconds / 60;
  }

  // Fallback: estimate from today's active calories when Samsung shared energy but not sessions.
  if (activeMinutes <= 0) {
    const calDays = sumByDay(samplesByType.calories ?? []);
    const kcal = calDays.get(today) ?? 0;
    if (kcal >= 35) {
      // ~7 kcal/min moderate activity heuristic — wellness estimate only.
      activeMinutes = Math.min(180, Math.round(kcal / 7));
    }
  }

  if (activeMinutes > 0) {
    metrics.push({
      source: "health_connect",
      metricType: "active_minutes",
      value: Math.round(activeMinutes),
      unit: "minutes",
      periodStart: startOfTodayIso(),
      periodEnd: endDate,
      externalId: `active_minutes-${today}`,
    });
  }

  return metrics;
}

async function uploadMetrics(metrics: HealthMetricPayload[]): Promise<HealthConnectSyncResult> {
  if (metrics.length === 0) {
    return {
      ok: false,
      error:
        "No health data found. On Samsung: Samsung Health → Settings → Health Connect → allow steps, sleep, heart rate, and exercises, then open the MotiveLife app and Sync.",
    };
  }

  const res = await fetch("/api/health/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ metrics }),
  });

  const data = (await res.json()) as { error?: string; count?: number };
  if (!res.ok) {
    return { ok: false, error: data.error ?? "Upload failed." };
  }

  return { ok: true, count: data.count ?? metrics.length };
}

/** Expo / RN WebView bridge — native shell reads phone health and returns metrics. */
function syncViaReactNativeShell(): Promise<HealthConnectSyncResult> {
  const w = getReactNativeWebView();
  if (!w?.ReactNativeWebView?.postMessage) {
    return Promise.resolve({
      ok: false,
      error: "Phone health sync is available in the MotiveLife mobile app on supported devices.",
    });
  }

  if (!w.__MOTIVELIFE_NATIVE_HEALTH__) {
    const ios = w.__MOTIVELIFE_NATIVE_PLATFORM__ === "ios";
    return Promise.resolve({
      ok: false,
      error: ios
        ? "Update MotiveLife to the latest App Store build with Apple Health support, then try Sync again."
        : "Update MotiveLife to a build with phone health support, then try Sync again.",
    });
  }

  return new Promise((resolve) => {
    const requestId = `hc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timeout = window.setTimeout(() => {
      window.removeEventListener("motivelife-health", onEvent as EventListener);
      resolve({
        ok: false,
        error: "Phone health sync timed out. Check permissions and try again.",
      });
    }, 90_000);

    function onEvent(ev: Event) {
      const detail = (ev as CustomEvent).detail as {
        requestId?: string;
        ok?: boolean;
        error?: string;
        metrics?: HealthMetricPayload[];
      };
      if (!detail || detail.requestId !== requestId) return;
      window.clearTimeout(timeout);
      window.removeEventListener("motivelife-health", onEvent as EventListener);
      if (!detail.ok) {
        resolve({ ok: false, error: detail.error ?? "Phone health sync failed." });
        return;
      }
      void uploadMetrics(detail.metrics ?? []).then(resolve);
    }

    window.addEventListener("motivelife-health", onEvent as EventListener);
    w.ReactNativeWebView!.postMessage(
      JSON.stringify({
        type: "health_connect_sync",
        requestId,
        startDate: startOfYesterdayIso(),
        endDate: new Date().toISOString(),
      }),
    );
  });
}

async function requestCapgoAuth(Health: CapHealthPlugin, types: readonly string[]) {
  await Health.requestAuthorization?.({ read: [...types] });
}

async function syncViaCapacitor(): Promise<HealthConnectSyncResult | null> {
  const cap = getCapacitor();
  if (!cap?.isNativePlatform?.()) return null;

  if (cap.getPlatform?.() !== "android") {
    return {
      ok: false,
      error:
        "Use the MotiveLife iOS app for Apple Health / Apple Watch sync, or connect Fitbit on the web.",
    };
  }

  const Health = cap.Plugins?.Health;
  if (!Health?.readSamples) {
    return {
      ok: false,
      error: "Install the latest MotiveLife build with phone health support.",
    };
  }

  try {
    const availability = await Health.isAvailable?.();
    if (availability && !availability.available) {
      try {
        await Health.openHealthConnectSettings?.();
      } catch {
        // optional
      }
      return {
        ok: false,
        error:
          availability.reason ??
          "Health Connect is not available. Install/update Health Connect, then try again.",
      };
    }
  } catch {
    // Older plugin builds may not expose isAvailable
  }

  let readTypes: readonly string[] = CAPGO_READ_FULL;
  try {
    await requestCapgoAuth(Health, CAPGO_READ_FULL);
  } catch {
    try {
      readTypes = CAPGO_READ_FALLBACK;
      await requestCapgoAuth(Health, CAPGO_READ_FALLBACK);
    } catch {
      return {
        ok: false,
        error:
          "Health Connect permission denied. Allow MotiveLife to read steps, sleep, heart rate, and exercise.",
      };
    }
  }

  const startDate = startOfYesterdayIso();
  const endDate = new Date().toISOString();
  const samplesByType: Record<string, CapHealthSample[]> = {};

  for (const dataType of readTypes) {
    if (dataType === "workouts") continue; // handled via queryWorkouts
    try {
      const result = await Health.readSamples!({
        dataType,
        startDate,
        endDate,
        limit: 500,
      });
      samplesByType[dataType] = (result.samples ?? []).map((s) => ({
        ...s,
        dataType: s.dataType || dataType,
      }));
    } catch {
      samplesByType[dataType] = [];
    }
  }

  let workouts: CapWorkout[] = [];
  if (readTypes.includes("workouts") && Health.queryWorkouts) {
    try {
      const result = await Health.queryWorkouts({
        startDate,
        endDate,
        limit: 100,
      });
      workouts = result.workouts ?? [];
    } catch {
      workouts = [];
    }
  }

  const metrics = metricsFromCapgoSamples({
    samplesByType,
    workouts,
    startDate,
    endDate,
  });

  if (metrics.length === 0) {
    try {
      await Health.openHealthConnectSettings?.();
    } catch {
      // optional
    }
  }

  return uploadMetrics(metrics);
}

export async function syncHealthConnectFromDevice(): Promise<HealthConnectSyncResult> {
  try {
    const capResult = await syncViaCapacitor();
    if (capResult) return capResult;
    return await syncViaReactNativeShell();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Phone health sync failed.",
    };
  }
}
