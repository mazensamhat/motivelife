import { prisma } from "@forward/database";
import { listVitaluCatalogFoods } from "@/lib/vitalu/food-catalog";
import { listVitaluExercises } from "@/lib/vitalu/exercise-catalog";

/**
 * Cache licensed/CNF-style reference rows in MotiveLife Postgres.
 * Idempotent. Never fetches Health Canada or wger on a user keystroke.
 */
export async function seedVitaluReferenceCatalogs(): Promise<void> {
  try {
    const foods = listVitaluCatalogFoods();
    const foodCount = await prisma.vitaluFoodCatalog.count().catch(() => 0);
    if (foodCount < foods.length) {
      for (const food of foods) {
        await prisma.vitaluFoodCatalog.upsert({
          where: { id: food.id },
          create: {
            id: food.id,
            name: food.name,
            aliasesJson: JSON.stringify(food.aliases),
            servingG: food.servingG,
            servingLabel: food.servingLabel,
            kcalPer100: food.per100.kcal,
            proteinPer100: food.per100.protein,
            carbsPer100: food.per100.carbs,
            fatPer100: food.per100.fat,
            fiberPer100: food.per100.fiber,
            waterMl: food.waterMl ?? 0,
            source: food.source ?? "cnf_cache",
          },
          update: {
            name: food.name,
            aliasesJson: JSON.stringify(food.aliases),
            servingG: food.servingG,
            servingLabel: food.servingLabel,
            kcalPer100: food.per100.kcal,
            proteinPer100: food.per100.protein,
            carbsPer100: food.per100.carbs,
            fatPer100: food.per100.fat,
            fiberPer100: food.per100.fiber,
            waterMl: food.waterMl ?? 0,
            source: food.source ?? "cnf_cache",
          },
        });
      }
    }
  } catch (error) {
    console.warn("[seedVitaluReferenceCatalogs] foods", error);
  }

  try {
    const exercises = listVitaluExercises();
    const exCount = await prisma.vitaluExercise.count().catch(() => 0);
    if (exCount < exercises.length) {
      for (const move of exercises) {
        await prisma.vitaluExercise.upsert({
          where: { id: move.id },
          create: {
            id: move.id,
            name: move.name,
            pattern: move.pattern,
            equipmentJson: JSON.stringify(move.equipment),
            difficulty: move.difficulty,
            instructions: move.instructions,
            prescriptionEasy: move.prescription(1),
            prescriptionMid: move.prescription(2),
            prescriptionHard: move.prescription(3),
            skipIfJson: JSON.stringify(move.skipIf),
          },
          update: {
            name: move.name,
            pattern: move.pattern,
            equipmentJson: JSON.stringify(move.equipment),
            difficulty: move.difficulty,
            instructions: move.instructions,
            prescriptionEasy: move.prescription(1),
            prescriptionMid: move.prescription(2),
            prescriptionHard: move.prescription(3),
            skipIfJson: JSON.stringify(move.skipIf),
          },
        });
      }
    }
  } catch (error) {
    console.warn("[seedVitaluReferenceCatalogs] exercises", error);
  }
}
