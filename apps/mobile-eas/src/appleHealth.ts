import { Platform } from "react-native";
import {
  isHealthDataAvailableAsync,
  queryCategorySamples,
  queryStatisticsForQuantity,
  queryQuantitySamples,
  requestAuthorization,
} from "@kingstinct/react-native-healthkit";
import { CategoryValueSleepAnalysis } from "@kingstinct/react-native-healthkit/types";
import type { PhoneHealthMetricPayload, PhoneHealthNativeResult } from "./healthMetrics";

const READ_TYPES = [
  "HKQuantityTypeIdentifierStepCount",
  "HKQuantityTypeIdentifierRestingHeartRate",
  "HKQuantityTypeIdentifierHeartRate",
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

function localDayKey(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function lowestRestingFromHeartSamples(samples: { quantity: number }[]): number {
  const values = samples.map((s) => s.quantity).filter((b) => b > 30 && b < 220).sort((a, b) => a - b);
  if (values.length >= 5) {
    return Math.round(values[Math.floor(values.length * 0.1)]!);
  }
  if (values.length > 0) return Math.round(Math.min(...values));
  return 0;
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

    await requestAuthorization({
      toRead: [...READ_TYPES],
    });

    const start = new Date(opts.startDate);
    const end = new Date(opts.endDate);
    const day = localDayKey(opts.startDate);
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
      /* optional type */
    }

    let restingBpm = 0;
    try {
      const hrStats = await queryStatisticsForQuantity(
        "HKQuantityTypeIdentifierRestingHeartRate",
        ["discreteAverage", "discreteMin"],
        { filter: { date: { startDate: start, endDate: end } } }
      );
      restingBpm = Math.round(
        hrStats.discreteMin?.quantity ?? hrStats.averageQuantity?.quantity ?? 0
      );
    } catch {
      /* optional type */
    }
    if (restingBpm <= 0) {
      try {
        const hrStats = await queryStatisticsForQuantity(
          "HKQuantityTypeIdentifierHeartRate",
          ["discreteMin"],
          { filter: { date: { startDate: start, endDate: end } } }
        );
        restingBpm = Math.round(hrStats.discreteMin?.quantity ?? 0);
      } catch {
        /* optional */
      }
    }
    if (restingBpm <= 0) {
      try {
        const samples = await queryQuantitySamples("HKQuantityTypeIdentifierHeartRate", {
          filter: { date: { startDate: start, endDate: end } },
          limit: 500,
        });
        restingBpm = lowestRestingFromHeartSamples(
          samples.map((s) => ({ quantity: s.quantity }))
        );
      } catch {
        /* optional */
      }
    }
    if (restingBpm > 0) {
      metrics.push({
        source: "apple_health",
        metricType: "resting_hr",
        value: restingBpm,
        unit: "bpm",
        periodStart: opts.startDate,
        periodEnd: opts.endDate,
        externalId: `resting_hr-${day}`,
      });
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
      /* optional type */
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
      /* optional type */
    }

    if (metrics.length === 0) {
      return {
        ok: false,
        error:
          "No Apple Health data found for today. Pair your Apple Watch, confirm Health is sharing steps/sleep/heart rate, then try again.",
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
