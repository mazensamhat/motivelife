import type { VitaluFoodItem } from "@forward/shared";
import { VITALU_GLOBAL_FOODS, type CatalogFood } from "./food-catalog-global";

export type { CatalogFood };

/**
 * MotiveLife food cache: Canadian CNF-style staples plus American, European,
 * Asian, African, Middle Eastern, Latin, and Oceania meals and drinks.
 * Search never live-hits USDA / Health Canada / any nutrient API.
 * Values are typical as-eaten portions for wellness planning — estimates, not a lab assay.
 */
export const VITALU_FOOD_CATALOG_SOURCE = "food_cache";

const STAPLES: CatalogFood[] = [
  { id: "water-250", name: "Water (250 ml)", aliases: ["water", "glass of water"], servingG: 250, servingLabel: "1 glass", per100: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }, waterMl: 250 },
  { id: "egg-large", name: "Egg, large", aliases: ["eggs"], servingG: 50, servingLabel: "1 large", per100: { kcal: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0 } },
  { id: "toast-ww", name: "Whole-wheat toast", aliases: ["toast", "bread"], servingG: 30, servingLabel: "1 slice", per100: { kcal: 247, protein: 13, carbs: 41, fat: 3.4, fiber: 7 } },
  { id: "butter", name: "Butter", aliases: [], servingG: 10, servingLabel: "2 tsp", per100: { kcal: 717, protein: 0.9, carbs: 0.1, fat: 81, fiber: 0 } },
  { id: "coffee-black", name: "Coffee, black", aliases: ["coffee"], servingG: 240, servingLabel: "1 cup", per100: { kcal: 1, protein: 0.1, carbs: 0, fat: 0, fiber: 0 } },
  { id: "coffee-cream", name: "Coffee with cream", aliases: ["double double", "tims coffee"], servingG: 280, servingLabel: "1 medium", per100: { kcal: 32, protein: 0.8, carbs: 2.2, fat: 2.4, fiber: 0 } },
  { id: "banana", name: "Banana", aliases: [], servingG: 118, servingLabel: "1 medium", per100: { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6 } },
  { id: "apple", name: "Apple", aliases: [], servingG: 182, servingLabel: "1 medium", per100: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4 } },
  { id: "oats", name: "Oatmeal, cooked", aliases: ["oats", "porridge"], servingG: 234, servingLabel: "1 cup", per100: { kcal: 71, protein: 2.5, carbs: 12, fat: 1.5, fiber: 1.7 } },
  { id: "greek-yogurt", name: "Greek yogurt, plain", aliases: ["yogurt"], servingG: 170, servingLabel: "¾ cup", per100: { kcal: 97, protein: 9, carbs: 3.6, fat: 5, fiber: 0 } },
  { id: "chicken-breast", name: "Chicken breast, cooked", aliases: ["chicken"], servingG: 100, servingLabel: "100 g", per100: { kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 } },
  { id: "salmon", name: "Salmon, cooked", aliases: [], servingG: 100, servingLabel: "100 g", per100: { kcal: 208, protein: 20, carbs: 0, fat: 13, fiber: 0 } },
  { id: "rice-white", name: "White rice, cooked", aliases: ["rice"], servingG: 158, servingLabel: "1 cup", per100: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4 } },
  { id: "rice-brown", name: "Brown rice, cooked", aliases: [], servingG: 195, servingLabel: "1 cup", per100: { kcal: 123, protein: 2.7, carbs: 26, fat: 1, fiber: 1.6 } },
  { id: "pasta", name: "Pasta, cooked", aliases: ["spaghetti"], servingG: 140, servingLabel: "1 cup", per100: { kcal: 131, protein: 5, carbs: 25, fat: 1.1, fiber: 1.8 } },
  { id: "potato", name: "Potato, baked", aliases: [], servingG: 173, servingLabel: "1 medium", per100: { kcal: 93, protein: 2.5, carbs: 21, fat: 0.1, fiber: 2.2 } },
  { id: "broccoli", name: "Broccoli, cooked", aliases: [], servingG: 78, servingLabel: "½ cup", per100: { kcal: 35, protein: 2.4, carbs: 7, fat: 0.4, fiber: 3.3 } },
  { id: "spinach", name: "Spinach, raw", aliases: [], servingG: 30, servingLabel: "1 cup", per100: { kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2 } },
  { id: "salad-mix", name: "Mixed salad", aliases: ["salad"], servingG: 85, servingLabel: "2 cups", per100: { kcal: 20, protein: 1.5, carbs: 3.5, fat: 0.2, fiber: 1.8 } },
  { id: "olive-oil", name: "Olive oil", aliases: [], servingG: 14, servingLabel: "1 tbsp", per100: { kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0 } },
  { id: "avocado", name: "Avocado", aliases: [], servingG: 68, servingLabel: "½ fruit", per100: { kcal: 160, protein: 2, carbs: 9, fat: 15, fiber: 7 } },
  { id: "almonds", name: "Almonds", aliases: [], servingG: 28, servingLabel: "1 oz / 23 nuts", per100: { kcal: 579, protein: 21, carbs: 22, fat: 50, fiber: 13 } },
  { id: "peanut-butter", name: "Peanut butter", aliases: [], servingG: 32, servingLabel: "2 tbsp", per100: { kcal: 588, protein: 25, carbs: 20, fat: 50, fiber: 6 } },
  { id: "milk-2", name: "Milk, 2%", aliases: ["milk"], servingG: 244, servingLabel: "1 cup", per100: { kcal: 50, protein: 3.3, carbs: 4.8, fat: 2, fiber: 0 } },
  { id: "cheddar", name: "Cheddar", aliases: ["cheese"], servingG: 28, servingLabel: "1 oz", per100: { kcal: 403, protein: 25, carbs: 1.3, fat: 33, fiber: 0 } },
  { id: "beef-lean", name: "Lean beef, cooked", aliases: ["steak", "beef"], servingG: 100, servingLabel: "100 g", per100: { kcal: 250, protein: 26, carbs: 0, fat: 15, fiber: 0 } },
  { id: "turkey", name: "Turkey breast, cooked", aliases: [], servingG: 100, servingLabel: "100 g", per100: { kcal: 135, protein: 30, carbs: 0, fat: 1, fiber: 0 } },
  { id: "tofu", name: "Tofu, firm", aliases: [], servingG: 100, servingLabel: "100 g", per100: { kcal: 144, protein: 17, carbs: 3, fat: 9, fiber: 2 } },
  { id: "lentils", name: "Lentils, cooked", aliases: [], servingG: 198, servingLabel: "1 cup", per100: { kcal: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 8 } },
  { id: "black-beans", name: "Black beans, cooked", aliases: ["beans"], servingG: 172, servingLabel: "1 cup", per100: { kcal: 132, protein: 8.9, carbs: 24, fat: 0.5, fiber: 8.7 } },
  { id: "quinoa", name: "Quinoa, cooked", aliases: [], servingG: 185, servingLabel: "1 cup", per100: { kcal: 120, protein: 4.4, carbs: 21, fat: 1.9, fiber: 2.8 } },
  { id: "sweet-potato", name: "Sweet potato, baked", aliases: [], servingG: 114, servingLabel: "1 medium", per100: { kcal: 90, protein: 2, carbs: 21, fat: 0.2, fiber: 3.3 } },
  { id: "blueberries", name: "Blueberries", aliases: [], servingG: 148, servingLabel: "1 cup", per100: { kcal: 57, protein: 0.7, carbs: 14, fat: 0.3, fiber: 2.4 } },
  { id: "strawberries", name: "Strawberries", aliases: [], servingG: 152, servingLabel: "1 cup", per100: { kcal: 32, protein: 0.7, carbs: 8, fat: 0.3, fiber: 2 } },
  { id: "orange", name: "Orange", aliases: [], servingG: 131, servingLabel: "1 medium", per100: { kcal: 47, protein: 0.9, carbs: 12, fat: 0.1, fiber: 2.4 } },
  { id: "protein-shake", name: "Protein shake", aliases: ["whey", "shake"], servingG: 300, servingLabel: "1 scoop in water", per100: { kcal: 40, protein: 8, carbs: 1.2, fat: 0.5, fiber: 0 } },
  { id: "granola-bar", name: "Granola bar", aliases: [], servingG: 35, servingLabel: "1 bar", per100: { kcal: 471, protein: 10, carbs: 64, fat: 20, fiber: 7 } },
  { id: "pizza-slice", name: "Pizza, cheese slice", aliases: ["pizza"], servingG: 107, servingLabel: "1 slice", per100: { kcal: 266, protein: 11, carbs: 33, fat: 10, fiber: 2.3 } },
  { id: "burger", name: "Hamburger", aliases: ["burger"], servingG: 150, servingLabel: "1 sandwich", per100: { kcal: 264, protein: 13, carbs: 30, fat: 10, fiber: 1.2 } },
  { id: "fries", name: "French fries", aliases: ["fries"], servingG: 117, servingLabel: "medium", per100: { kcal: 312, protein: 3.4, carbs: 41, fat: 15, fiber: 3.8 } },
  { id: "soda", name: "Cola", aliases: ["soda", "pop"], servingG: 355, servingLabel: "1 can", per100: { kcal: 42, protein: 0, carbs: 11, fat: 0, fiber: 0 } },
  { id: "beer", name: "Beer", aliases: [], servingG: 356, servingLabel: "1 bottle", per100: { kcal: 43, protein: 0.5, carbs: 3.6, fat: 0, fiber: 0 } },
  { id: "wine", name: "Wine, red", aliases: ["wine"], servingG: 147, servingLabel: "5 oz", per100: { kcal: 85, protein: 0.1, carbs: 2.6, fat: 0, fiber: 0 } },
  { id: "chocolate", name: "Dark chocolate", aliases: [], servingG: 28, servingLabel: "1 oz", per100: { kcal: 546, protein: 4.9, carbs: 46, fat: 31, fiber: 7 } },
  { id: "hummus", name: "Hummus", aliases: [], servingG: 30, servingLabel: "2 tbsp", per100: { kcal: 166, protein: 8, carbs: 14, fat: 10, fiber: 6 } },
  { id: "egg-whites", name: "Egg whites", aliases: [], servingG: 33, servingLabel: "1 white", per100: { kcal: 52, protein: 11, carbs: 0.7, fat: 0.2, fiber: 0 } },
  { id: "chicken-thigh", name: "Chicken thigh, cooked, skinless", aliases: ["thigh"], servingG: 100, servingLabel: "100 g", per100: { kcal: 209, protein: 26, carbs: 0, fat: 10.9, fiber: 0 } },
  { id: "tuna-can", name: "Tuna, canned in water", aliases: ["tuna"], servingG: 120, servingLabel: "1 can drained", per100: { kcal: 110, protein: 24, carbs: 0, fat: 0.8, fiber: 0 } },
  { id: "cod", name: "Cod, baked", aliases: ["white fish", "fish"], servingG: 100, servingLabel: "100 g", per100: { kcal: 82, protein: 18, carbs: 0, fat: 0.7, fiber: 0 } },
  { id: "shrimp", name: "Shrimp, cooked", aliases: ["prawns"], servingG: 100, servingLabel: "100 g", per100: { kcal: 99, protein: 24, carbs: 0.2, fat: 0.3, fiber: 0 } },
  { id: "pork-tenderloin", name: "Pork tenderloin, roasted", aliases: ["pork"], servingG: 100, servingLabel: "100 g", per100: { kcal: 143, protein: 26, carbs: 0, fat: 3.5, fiber: 0 } },
  { id: "ground-turkey", name: "Turkey, ground, cooked", aliases: [], servingG: 100, servingLabel: "100 g", per100: { kcal: 203, protein: 27, carbs: 0, fat: 10, fiber: 0 } },
  { id: "cottage-cheese", name: "Cottage cheese, 1%", aliases: ["cottage"], servingG: 226, servingLabel: "1 cup", per100: { kcal: 72, protein: 12, carbs: 2.7, fat: 1, fiber: 0 } },
  { id: "skim-milk", name: "Milk, skim", aliases: [], servingG: 250, servingLabel: "1 cup", per100: { kcal: 34, protein: 3.4, carbs: 5, fat: 0.1, fiber: 0 } },
  { id: "mozzarella", name: "Mozzarella, part-skim", aliases: ["mozza"], servingG: 30, servingLabel: "30 g", per100: { kcal: 254, protein: 24, carbs: 3.1, fat: 16, fiber: 0 } },
  { id: "tempeh", name: "Tempeh", aliases: [], servingG: 100, servingLabel: "100 g", per100: { kcal: 193, protein: 19, carbs: 9, fat: 11, fiber: 0 } },
  { id: "edamame", name: "Edamame, shelled", aliases: [], servingG: 100, servingLabel: "100 g", per100: { kcal: 121, protein: 12, carbs: 9, fat: 5, fiber: 5 } },
  { id: "chickpeas", name: "Chickpeas, boiled", aliases: ["garbanzo"], servingG: 164, servingLabel: "1 cup", per100: { kcal: 164, protein: 8.9, carbs: 27, fat: 2.6, fiber: 7.6 } },
  { id: "kidney-beans", name: "Kidney beans, boiled", aliases: [], servingG: 177, servingLabel: "1 cup", per100: { kcal: 127, protein: 8.7, carbs: 23, fat: 0.5, fiber: 6.4 } },
  { id: "bagel", name: "Bagel, plain", aliases: [], servingG: 90, servingLabel: "1 medium", per100: { kcal: 272, protein: 11, carbs: 53, fat: 1.7, fiber: 2.3 } },
  { id: "tortilla-ww", name: "Tortilla, whole wheat", aliases: ["wrap", "tortilla"], servingG: 45, servingLabel: "1", per100: { kcal: 267, protein: 8.9, carbs: 49, fat: 5.6, fiber: 6 } },
  { id: "kale", name: "Kale, cooked", aliases: [], servingG: 130, servingLabel: "1 cup", per100: { kcal: 28, protein: 1.9, carbs: 5.6, fat: 0.4, fiber: 2 } },
  { id: "carrot", name: "Carrot, raw", aliases: ["carrots"], servingG: 61, servingLabel: "1 medium", per100: { kcal: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8 } },
  { id: "cucumber", name: "Cucumber", aliases: [], servingG: 104, servingLabel: "1 cup", per100: { kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5 } },
  { id: "tomato", name: "Tomato", aliases: ["tomatoes"], servingG: 123, servingLabel: "1 medium", per100: { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2 } },
  { id: "bell-pepper", name: "Bell pepper", aliases: ["pepper"], servingG: 119, servingLabel: "1 medium", per100: { kcal: 26, protein: 0.8, carbs: 6, fat: 0.3, fiber: 1.8 } },
  { id: "onion", name: "Onion", aliases: [], servingG: 80, servingLabel: "½ cup", per100: { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7 } },
  { id: "grapes", name: "Grapes", aliases: [], servingG: 151, servingLabel: "1 cup", per100: { kcal: 69, protein: 0.7, carbs: 18, fat: 0.2, fiber: 0.9 } },
  { id: "berries-mix", name: "Mixed berries", aliases: ["berries"], servingG: 140, servingLabel: "1 cup", per100: { kcal: 50, protein: 0.7, carbs: 12, fat: 0.4, fiber: 4.3 } },
  { id: "almond-butter", name: "Almond butter", aliases: [], servingG: 32, servingLabel: "2 tbsp", per100: { kcal: 614, protein: 21, carbs: 19, fat: 56, fiber: 10 } },
  { id: "walnuts", name: "Walnuts", aliases: [], servingG: 28, servingLabel: "28 g", per100: { kcal: 654, protein: 15, carbs: 14, fat: 65, fiber: 6.7 } },
  { id: "peanuts", name: "Peanuts, dry roasted", aliases: [], servingG: 28, servingLabel: "28 g", per100: { kcal: 587, protein: 24, carbs: 21, fat: 50, fiber: 8 } },
  { id: "chia", name: "Chia seeds", aliases: ["chia"], servingG: 12, servingLabel: "1 tbsp", per100: { kcal: 486, protein: 17, carbs: 42, fat: 31, fiber: 34 } },
  { id: "whey-isolate", name: "Whey isolate", aliases: ["isolate"], servingG: 30, servingLabel: "1 scoop", per100: { kcal: 367, protein: 83, carbs: 3.3, fat: 1.7, fiber: 0 } },
  { id: "tea", name: "Tea, unsweetened", aliases: [], servingG: 240, servingLabel: "1 cup", per100: { kcal: 1, protein: 0, carbs: 0.2, fat: 0, fiber: 0 } },
  { id: "orange-juice", name: "Orange juice", aliases: ["oj", "juice"], servingG: 249, servingLabel: "1 cup", per100: { kcal: 45, protein: 0.7, carbs: 10.4, fat: 0.2, fiber: 0.2 } },
  { id: "stir-fry", name: "Chicken vegetable stir-fry", aliases: ["stir fry", "stirfry"], servingG: 300, servingLabel: "1 bowl", per100: { kcal: 107, protein: 9.3, carbs: 7.3, fat: 4, fiber: 1.5 } },
  { id: "chili", name: "Chili with beans", aliases: ["chilli"], servingG: 254, servingLabel: "1 cup", per100: { kcal: 104, protein: 7.5, carbs: 11, fat: 3.1, fiber: 4 } },
  { id: "soup-chicken", name: "Chicken noodle soup", aliases: ["soup"], servingG: 248, servingLabel: "1 cup", per100: { kcal: 30, protein: 1.6, carbs: 3.6, fat: 1, fiber: 0.3 } },
  { id: "granola", name: "Granola", aliases: [], servingG: 61, servingLabel: "½ cup", per100: { kcal: 489, protein: 15, carbs: 52, fat: 25, fiber: 8.2 } },
  { id: "cereal", name: "Fortified breakfast cereal", aliases: ["cereal"], servingG: 30, servingLabel: "1 cup", per100: { kcal: 367, protein: 6.7, carbs: 80, fat: 3.3, fiber: 6.7 } },
  { id: "tzatziki", name: "Tzatziki", aliases: [], servingG: 30, servingLabel: "2 tbsp", per100: { kcal: 100, protein: 5, carbs: 6.7, fat: 6.7, fiber: 0.3 } },
  { id: "ice-cream", name: "Ice cream, vanilla", aliases: ["icecream"], servingG: 66, servingLabel: "½ cup", per100: { kcal: 207, protein: 3.5, carbs: 24, fat: 11, fiber: 0.7 } },
  { id: "maple-syrup", name: "Maple syrup", aliases: ["syrup"], servingG: 20, servingLabel: "1 tbsp", per100: { kcal: 260, protein: 0, carbs: 67, fat: 0, fiber: 0 } },
  { id: "honey", name: "Honey", aliases: [], servingG: 21, servingLabel: "1 tbsp", per100: { kcal: 304, protein: 0.3, carbs: 82, fat: 0, fiber: 0.2 } },
  { id: "sushi-roll", name: "California roll", aliases: ["sushi"], servingG: 140, servingLabel: "6 pieces", per100: { kcal: 182, protein: 5.7, carbs: 27, fat: 5, fiber: 1.4 } },
  { id: "burrito", name: "Bean burrito", aliases: [], servingG: 180, servingLabel: "1", per100: { kcal: 211, protein: 7.8, carbs: 31, fat: 6.7, fiber: 5 } },
];

const CATALOG: CatalogFood[] = [...STAPLES, ...VITALU_GLOBAL_FOODS];

export function listVitaluCatalogFoods(): CatalogFood[] {
  return CATALOG;
}

export function scaleFood(food: CatalogFood, grams: number): VitaluFoodItem {
  const f = grams / 100;
  const water = food.waterMl ? Math.round((food.waterMl * grams) / food.servingG) : 0;
  return {
    id: food.id,
    name: food.name,
    servingLabel: food.servingLabel,
    grams,
    kcal: Math.round(food.per100.kcal * f),
    proteinG: Math.round(food.per100.protein * f * 10) / 10,
    carbsG: Math.round(food.per100.carbs * f * 10) / 10,
    fatG: Math.round(food.per100.fat * f * 10) / 10,
    fiberG: Math.round(food.per100.fiber * f * 10) / 10,
    waterMl: water,
  };
}

export function searchVitaluFoods(query: string, limit = 8): VitaluFoodItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return CATALOG.slice(0, Math.max(limit, 12)).map((f) => scaleFood(f, f.servingG));
  }
  const scored = CATALOG.map((f) => {
    const hay = `${f.name} ${f.aliases.join(" ")} ${f.region ?? ""}`.toLowerCase();
    let score = 0;
    if (f.name.toLowerCase() === q || f.aliases.some((a) => a.toLowerCase() === q)) score = 4;
    else if (hay.startsWith(q) || f.aliases.some((a) => a.toLowerCase().startsWith(q))) score = 3;
    else if (hay.includes(q)) score = 2;
    else if (q.split(/\s+/).every((p) => hay.includes(p))) score = 1;
    return { f, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((x) => scaleFood(x.f, x.f.servingG));
}

export function getVitaluFood(id: string, grams?: number): VitaluFoodItem | null {
  const f = CATALOG.find((x) => x.id === id);
  if (!f) return null;
  return scaleFood(f, grams ?? f.servingG);
}

/** Very small “Tell Vitalu” parser for common breakfasts — confirm before commit. */
export function parseTellVitalu(text: string): VitaluFoodItem[] {
  const t = text.toLowerCase();
  const out: VitaluFoodItem[] = [];
  const eggs = t.match(/(\d+)\s*eggs?/);
  if (eggs) {
    const n = Math.min(6, Number(eggs[1]));
    const egg = getVitaluFood("egg-large", 50 * n);
    if (egg) {
      egg.name = `${n} eggs`;
      out.push(egg);
    }
  }
  const toast = t.match(/(\d+)\s*(slices?|pieces?)?\s*(of\s+)?toast/);
  if (toast || /toast/.test(t)) {
    const n = toast ? Math.min(4, Number(toast[1]) || 2) : 2;
    const item = getVitaluFood("toast-ww", 30 * n);
    if (item) {
      item.name = `${n} toast`;
      out.push(item);
    }
  }
  if (/butter/.test(t)) {
    const b = getVitaluFood("butter");
    if (b) out.push(b);
  }
  if (/coffee|tim\s*horton/.test(t)) {
    const id = /cream|double/.test(t) ? "coffee-cream" : "coffee-black";
    const c = getVitaluFood(id);
    if (c) out.push(c);
  }
  if (/banana/.test(t)) {
    const b = getVitaluFood("banana");
    if (b) out.push(b);
  }
  if (/oatmeal|porridge|\boats\b/.test(t)) {
    const o = getVitaluFood("oats");
    if (o) out.push(o);
  }
  if (/yogurt|yoghurt/.test(t)) {
    const y = getVitaluFood("greek-yogurt");
    if (y) out.push(y);
  }
  if (/chicken/.test(t)) {
    const c = getVitaluFood("chicken-breast");
    if (c) out.push(c);
  }
  if (/\brice\b/.test(t)) {
    const r = getVitaluFood(/brown/.test(t) ? "rice-brown" : "rice-white");
    if (r) out.push(r);
  }
  if (/protein shake|whey/.test(t)) {
    const s = getVitaluFood("protein-shake");
    if (s) out.push(s);
  }
  const tellHits: Array<[RegExp, string]> = [
    [/jollof/, "jollof-rice"],
    [/ramen/, "ramen"],
    [/\bpho\b|phở/, "pho"],
    [/pad\s*thai/, "pad-thai"],
    [/\btacos?\b/, "taco"],
    [/croissant/, "croissant"],
    [/shawarma|schwarma/, "shawarma"],
    [/falafel/, "falafel"],
    [/biryani/, "biryani"],
    [/smoothie/, "smoothie-fruit"],
    [/\blatte\b/, "latte"],
    [/matcha/, "matcha-latte"],
    [/boba|bubble tea/, "boba"],
    [/shakshuka/, "shakshuka"],
    [/injera/, "injera"],
    [/plantain/, "plantain-fried"],
    [/samosa/, "samosa"],
    [/dosa/, "dosa"],
    [/naan/, "naan"],
    [/bibimbap/, "bibimbap"],
    [/kimchi/, "kimchi"],
    [/lasagna|lasagne/, "lasagna"],
    [/paella/, "paella"],
    [/ceviche/, "ceviche"],
    [/empanada/, "empanada"],
    [/arepa/, "arepa"],
    [/tagine|tajine/, "tagine"],
    [/couscous/, "couscous"],
    [/kebab|kabob/, "kebab"],
    [/horchata/, "horchata"],
    [/chai\b/, "chai"],
    [/flat white/, "flat-white"],
    [/oat milk|oatmilk/, "oat-milk"],
  ];
  const have = new Set(out.map((x) => x.id));
  for (const [re, id] of tellHits) {
    if (!re.test(t) || have.has(id)) continue;
    const item = getVitaluFood(id);
    if (item) {
      out.push(item);
      have.add(id);
    }
  }
  for (const food of listVitaluCatalogFoods()) {
    if (have.has(food.id) || food.id === "water-250") continue;
    const names = [food.name, ...food.aliases];
    const matched = names.some((n) => {
      const token = n.toLowerCase().split(/[,(]/)[0]!.trim();
      return token.length >= 5 && t.includes(token);
    });
    if (matched) {
      out.push(scaleFood(food, food.servingG));
      have.add(food.id);
    }
  }
  return out;
}
