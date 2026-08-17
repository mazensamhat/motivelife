import { Platform } from "react-native";
import {
  isHealthDataAvailableAsync,
  queryCategorySamples,
  queryStatisticsForQuantity,
  requestAuthorization,
} from "@kingstinct/react-native-healthkit";
import { CategoryValueSleepAnalysis } from "@kingstinct/react-native-healthkit/types";
import type { PhoneHealthMetricPayload, PhoneHealthNativeResult } from "./healthMetrics";

const READ_TYPES = [
  "HKQuantityTypeIdentifierStepCount",
  "HKQuantityTypeIdentifierRestingHeartRate",
  "HKQuantityTypeIdentifierAppleExerciseTime",
  "HKCategoryTypeIdentifierSleepAnalysis",
] as const;

const ASLEEP_VALUES = new Set<number>([
  CategoryValueSleepAnalysis.asleep,
  CategoryValueSleepAnalysis.asleepUnspecified,
  CategoryValueSleepAnalysis.asleepCore,
  CategoryValueSleepAnalysis.asleepDeep,
  CategoryValueSleepAnalysis.asleepREM,
]);

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export async function syncAppleHealthNative(opts: {
  startDate: string;
  endDate: string;
}): Promise<PhoneHealthNativeResult> {
  if (Platform.OS !== "ios") {
    return { ok: false, error: "Apple Health is iOS-only." };
  }

  try {
    const available = await isHealthDataAvailableAsync();
    if (!available) {
      return { ok: false, error: "Apple Health is not available on this device." };
    }

    const granted = await requestAuthorization({
      toRead: [...READ_TYPES],
    });
    if (!granted) {
      return {
        ok: false,
        error:
          "Apple Health permission denied. In Settings → Health → Data Access, allow MotiveLife to read steps, sleep, heart rate, and exercise.",
      };
    }

    const start = new Date(opts.startDate);
    const end = new Date(opts.endDate);
    const day = dayKey(opts.startDate);
    const metrics: PhoneHealthMetricPayload[] = [];

    try {
      const stepsStats = await queryStatisticsForQuantity(
        "HKQuantityTypeIdentifierStepCount",
        ["cumulativeSum"],
        { filter: { date: { startDate: start, endDate: end } } }
      );
      const steps = Math.round(stepsStats.sumQuantity?.quantity ?? 0);
      if (steps > 0) {
        metrics.push({
          source: "apple_health",
          metricType: "steps",
          value: steps,
          unit: "steps",
          periodStart: opts.startDate,
          periodEnd: opts.endDate,
          externalId: `steps-${day}`,
        });
      }
    } catch {
      // optional type
    }

    try {
      const hrStats = await queryStatisticsForQuantity(
        "HKQuantityTypeIdentifierRestingHeartRate",
        ["discreteAverage"],
        { filter: { date: { startDate: start, endDate: end } } }
      );
      const bpm = Math.round(hrStats.averageQuantity?.quantity ?? 0);
      if (bpm > 0) {
        metrics.push({
          source: "apple_health",
          metricType: "resting_hr",
          value: bpm,
          unit: "bpm",
          periodStart: opts.startDate,
          periodEnd: opts.endDate,
          externalId: `resting_hr-${day}`,
        });
      }
    } catch {
      // optional type
    }

    try {
      const exerciseStats = await queryStatisticsForQuantity(
        "HKQuantityTypeIdentifierAppleExerciseTime",
        ["cumulativeSum"],
        { filter: { date: { startDate: start, endDate: end } } }
      );
      const minutes = Math.round(exerciseStats.sumQuantity?.quantity ?? 0);
      if (minutes > 0) {
        metrics.push({
          source: "apple_health",
          metricType: "active_minutes",
          value: minutes,
          unit: "minutes",
          periodStart: opts.startDate,
          periodEnd: opts.endDate,
          externalId: `active_minutes-${day}`,
        });
      }
    } catch {
      // optional type
    }

    try {
      const sleepStart = new Date(start);
      sleepStart.setHours(sleepStart.getHours() - 14);
      const samples = await queryCategorySamples("HKCategoryTypeIdentifierSleepAnalysis", {
        filter: { date: { startDate: sleepStart, endDate: end } },
        limit: -1,
      });
      let sleepMinutes = 0;
      for (const sample of samples) {
        const value = sample.value as number;
        if (!ASLEEP_VALUES.has(value)) continue;
        const sampleStart = new Date(sample.startDate).getTime();
        const sampleEnd = new Date(sample.endDate).getTime();
        if (Number.isFinite(sampleStart) && Number.isFinite(sampleEnd) && sampleEnd > sampleStart) {
          sleepMinutes += (sampleEnd - sampleStart) / 60_000;
        }
      }
      if (sleepMinutes > 0) {
        metrics.push({
          source: "apple_health",
          metricType: "sleep_minutes",
          value: Math.round(sleepMinutes),
          unit: "minutes",
          periodStart: opts.startDate,
          periodEnd: opts.endDate,
          externalId: `sleep-${day}`,
        });
      }
    } catch {
      // optional type
    }

    if (metrics.length === 0) {
      return {
        ok: false,
        error:
          "No Apple Health data found for today. Pair your Apple Watch, confirm Health is sharing steps/sleep, then try again.",
      };
    }

    return { ok: true, metrics };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Apple Health sync failed.",
    };
  }
}
