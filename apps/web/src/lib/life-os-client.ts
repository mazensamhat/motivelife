import {
  LIFE_FOCUS_OPTIONS,
  type LifeFocusId,
  type LifeModuleId,
} from "@forward/shared";

export function modulesFromFocuses(focuses: LifeFocusId[]): LifeModuleId[] {
  const set = new Set<LifeModuleId>();
  for (const id of focuses) {
    const opt = LIFE_FOCUS_OPTIONS.find((f) => f.id === id);
    opt?.modules.forEach((m) => set.add(m as LifeModuleId));
  }
  if (set.size === 0) {
    return ["goals", "career", "money", "health", "habits"];
  }
  return [...set];
}
