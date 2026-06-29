import type { LifeModuleId } from "@forward/shared";

/** Maps Life Module ids to next-action API domain slugs (client-safe) */
export const MODULE_TO_SLUG: Partial<
  Record<LifeModuleId, "career" | "money" | "health" | "learning" | "relationships" | "memory">
> = {
  career: "career",
  money: "money",
  health: "health",
  learning: "learning",
  relationships: "relationships",
};
