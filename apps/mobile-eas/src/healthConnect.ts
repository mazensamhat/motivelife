import { Platform } from "react-native";
import {
  aggregateRecord,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from "react-native-health-connect";

export type HealthMetricPayload = {
  source: "health_connect";
  metricType: "steps" | "sleep_minutes" | "resting_hr" | "active_minutes";
  value: number;
  unit: string;
  periodStart: string;
  periodEnd: string;
  externalId: string;
};

export type HealthConnectNativeResult =
  | { ok: true; metrics: HealthMetricPayload[] }
  | { ok: false; error: string };

const READ_PERMISSIONS = [
  { accessType: "read" as const, recordType: "Steps" as const },
  { accessType: "read" as const, recordType: "SleepSession" as const },
  { accessType: "read" as const, recordType: "RestingHeartRate" as const },
  { accessType: "read" as const, recordType: "ExerciseSession" as const },
  { accessType: "read" as const, recordType: "ActiveCaloriesBurned" as const },
];

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export async function syncHealthConnectNative(opts: {
  startDate: string;
  endDate: string;
}): Promise<HealthConnectNativeResult> {
  if (Platform.OS !== "android") {
    return {
      ok: false,
      error: "Health Connect is Android-only. Apple Health sync is planned for iOS.",
    };
  }

  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
      return {
        ok: false,
        error: "Health Connect is not available on this device.",
      };
    }
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      openHealthConnectSettings();
      return {
        ok: false,
        error: "Update or install Health Connect, then try Sync again.",
      };
    }

    const ready = await initialize();
    if (!ready) {
      return { ok: false, error: "Could not initialize Health Connect." };
    }

    const granted = await requestPermission(READ_PERMISSIONS);
    if (!granted?.length) {
      return {
        ok: false,
        error: "Health Connect permission denied. Allow MotiveLife to read steps and sleep.",
      };
    }

    const timeRangeFilter = {
      operator: "between" as const,
      startTime: opts.startDate,
      endTime: opts.endDate,
    };
    const metrics: HealthMetricPayload[] = [];
    const day = dayKey(opts.startDate);

    try {
      const stepsAgg = await aggregateRecord({
        recordType: "Steps",
        timeRangeFilter,
      });
      const steps = Number(stepsAgg.COUNT_TOTAL ?? 0);
      if (steps > 0) {
        metrics.push({
          source: "health_connect",
          metricType: "steps",
          value: steps,
          unit: "steps",
          periodStart: opts.startDate,
          periodEnd: opts.endDate,
          externalId: `steps-${day}`,
        });
      }
    } catch {
      // permission may not include Steps
    }

    try {
      const sleep = await readRecords("SleepSession", { timeRangeFilter });
      let sleepMinutes = 0;
      for (const rec of sleep.records ?? []) {
        const start = new Date(rec.startTime).getTime();
        const end = new Date(rec.endTime).getTime();
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
          sleepMinutes += (end - start) / 60_000;
        }
      }
      if (sleepMinutes > 0) {
        metrics.push({
          source: "health_connect",
          metricType: "sleep_minutes",
          value: Math.round(sleepMinutes),
          unit: "minutes",
          periodStart: opts.startDate,
          periodEnd: opts.endDate,
          externalId: `sleep-${day}`,
        });
      }
    } catch {
      // optional
    }

    try {
      const hrAgg = await aggregateRecord({
        recordType: "RestingHeartRate",
        timeRangeFilter,
      });
      const bpm = Number(hrAgg.BPM_AVG ?? 0);
      if (bpm > 0) {
        metrics.push({
          source: "health_connect",
          metricType: "resting_hr",
          value: Math.round(bpm),
          unit: "bpm",
          periodStart: opts.startDate,
          periodEnd: opts.endDate,
          externalId: `resting_hr-${day}`,
        });
      }
    } catch {
      // optional
    }

    try {
      const exerciseAgg = await aggregateRecord({
        recordType: "ExerciseSession",
        timeRangeFilter,
      });
      const seconds = Number(exerciseAgg.EXERCISE_DURATION_TOTAL?.inSeconds ?? 0);
      if (seconds > 0) {
        metrics.push({
          source: "health_connect",
          metricType: "active_minutes",
          value: Math.round(seconds / 60),
          unit: "minutes",
          periodStart: opts.startDate,
          periodEnd: opts.endDate,
          externalId: `active_minutes-${day}`,
        });
      }
    } catch {
      // optional
    }

    if (metrics.length === 0) {
      return {
        ok: false,
        error:
          "No health data found for today. In Samsung Health / Google Fit, share steps and sleep with Health Connect, then try again.",
      };
    }

    return { ok: true, metrics };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Health Connect sync failed.",
    };
  }
}
