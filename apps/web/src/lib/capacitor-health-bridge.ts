export type HealthConnectSyncResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

type CapHealthSample = {
  dataType: string;
  value: number;
  startDate: string;
  endDate?: string;
};

type CapHealthPlugin = {
  isAvailable?: () => Promise<{ available: boolean; reason?: string }>;
  requestAuthorization?: (opts: { read: string[]; write?: string[] }) => Promise<void>;
  /** Capgo API: one dataType per call */
  readSamples?: (opts: {
    dataType: string;
    startDate: string;
    endDate: string;
    limit?: number;
  }) => Promise<{ samples: CapHealthSample[] }>;
};

type HealthMetricPayload = {
  source: "health_connect";
  metricType: "steps" | "sleep_minutes" | "resting_hr" | "active_minutes";
  value: number;
  unit: string;
  periodStart: string;
  periodEnd: string;
  externalId: string;
};

/** Capgo @capgo/capacitor-health v7 data types available on Android. */
const CAPGO_READ_TYPES = ["steps", "heartRate", "calories"] as const;

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
  };
  return w;
}

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function mapSampleToMetric(sample: CapHealthSample): HealthMetricPayload | null {
  const periodStart = sample.startDate;
  const periodEnd = sample.endDate ?? sample.startDate;
  const day = dayKey(periodStart);

  if (/step/i.test(sample.dataType)) {
    return {
      source: "health_connect",
      metricType: "steps",
      value: sample.value,
      unit: "steps",
      periodStart,
      periodEnd,
      externalId: `steps-${day}`,
    };
  }
  if (/sleep/i.test(sample.dataType)) {
    return {
      source: "health_connect",
      metricType: "sleep_minutes",
      value: sample.value,
      unit: "minutes",
      periodStart,
      periodEnd,
      externalId: `sleep-${day}`,
    };
  }
  if (/restingHeartRate|heartRate|heart|hr/i.test(sample.dataType)) {
    return {
      source: "health_connect",
      metricType: "resting_hr",
      value: sample.value,
      unit: "bpm",
      periodStart,
      periodEnd,
      externalId: `resting_hr-${day}`,
    };
  }
  // Capgo "calories" is active energy — skip mapping to active_minutes (wrong unit).
  return null;
}

function aggregateSamples(
  dataType: string,
  samples: CapHealthSample[],
  startDate: string,
  endDate: string,
): HealthMetricPayload | null {
  if (samples.length === 0) return null;
  const day = dayKey(startDate);

  if (dataType === "steps") {
    const total = samples.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
    if (total <= 0) return null;
    return {
      source: "health_connect",
      metricType: "steps",
      value: total,
      unit: "steps",
      periodStart: startDate,
      periodEnd: endDate,
      externalId: `steps-${day}`,
    };
  }

  if (dataType === "heartRate") {
    const values = samples.map((s) => Number(s.value)).filter((n) => n > 0);
    if (values.length === 0) return null;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return {
      source: "health_connect",
      metricType: "resting_hr",
      value: Math.round(avg),
      unit: "bpm",
      periodStart: startDate,
      periodEnd: endDate,
      externalId: `resting_hr-${day}`,
    };
  }

  // Prefer first mappable sample for other types
  for (const sample of samples) {
    const mapped = mapSampleToMetric({ ...sample, dataType });
    if (mapped) return mapped;
  }
  return null;
}

async function uploadMetrics(metrics: HealthMetricPayload[]): Promise<HealthConnectSyncResult> {
  if (metrics.length === 0) {
    return {
      ok: false,
      error: "No health data found for today. Check Samsung Health → Health Connect sharing.",
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

/** Expo / RN WebView bridge — native shell reads Health Connect and returns metrics. */
function syncViaReactNativeShell(): Promise<HealthConnectSyncResult> {
  const w = getReactNativeWebView();
  if (!w?.ReactNativeWebView?.postMessage) {
    return Promise.resolve({
      ok: false,
      error: "Health Connect sync works in the MotiveLife Android app — not in the browser.",
    });
  }

  if (!w.__MOTIVELIFE_NATIVE_HEALTH__) {
    return Promise.resolve({
      ok: false,
      error:
        "Update MotiveLife on Play Store to a build with Health Connect support, then try Sync again.",
    });
  }

  return new Promise((resolve) => {
    const requestId = `hc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timeout = window.setTimeout(() => {
      window.removeEventListener("motivelife-health", onEvent as EventListener);
      resolve({
        ok: false,
        error: "Health Connect timed out. Open Health Connect permissions and try again.",
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
        resolve({ ok: false, error: detail.error ?? "Health Connect sync failed." });
        return;
      }
      void uploadMetrics(detail.metrics ?? []).then(resolve);
    }

    window.addEventListener("motivelife-health", onEvent as EventListener);
    w.ReactNativeWebView!.postMessage(
      JSON.stringify({
        type: "health_connect_sync",
        requestId,
        startDate: startOfTodayIso(),
        endDate: new Date().toISOString(),
      }),
    );
  });
}

async function syncViaCapacitor(): Promise<HealthConnectSyncResult | null> {
  const cap = getCapacitor();
  if (!cap?.isNativePlatform?.()) return null;

  if (cap.getPlatform?.() !== "android") {
    return {
      ok: false,
      error: "Health Connect is Android-only. Apple Health sync is planned for the iOS app.",
    };
  }

  const Health = cap.Plugins?.Health;
  if (!Health?.readSamples) {
    return {
      ok: false,
      error: "Install the latest MotiveLife Android build with Health Connect support.",
    };
  }

  try {
    const availability = await Health.isAvailable?.();
    if (availability && !availability.available) {
      return {
        ok: false,
        error:
          availability.reason ??
          "Health Connect is not available. Install Health Connect from the Play Store.",
      };
    }
  } catch {
    // Older plugin builds may not expose isAvailable
  }

  const read = [...CAPGO_READ_TYPES];
  try {
    await Health.requestAuthorization?.({ read });
  } catch {
    return { ok: false, error: "Health Connect permission denied." };
  }

  const startDate = startOfTodayIso();
  const endDate = new Date().toISOString();
  const metrics: HealthMetricPayload[] = [];

  for (const dataType of read) {
    try {
      const result = await Health.readSamples!({
        dataType,
        startDate,
        endDate,
        limit: 200,
      });
      const samples = (result.samples ?? []).map((s) => ({
        ...s,
        dataType: s.dataType || dataType,
      }));
      const metric = aggregateSamples(dataType, samples, startDate, endDate);
      if (metric) metrics.push(metric);
    } catch {
      // Permission or empty type — continue
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
      error: e instanceof Error ? e.message : "Health Connect sync failed.",
    };
  }
}
