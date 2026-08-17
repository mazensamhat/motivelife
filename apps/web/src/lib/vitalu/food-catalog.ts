import type { VitaluFoodItem } from "@forward/shared";

type CatalogFood = {
  id: string;
  name: string;
  aliases: string[];
  servingG: number;
  servingLabel: string;
  per100: { kcal: number; protein: number; carbs: number; fat: number; fiber: number };
  waterMl?: number;
};

/** Starter catalog — wellness estimates for logging, not a CNF dump. CNF cache is the next data layer. */
const CATALOG: CatalogFood[] = [
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
];

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
    return CATALOG.slice(0, 12).map((f) => scaleFood(f, f.servingG));
  }
  const scored = CATALOG.map((f) => {
    const hay = `${f.name} ${f.aliases.join(" ")}`.toLowerCase();
    let score = 0;
    if (hay.startsWith(q)) score = 3;
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
  return out;
}
