import { LIFE_MODULES, CONTEXT_MODULE_PRIORITIES, type LifeContextId, type LifeModuleId } from "@forward/shared";

export function sortModulesByOrder<T extends { id: LifeModuleId }>(
  modules: T[],
  order: LifeModuleId[]
): T[] {
  if (order.length === 0) return modules;

  return [...modules].sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    if (ia === -1 && ib === -1) {
      return LIFE_MODULES.findIndex((m) => m.id === a.id) - LIFE_MODULES.findIndex((m) => m.id === b.id);
    }
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/** Re-rank modules when a life context is active (interview → career first, etc.) */
export function applyContextModuleOrder<T extends { id: LifeModuleId }>(
  modules: T[],
  contextId: LifeContextId | null | undefined
): T[] {
  if (!contextId) return modules;
  const priorities = CONTEXT_MODULE_PRIORITIES[contextId];
  if (!priorities?.length) return modules;

  const rank = new Map(priorities.map((id, index) => [id, index]));
  const baseIndex = new Map(modules.map((m, i) => [m.id, i]));

  return [...modules].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id)! : 100 + (baseIndex.get(a.id) ?? 0);
    const rb = rank.has(b.id) ? rank.get(b.id)! : 100 + (baseIndex.get(b.id) ?? 0);
    return ra - rb;
  });
}
