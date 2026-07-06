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
}) {
  const periodStart = sample.startDate;
  const periodEnd = sample.endDate ?? sample.startDate;
  const externalId = `${sample.dataType}-${periodStart.slice(0, 10)}`;

  if (/step/i.test(sample.dataType)) {
    return {
      source: "health_connect" as const,
      metricType: "steps" as const,
      value: sample.value,
      unit: "steps",
      periodStart,
      periodEnd,
      externalId,
    };
  }
  if (/sleep/i.test(sample.dataType)) {
    return {
      source: "health_connect" as const,
      metricType: "sleep_minutes" as const,
      value: sample.value,
      unit: "minutes",
      periodStart,
      periodEnd,
      externalId,
    };
  }
  if (/heart|hr|resting/i.test(sample.dataType)) {
    return {
      source: "health_connect" as const,
      metricType: "resting_hr" as const,
      value: sample.value,
      unit: "bpm",
      periodStart,
      periodEnd,
      externalId,
    };
  }
  if (/active|exercise|workout/i.test(sample.dataType)) {
    return {
      source: "health_connect" as const,
      metricType: "active_minutes" as const,
      value: sample.value,
      unit: "minutes",
      periodStart,
      periodEnd,
      externalId,
    };
  }
  return null;
}

export async function syncHealthConnectFromDevice(): Promise<HealthConnectSyncResult> {
  const cap = getCapacitor();
  if (!cap?.isNativePlatform?.()) {
    return {
      ok: false,
      error: "Health Connect sync works in the MotiveLife Android app — not in the browser.",
    };
  }

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

  const metrics = samples.map(mapSampleToMetric).filter((m): m is NonNullable<typeof m> => m != null);
  if (metrics.length === 0) {
    return { ok: false, error: "No health data found for today. Check Samsung Health → Health Connect sharing." };
  }

  const res = await fetch("/api/health/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metrics }),
  });

  const data = (await res.json()) as { error?: string; count?: number };
  if (!res.ok) {
    return { ok: false, error: data.error ?? "Upload failed." };
  }

  return { ok: true, count: data.count ?? metrics.length };
}
