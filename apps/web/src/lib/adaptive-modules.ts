import type { LifeModuleId } from "@forward/shared";
import type { ModuleUsageMap } from "@forward/shared";

const PATH_TO_MODULE: Record<string, LifeModuleId> = {
  "/career": "career",
  "/money": "money",
  "/health": "health",
  "/learning": "learning",
  "/relationships": "relationships",
  "/memory": "relationships",
  "/habits": "habits",
  "/tasks": "goals",
};

const THIRTY_DAYS_MS = 30 * 86400000;
const SEVEN_DAYS_MS = 7 * 86400000;

/** Modules that can be auto-hidden when unused */
const ADAPTIVE_HIDE_CANDIDATES: LifeModuleId[] = ["learning", "travel", "mindset"];

export function pathToModule(pathname: string): LifeModuleId | null {
  const base = pathname.split("#")[0].split("?")[0];
  if (PATH_TO_MODULE[base]) return PATH_TO_MODULE[base];
  if (base === "/dashboard") return "goals";
  return null;
}

export function parseModuleUsage(raw: string | null | undefined): ModuleUsageMap {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ModuleUsageMap;
  } catch {
    return {};
  }
}

export function recordModuleOpen(usage: ModuleUsageMap, moduleId: LifeModuleId): ModuleUsageMap {
  const prev = usage[moduleId];
  return {
    ...usage,
    [moduleId]: {
      lastOpenedAt: new Date().toISOString(),
      openCount: (prev?.openCount ?? 0) + 1,
    },
  };
}

export function inferModuleActivity(
  moduleId: LifeModuleId,
  signals: {
    learningUpdatedAt?: Date | null;
    habitUpdatedAt?: Date | null;
    moneyUpdatedAt?: Date | null;
    careerUpdatedAt?: Date | null;
    relationshipsUpdatedAt?: Date | null;
  }
): Date | null {
  switch (moduleId) {
    case "learning":
      return signals.learningUpdatedAt ?? null;
    case "habits":
    case "mindset":
      return signals.habitUpdatedAt ?? null;
    case "money":
    case "travel":
      return signals.moneyUpdatedAt ?? null;
    case "career":
      return signals.careerUpdatedAt ?? null;
    case "relationships":
      return signals.relationshipsUpdatedAt ?? null;
    default:
      return null;
  }
}

export function shouldHideModule(
  moduleId: LifeModuleId,
  usage: ModuleUsageMap,
  activityAt: Date | null
): boolean {
  if (!ADAPTIVE_HIDE_CANDIDATES.includes(moduleId)) return false;

  const lastOpen = usage[moduleId]?.lastOpenedAt
    ? new Date(usage[moduleId]!.lastOpenedAt)
    : null;
  const lastActive = lastOpen && activityAt ? (lastOpen > activityAt ? lastOpen : activityAt) : lastOpen ?? activityAt;

  if (!lastActive) return moduleId === "learning" || moduleId === "travel";
  return Date.now() - lastActive.getTime() > THIRTY_DAYS_MS;
}

export function getPromotedModules(usage: ModuleUsageMap): LifeModuleId[] {
  const now = Date.now();
  const promoted: { id: LifeModuleId; score: number }[] = [];

  for (const [id, entry] of Object.entries(usage)) {
    if (!entry?.lastOpenedAt) continue;
    const age = now - new Date(entry.lastOpenedAt).getTime();
    if (age <= SEVEN_DAYS_MS) {
      promoted.push({
        id: id as LifeModuleId,
        score: entry.openCount * 10 + (SEVEN_DAYS_MS - age) / 86400000,
      });
    }
  }

  return promoted.sort((a, b) => b.score - a.score).map((p) => p.id);
}

export function applyAdaptiveModules<T extends { id: LifeModuleId }>(
  modules: T[],
  usage: ModuleUsageMap,
  activitySignals: Parameters<typeof inferModuleActivity>[1]
): { modules: T[]; hidden: LifeModuleId[]; promoted: LifeModuleId[] } {
  const hidden: LifeModuleId[] = [];
  const filtered = modules.filter((m) => {
    const activity = inferModuleActivity(m.id, activitySignals);
    if (shouldHideModule(m.id, usage, activity)) {
      hidden.push(m.id);
      return false;
    }
    return true;
  });

  const promoted = getPromotedModules(usage);
  if (promoted.length === 0) return { modules: filtered, hidden, promoted };

  const rank = new Map(promoted.map((id, i) => [id, i]));
  const sorted = [...filtered].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id)! : 100;
    const rb = rank.has(b.id) ? rank.get(b.id)! : 100;
    return ra - rb;
  });

  return { modules: sorted, hidden, promoted };
}
