export type HealthConnectSyncResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

type CapHealthPlugin = {
  requestAuthorization?: (opts: { read: string[] }) => Promise<void>;
  readSamples?: (opts: {
    dataTypes: string[];
    startDate: string;
    endDate: string;
  }) => Promise<{
    samples: Array<{
      dataType: string;
      value: number;
      startDate: string;
      endDate?: string;
    }>;
  }>;
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

function mapSampleToMetric(sample: {
  dataType: string;
  value: number;
  startDate: string;
  endDate?: string;
}): HealthMetricPayload | null {
  const periodStart = sample.startDate;
  const periodEnd = sample.endDate ?? sample.startDate;
  const externalId = `${sample.dataType}-${periodStart.slice(0, 10)}`;

  if (/step/i.test(sample.dataType)) {
    return {
      source: "health_connect",
      metricType: "steps",
      value: sample.value,
      unit: "steps",
      periodStart,
      periodEnd,
      externalId,
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
      externalId,
    };
  }
  if (/heart|hr|resting/i.test(sample.dataType)) {
    return {
      source: "health_connect",
      metricType: "resting_hr",
      value: sample.value,
      unit: "bpm",
      periodStart,
      periodEnd,
      externalId,
    };
  }
  if (/active|exercise|workout|calor/i.test(sample.dataType)) {
    return {
      source: "health_connect",
      metricType: "active_minutes",
      value: sample.value,
      unit: "minutes",
      periodStart,
      periodEnd,
      externalId,
    };
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

  const dataTypes = ["steps", "sleep", "restingHeartRate", "activeEnergyBurned"];
  try {
    await Health.requestAuthorization?.({ read: dataTypes });
  } catch {
    return { ok: false, error: "Health Connect permission denied." };
  }

  const startDate = startOfTodayIso();
  const endDate = new Date().toISOString();

  let samples: Array<{
    dataType: string;
    value: number;
    startDate: string;
    endDate?: string;
  }> = [];

  try {
    const result = await Health.readSamples({ dataTypes, startDate, endDate });
    samples = result.samples ?? [];
  } catch {
    return { ok: false, error: "Could not read Health Connect data." };
  }

  const metrics = samples.map(mapSampleToMetric).filter((m): m is HealthMetricPayload => m != null);
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
