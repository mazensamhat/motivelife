import { z } from "zod";
import { prisma } from "@forward/database";
import { VITALU_MEAL_SLOT_LABELS, VITALU_MEAL_SLOTS, type VitaluFoodItem } from "@forward/shared";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { ensureVitaluSchema } from "@/lib/vitalu/ensure-schema";
import { loadVitaluToday } from "@/lib/vitalu/load";
import { getVitaluFood, parseTellVitalu, searchVitaluFoods } from "@/lib/vitalu/food-catalog";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const limitRaw = Number(new URL(request.url).searchParams.get("limit") ?? "24");
    const limit = Number.isFinite(limitRaw) ? Math.min(48, Math.max(8, limitRaw)) : 24;
    return json({ foods: searchVitaluFoods(q, limit) });
  } catch (error) {
    console.error("[api/vitalu/foods]", error);
    return serverError("Food search unavailable.");
  }
}

const postSchema = z.object({
  catalogId: z.string().optional(),
  grams: z.number().positive().max(2000).optional(),
  mealSlot: z.enum(VITALU_MEAL_SLOTS).optional(),
  tell: z.string().max(400).optional(),
  copyYesterday: z.boolean().optional(),
  waterMl: z.number().int().positive().max(2000).optional(),
  saveMeal: z.boolean().optional(),
  savedMealId: z.string().optional(),
  usualSlot: z.enum(VITALU_MEAL_SLOTS).optional(),
});

const deleteSchema = z.object({
  id: z.string().optional(),
  savedMealId: z.string().optional(),
});

async function logItems(
  userId: string,
  items: VitaluFoodItem[],
  mealSlot: string
) {
  for (const item of items) {
    await prisma.vitaluFoodLog.create({
      data: {
        userId,
        catalogId: item.id,
        title: item.name,
        mealSlot,
        grams: item.grams,
        kcal: item.kcal,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        fiberG: item.fiberG,
        waterMl: item.waterMl,
      },
    });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await ensureVitaluSchema();
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest("Invalid food log.");

    if (parsed.data.copyYesterday) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const yStart = new Date(start);
      yStart.setDate(yStart.getDate() - 1);
      const yesterday = await prisma.vitaluFoodLog.findMany({
        where: { userId: session.id, eatenAt: { gte: yStart, lt: start } },
      });
      for (const row of yesterday) {
        await prisma.vitaluFoodLog.create({
          data: {
            userId: session.id,
            catalogId: row.catalogId,
            title: row.title,
            mealSlot: row.mealSlot,
            grams: row.grams,
            kcal: row.kcal,
            proteinG: row.proteinG,
            carbsG: row.carbsG,
            fatG: row.fatG,
            fiberG: row.fiberG,
            waterMl: row.waterMl,
          },
        });
      }
      return json(await loadVitaluToday(session.id), 201);
    }

    if (parsed.data.saveMeal) {
      const slot = parsed.data.mealSlot ?? "SNACK";
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const rows = await prisma.vitaluFoodLog.findMany({
        where: { userId: session.id, eatenAt: { gte: start }, mealSlot: slot },
      });
      const items = rows
        .filter((r) => r.catalogId !== "water-250")
        .map((r) => ({
          id: r.catalogId ?? r.id,
          name: r.title,
          servingLabel: `${Math.round(r.grams)} g`,
          grams: r.grams,
          kcal: r.kcal,
          proteinG: r.proteinG,
          carbsG: r.carbsG,
          fatG: r.fatG,
          fiberG: r.fiberG,
          waterMl: r.waterMl,
        }));
      if (!items.length) return badRequest("Log foods in that meal first, then save it.");
      await prisma.vitaluSavedMeal.create({
        data: {
          userId: session.id,
          title: `Saved ${VITALU_MEAL_SLOT_LABELS[slot].toLowerCase()}`,
          mealSlot: slot,
          itemsJson: JSON.stringify(items),
        },
      });
      return json(await loadVitaluToday(session.id), 201);
    }

    if (parsed.data.savedMealId) {
      const saved = await prisma.vitaluSavedMeal.findFirst({
        where: { id: parsed.data.savedMealId, userId: session.id },
      });
      if (!saved) return badRequest("Saved meal not found.");
      let items: VitaluFoodItem[] = [];
      try {
        items = JSON.parse(saved.itemsJson) as VitaluFoodItem[];
      } catch {
        return badRequest("Saved meal is unreadable.");
      }
      await logItems(session.id, items, parsed.data.mealSlot ?? saved.mealSlot);
      return json(await loadVitaluToday(session.id), 201);
    }

    if (parsed.data.usualSlot) {
      const today = await loadVitaluToday(session.id);
      const usual = today.foodMemory.usual[parsed.data.usualSlot];
      if (!usual) return badRequest("No usual meal learned for that slot yet.");
      await logItems(session.id, usual.items, parsed.data.usualSlot);
      return json(await loadVitaluToday(session.id), 201);
    }

    if (parsed.data.waterMl) {
      await prisma.vitaluFoodLog.create({
        data: {
          userId: session.id,
          catalogId: "water-250",
          title: "Water",
          mealSlot: parsed.data.mealSlot ?? "SNACK",
          grams: parsed.data.waterMl,
          kcal: 0,
          waterMl: parsed.data.waterMl,
        },
      });
      return json(await loadVitaluToday(session.id), 201);
    }

    const items = parsed.data.tell
      ? parseTellVitalu(parsed.data.tell)
      : parsed.data.catalogId
        ? [getVitaluFood(parsed.data.catalogId, parsed.data.grams)].filter(Boolean)
        : [];
    if (!items.length) return badRequest("Could not match that food. Search and pick one.");

    const slot = parsed.data.mealSlot ?? "SNACK";
    await logItems(session.id, items as VitaluFoodItem[], slot);
    return json(await loadVitaluToday(session.id), 201);
  } catch (error) {
    console.error("[api/vitalu/foods]", error);
    return serverError("Could not log food.");
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await ensureVitaluSchema();
    const parsed = deleteSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest("Missing id.");
    if (parsed.data.savedMealId) {
      await prisma.vitaluSavedMeal.deleteMany({
        where: { id: parsed.data.savedMealId, userId: session.id },
      });
    }
    if (parsed.data.id) {
      await prisma.vitaluFoodLog.deleteMany({ where: { id: parsed.data.id, userId: session.id } });
    }
    return json(await loadVitaluToday(session.id));
  } catch (error) {
    console.error("[api/vitalu/foods]", error);
    return serverError("Could not remove food.");
  }
}
