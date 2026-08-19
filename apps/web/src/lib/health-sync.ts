import { prisma } from "@forward/database";
import {
  fetchHealthMetricsForMerge,
  mergeDailyHealthMetrics,
  startOfHealthDay,
  type HealthMetricRow,
} from "@/lib/health-correlation";

export type HealthMetricInput = {
  source: string;
  metricType: string;
  value: number;
  unit: string;
  periodStart: string;
  periodEnd?: string | null;
  externalId?: string | null;
};

export type HealthSyncSummary = {
  steps: number | null;
  sleepMinutes: number | null;
  restingHr: number | null;
  activeMinutes: number | null;
  lastSyncedAt: string | null;
  sources: string[];
  /** Per-signal source labels after correlation merge */
  provenance: {
    steps: string[];
    sleep: string[];
    active: string[];
    restingHr: string[];
  };
  connectedSources: string[];
};

function startOfToday() {
  return startOfHealthDay();
}

function mergedFromRows(rows: HealthMetricRow[], timeZone?: string) {
  return mergeDailyHealthMetrics(rows, startOfToday(), timeZone);
}

export async function upsertHealthMetrics(
  userId: string,
  metrics: HealthMetricInput[],
  timeZone?: string
) {
  let count = 0;
  for (const m of metrics) {
    if (!Number.isFinite(m.value)) continue;
    const periodStart = new Date(m.periodStart);
    const externalId = m.externalId ?? `${m.metricType}-${periodStart.toISOString().slice(0, 10)}`;
    await prisma.healthMetric.upsert({
      where: {
        userId_source_metricType_periodStart_externalId: {
          userId,
          source: m.source,
          metricType: m.metricType,
          periodStart,
          externalId,
        },
      },
      create: {
        userId,
        source: m.source,
        metricType: m.metricType,
        value: m.value,
        unit: m.unit,
        periodStart,
        periodEnd: m.periodEnd ? new Date(m.periodEnd) : null,
        externalId,
      },
      update: {
        value: m.value,
        unit: m.unit,
        periodEnd: m.periodEnd ? new Date(m.periodEnd) : null,
      },
    });
    count += 1;
  }
  await rollupHealthMetricsToItems(userId, timeZone);
  return count;
}

export async function rollupHealthMetricsToItems(userId: string, timeZone?: string) {
  const since = startOfToday();
  const rows = await fetchHealthMetricsForMerge(userId, since);
  const merged = mergedFromRows(rows, timeZone);

  const steps = merged.steps?.value ?? null;
  const sleepMinutes = merged.sleepMinutes?.value ?? null;
  const activeMinutes = merged.activeMinutes?.value ?? null;

  const profile = await prisma.healthProfile.findUnique({
    where: { userId },
    select: { stepsTarget: true },
  });
  const stepsTarget = profile?.stepsTarget ?? 10000;

  const items = await prisma.healthItem.findMany({ where: { userId } });

  for (const item of items) {
    let next: number | null = null;
    if (item.type === "FITNESS" && steps != null && /step/i.test(item.title)) {
      next = steps;
    } else if (item.type === "FITNESS" && activeMinutes != null && /active|workout|exercise/i.test(item.title)) {
      next = activeMinutes;
    } else if (item.type === "SLEEP" && sleepMinutes != null) {
      next = Math.round((sleepMinutes / 60) * 10) / 10;
    }
    if (next != null && next !== item.currentValue) {
      await prisma.healthItem.update({
        where: { id: item.id },
        data: { currentValue: next },
      });
    }
  }

  if (steps != null && !items.some((i) => i.type === "FITNESS" && /step/i.test(i.title))) {
    await prisma.healthItem.create({
      data: {
        userId,
        type: "FITNESS",
        title: "Daily steps",
        targetValue: stepsTarget,
        currentValue: steps,
        unit: "steps",
      },
    });
  }

  if (sleepMinutes != null && !items.some((i) => i.type === "SLEEP")) {
    await prisma.healthItem.create({
      data: {
        userId,
        type: "SLEEP",
        title: "Sleep",
        targetValue: 8,
        currentValue: Math.round((sleepMinutes / 60) * 10) / 10,
        unit: "hours",
      },
    });
  }

  if (merged.restingHr != null) {
    const hrItem = items.find((i) => i.type === "WELLNESS" && /resting|heart|hr/i.test(i.title));
    if (hrItem) {
      await prisma.healthItem.update({
        where: { id: hrItem.id },
        data: { currentValue: merged.restingHr.value },
      });
    } else {
      await prisma.healthItem.create({
        data: {
          userId,
          type: "WELLNESS",
          title: "Resting heart rate",
          targetValue: 65,
          currentValue: merged.restingHr.value,
          unit: "bpm",
        },
      });
    }
  }
}

export async function getHealthSyncSummary(userId: string, timeZone?: string): Promise<HealthSyncSummary> {
  const since = startOfToday();
  const rows = await fetchHealthMetricsForMerge(userId, since);
  const merged = mergedFromRows(rows, timeZone);
  const last = rows.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0];

  return {
    steps: merged.steps?.value ?? null,
    sleepMinutes: merged.sleepMinutes?.value ?? null,
    restingHr: merged.restingHr?.value ?? null,
    activeMinutes: merged.activeMinutes?.value ?? null,
    lastSyncedAt: last?.createdAt?.toISOString() ?? null,
    sources: merged.connectedSources,
    provenance: {
      steps: merged.steps?.sources ?? [],
      sleep: merged.sleepMinutes?.sources ?? [],
      active: merged.activeMinutes?.sources ?? [],
      restingHr: merged.restingHr?.sources ?? [],
    },
    connectedSources: merged.connectedSources,
  };
}
