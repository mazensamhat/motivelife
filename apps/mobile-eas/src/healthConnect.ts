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

import type { PhoneHealthMetricPayload, PhoneHealthNativeResult } from "./healthMetrics";

export type { PhoneHealthMetricPayload, PhoneHealthNativeResult };

export type HealthMetricPayload = PhoneHealthMetricPayload;
export type HealthConnectNativeResult = PhoneHealthNativeResult;

/** Sync types we read — HeartRate is fallback when RestingHeartRate is empty (Samsung / Google Fit). */
const READ_PERMISSIONS = [
  { accessType: "read" as const, recordType: "Steps" as const },
  { accessType: "read" as const, recordType: "SleepSession" as const },
  { accessType: "read" as const, recordType: "RestingHeartRate" as const },
  { accessType: "read" as const, recordType: "HeartRate" as const },
  { accessType: "read" as const, recordType: "ExerciseSession" as const },
];

function localDayKey(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pushMetric(
  metrics: HealthMetricPayload[],
  existing: HealthMetricPayload | null,
  next: HealthMetricPayload
) {
  if (!existing) {
    metrics.push(next);
    return;
  }
  const idx = metrics.findIndex(
    (m) => m.metricType === next.metricType && m.externalId === next.externalId
  );
  if (idx >= 0) {
    if (next.metricType === "resting_hr") {
      metrics[idx] = next.value < metrics[idx]!.value ? next : metrics[idx]!;
    } else {
      metrics[idx] = next.value > metrics[idx]!.value ? next : metrics[idx]!;
    }
  } else {
    metrics.push(next);
  }
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
        error: "Health Connect permission denied. Allow MotiveLife to read steps, sleep, and heart rate.",
      };
    }

    const timeRangeFilter = {
      operator: "between" as const,
      startTime: opts.startDate,
      endTime: opts.endDate,
    };
    const metrics: HealthMetricPayload[] = [];
    const day = localDayKey(opts.startDate);

    // Steps — prefer max of aggregate vs summed records (Samsung sometimes lags aggregate).
    let stepsValue = 0;
    try {
      const stepsAgg = await aggregateRecord({
        recordType: "Steps",
        timeRangeFilter,
      });
      stepsValue = Number(stepsAgg.COUNT_TOTAL ?? 0);
    } catch {
      /* optional */
    }
    try {
      const stepsRec = await readRecords("Steps", { timeRangeFilter });
      let sum = 0;
      for (const rec of stepsRec.records ?? []) {
        sum += Number(rec.count ?? 0);
      }
      stepsValue = Math.max(stepsValue, sum);
    } catch {
      /* optional */
    }
    if (stepsValue > 0) {
      pushMetric(metrics, null, {
        source: "health_connect",
        metricType: "steps",
        value: Math.round(stepsValue),
        unit: "steps",
        periodStart: opts.startDate,
        periodEnd: opts.endDate,
        externalId: `steps-${day}`,
      });
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
        pushMetric(metrics, null, {
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
      /* optional */
    }

    // Resting HR — RestingHeartRate first, then HeartRate minimum (overnight proxy).
    let restingBpm = 0;
    try {
      const hrAgg = await aggregateRecord({
        recordType: "RestingHeartRate",
        timeRangeFilter,
      });
      restingBpm = Number(hrAgg.BPM_AVG ?? hrAgg.BPM_MIN ?? 0);
    } catch {
      /* optional */
    }
    if (restingBpm <= 0) {
      try {
        const hrAgg = await aggregateRecord({
          recordType: "HeartRate",
          timeRangeFilter,
        });
        const min = Number(hrAgg.BPM_MIN ?? 0);
        const avg = Number(hrAgg.BPM_AVG ?? 0);
        restingBpm = min > 0 ? min : avg;
      } catch {
        /* optional */
      }
    }
    if (restingBpm <= 0) {
      try {
        const restingRec = await readRecords("RestingHeartRate", { timeRangeFilter });
        const samples = (restingRec.records ?? [])
          .map((r) => Number(r.beatsPerMinute))
          .filter((b) => b > 30 && b < 220);
        if (samples.length > 0) {
          restingBpm = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
        }
      } catch {
        /* optional */
      }
    }
    if (restingBpm <= 0) {
      try {
        const hrRec = await readRecords("HeartRate", { timeRangeFilter, ascendingOrder: false });
        const samples: number[] = [];
        for (const rec of hrRec.records ?? []) {
          for (const s of rec.samples ?? []) {
            const bpm = Number(s.beatsPerMinute);
            if (bpm > 30 && bpm < 220) samples.push(bpm);
          }
        }
        samples.sort((a, b) => a - b);
        if (samples.length >= 3) {
          restingBpm = samples[Math.floor(samples.length * 0.1)]!;
        } else if (samples.length > 0) {
          restingBpm = samples[0]!;
        }
      } catch {
        /* optional */
      }
    }
    if (restingBpm > 0) {
      pushMetric(metrics, null, {
        source: "health_connect",
        metricType: "resting_hr",
        value: Math.round(restingBpm),
        unit: "bpm",
        periodStart: opts.startDate,
        periodEnd: opts.endDate,
        externalId: `resting_hr-${day}`,
      });
    }

    // Active minutes — exercise sessions + active-calorie heuristic when sessions are sparse.
    let activeMinutes = 0;
    try {
      const exerciseAgg = await aggregateRecord({
        recordType: "ExerciseSession",
        timeRangeFilter,
      });
      const seconds = Number(exerciseAgg.EXERCISE_DURATION_TOTAL?.inSeconds ?? 0);
      activeMinutes = Math.round(seconds / 60);
    } catch {
      /* optional */
    }
    if (activeMinutes <= 0) {
      try {
        const sessions = await readRecords("ExerciseSession", { timeRangeFilter });
        let seconds = 0;
        for (const rec of sessions.records ?? []) {
          const start = new Date(rec.startTime).getTime();
          const end = new Date(rec.endTime).getTime();
          if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
            seconds += (end - start) / 1000;
          }
        }
        activeMinutes = Math.round(seconds / 60);
      } catch {
        /* optional */
      }
    }
    if (activeMinutes > 0) {
      pushMetric(metrics, null, {
        source: "health_connect",
        metricType: "active_minutes",
        value: activeMinutes,
        unit: "minutes",
        periodStart: opts.startDate,
        periodEnd: opts.endDate,
        externalId: `active_minutes-${day}`,
      });
    }

    if (metrics.length === 0) {
      return {
        ok: false,
        error:
          "No health data found for today. In Samsung Health / Google Fit, share steps, heart rate, and workouts with Health Connect, then try again.",
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
