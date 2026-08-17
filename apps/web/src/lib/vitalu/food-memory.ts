import type {
  VitaluFoodItem,
  VitaluFoodMemory,
  VitaluMealSlot,
  VitaluSavedMeal,
  VitaluUsualMeal,
} from "@forward/shared";
import { VITALU_MEAL_SLOT_LABELS, VITALU_MEAL_SLOTS } from "@forward/shared";
import { prisma } from "@forward/database";
import { getVitaluFood } from "@/lib/vitalu/food-catalog";

type LogRow = {
  catalogId: string | null;
  title: string;
  mealSlot: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  waterMl: number;
  eatenAt: Date;
};

function asItem(row: LogRow): VitaluFoodItem {
  const catalog = row.catalogId ? getVitaluFood(row.catalogId, row.grams) : null;
  if (catalog) return catalog;
  return {
    id: row.catalogId ?? row.title.toLowerCase().replace(/\s+/g, "-"),
    name: row.title,
    servingLabel: `${Math.round(row.grams)} g`,
    grams: row.grams,
    kcal: row.kcal,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
    fiberG: row.fiberG,
    waterMl: row.waterMl,
  };
}

function signature(rows: LogRow[]) {
  return rows
    .map((r) => r.catalogId ?? r.title)
    .sort()
    .join("|");
}

function emptyMemory(): VitaluFoodMemory {
  return { recent: [], favorites: [], saved: [], usual: {} };
}

export async function loadVitaluFoodMemory(userId: string): Promise<VitaluFoodMemory> {
  try {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 14);

    const [logs, savedRows] = await Promise.all([
      prisma.vitaluFoodLog.findMany({
        where: { userId, eatenAt: { gte: since } },
        orderBy: { eatenAt: "desc" },
        take: 200,
      }),
      prisma.vitaluSavedMeal.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
    ]);

    const recentMap = new Map<string, VitaluFoodItem>();
    const counts = new Map<string, { n: number; row: LogRow }>();
    for (const row of logs) {
      if (row.catalogId === "water-250") continue;
      const item = asItem(row);
      if (!recentMap.has(item.id)) recentMap.set(item.id, item);
      const prev = counts.get(item.id);
      counts.set(item.id, { n: (prev?.n ?? 0) + 1, row });
    }

    const favorites = [...counts.entries()]
      .filter(([, v]) => v.n >= 2)
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 8)
      .map(([, v]) => asItem(v.row));

    const byDaySlot = new Map<string, LogRow[]>();
    for (const row of logs) {
      if (row.catalogId === "water-250") continue;
      const key = `${row.eatenAt.toISOString().slice(0, 10)}:${row.mealSlot}`;
      const list = byDaySlot.get(key) ?? [];
      list.push(row);
      byDaySlot.set(key, list);
    }
    const usual: VitaluFoodMemory["usual"] = {};
    for (const slot of VITALU_MEAL_SLOTS) {
      const sigCount = new Map<string, { n: number; rows: LogRow[] }>();
      for (const [key, rows] of byDaySlot) {
        if (!key.endsWith(`:${slot}`) || rows.length === 0) continue;
        const sig = signature(rows);
        const prev = sigCount.get(sig);
        sigCount.set(sig, { n: (prev?.n ?? 0) + 1, rows: prev?.rows ?? rows });
      }
      const best = [...sigCount.values()].sort((a, b) => b.n - a.n)[0];
      if (best && best.n >= 2) {
        const items = best.rows.map(asItem);
        usual[slot] = {
          label: `Usual ${VITALU_MEAL_SLOT_LABELS[slot].toLowerCase()}`,
          mealSlot: slot,
          items,
          kcal: items.reduce((s, i) => s + i.kcal, 0),
        } satisfies VitaluUsualMeal;
      }
    }

    const saved: VitaluSavedMeal[] = savedRows.map((row) => {
      let items: VitaluFoodItem[] = [];
      try {
        items = JSON.parse(row.itemsJson) as VitaluFoodItem[];
      } catch {
        items = [];
      }
      return {
        id: row.id,
        title: row.title,
        mealSlot: row.mealSlot as VitaluMealSlot,
        items,
        kcal: items.reduce((s, i) => s + i.kcal, 0),
      };
    });

    return {
      recent: [...recentMap.values()].slice(0, 8),
      favorites,
      saved,
      usual,
    };
  } catch (error) {
    console.warn("[vitalu food memory]", error);
    return emptyMemory();
  }
}
