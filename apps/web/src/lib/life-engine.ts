import type {
  LifeContextState,
  LifeEngineAction,
  LifeGraphPayload,
  LifeModuleId,
} from "@forward/shared";
import type { DomainScoreMap } from "@forward/shared";
import type { UserPersona } from "./user-persona";
import { estimateTaskMinutes, hasBelief } from "./user-persona";

type Candidate = LifeEngineAction & { priority: number };

const CONTEXT_DOMAIN: Partial<Record<string, string>> = {
  interview: "career",
  unemployed: "career",
  buying_house: "money",
  vacation: "travel",
  wedding: "money",
  new_parent: "health",
  student: "learning",
  promotion: "career",
  starting_business: "career",
  retirement: "money",
};

function slugFromDomain(domain: string): LifeEngineAction["domainSlug"] {
  if (domain === "career") return "career";
  if (domain === "money") return "money";
  if (domain === "health") return "health";
  if (domain === "learning") return "learning";
  if (domain === "relationships") return "relationships";
  return null;
}

function scoreGain(title: string, domain: string): number {
  if (/apply|interview|resume|offer/i.test(title)) return 8;
  if (/pay|save|debt|budget/i.test(title)) return 5;
  if (/workout|walk|health/i.test(title)) return 4;
  if (/call|family|mom|message/i.test(title)) return 6;
  return 4;
}

function beliefPriorityBoost(persona: UserPersona, domain: string, title: string): number {
  let boost = 0;
  const blob = `${domain} ${title}`.toLowerCase();

  if (hasBelief(persona, "family_first") && (domain === "relationships" || /family|mom|dad|call|message|visit/i.test(blob)))
    boost += 30;
  if (hasBelief(persona, "financial_freedom") && domain === "money") boost += 25;
  if (hasBelief(persona, "retire_55") && domain === "money") boost += 20;
  if (hasBelief(persona, "health_matters") && domain === "health") boost += 25;
  if (hasBelief(persona, "build_business") && (domain === "career" || /business|launch|client/i.test(blob)))
    boost += 25;
  if (hasBelief(persona, "flexibility_over_salary") && /apply|interview|offer|role/i.test(blob)) boost += 15;
  if (hasBelief(persona, "give_back") && /volunteer|give|donate|mentor/i.test(blob)) boost += 20;

  return boost;
}

export function computeLifeEngineAction(input: {
  pendingMission: { title: string; domain: string; id: string }[];
  moduleNextSteps: Record<
    string,
    { title: string; reason: string; actionLabel: string; actionHref: string; entityId?: string }
  >;
  lifeGps: { destination: string | null; goalId: string | null };
  activeContext: LifeContextState | null;
  persona: UserPersona;
  graph: LifeGraphPayload;
  domainScores: DomainScoreMap;
  promotedModules?: LifeModuleId[];
}): LifeEngineAction {
  const candidates: Candidate[] = [];
  const contextDomain = input.activeContext ? CONTEXT_DOMAIN[input.activeContext.id] : null;
  const estMinutes = estimateTaskMinutes(input.persona.preferences);

  const lowestDomain = (
    ["career", "money", "health", "learning", "relationships", "mindset"] as const
  ).reduce((min, d) => (input.domainScores[d] < input.domainScores[min] ? d : min), "career" as const);

  for (const m of input.pendingMission.slice(0, 5)) {
    let priority = 60;
    if (m.domain === contextDomain) priority += 40;
    if (m.domain === lowestDomain) priority += 15;
    if (input.lifeGps.destination && new RegExp(input.lifeGps.destination.slice(0, 8), "i").test(m.title))
      priority += 25;
    priority += beliefPriorityBoost(input.persona, m.domain, m.title);

    candidates.push({
      priority,
      title: m.title,
      reason: `Today's mission · ${m.domain}`,
      whyConnected: input.graph.destination
        ? `Moves you toward ${input.graph.destination.label}`
        : "Part of your daily mission stack",
      domain: m.domain,
      domainSlug: slugFromDomain(m.domain),
      actionLabel: "Done",
      actionHref: `/tasks?focus=${m.id}`,
      entityId: m.id,
      scoreGain: scoreGain(m.title, m.domain),
      sources: ["MISSION"],
    });
  }

  const moduleMap: { key: string; domain: string; slug: LifeEngineAction["domainSlug"] }[] = [
    { key: "career", domain: "career", slug: "career" },
    { key: "money", domain: "money", slug: "money" },
    { key: "health", domain: "health", slug: "health" },
    { key: "learning", domain: "learning", slug: "learning" },
    { key: "relationships", domain: "relationships", slug: "relationships" },
  ];

  for (const { key, domain, slug } of moduleMap) {
    const step = input.moduleNextSteps[key];
    if (!step?.title) continue;

    let priority = 45;
    if (domain === contextDomain) priority += 45;
    if (input.promotedModules?.includes(key as LifeModuleId)) priority += 35;
    if (domain === lowestDomain) priority += 20;
    if (input.graph.edges.some((e) => e.label?.toLowerCase().includes(step.title.toLowerCase().slice(0, 6))))
      priority += 30;
    priority += beliefPriorityBoost(input.persona, domain, step.title);

    candidates.push({
      priority,
      title: step.title,
      reason: step.reason,
      whyConnected:
        input.graph.edges.length > 0
          ? "Connected in your Life Graph™"
          : `Best ${domain} move right now`,
      domain,
      domainSlug: slug,
      actionLabel: step.actionLabel,
      actionHref: step.actionHref,
      entityId: step.entityId,
      scoreGain: scoreGain(step.title, domain),
      sources: input.graph.edges.length > 0 ? ["GRAPH", "MODULE"] : ["MODULE"],
    });
  }

  if (candidates.length === 0) {
    return {
      title: input.lifeGps.destination
        ? `Take one step toward ${input.lifeGps.destination}`
        : "Set your Life GPS destination",
      reason: "Life Engine found no pending actions — start here.",
      whyConnected: "Your graph needs a first connection",
      domain: "mindset",
      domainSlug: null,
      actionLabel: "Set destination",
      actionHref: "/dashboard#life-gps",
      scoreGain: 3,
      sources: ["ENGINE"],
    };
  }

  candidates.sort((a, b) => b.priority - a.priority);
  const best = candidates[0];

  return {
    ...best,
    reason:
      input.activeContext && contextDomain === best.domain
        ? `${input.activeContext.label} — ${best.reason}`
        : best.reason,
    whyConnected: `${best.whyConnected} · ~${estMinutes} min`,
  };
}
