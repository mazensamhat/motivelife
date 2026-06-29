import type { AgentType } from "@forward/shared";
import { getDomainNextActionFromContext } from "@forward/ai";
import { buildSuggestionContext } from "./forward";

export const DOMAIN_SLUGS = {
  career: { agent: "CAREER" as AgentType, label: "Career" },
  money: { agent: "MONEY" as AgentType, label: "Money" },
  health: { agent: "HEALTH" as AgentType, label: "Health" },
  learning: { agent: "LEARNING" as AgentType, label: "Learning" },
  relationships: { agent: "GENERAL" as AgentType, label: "Social & Relationships" },
  memory: { agent: "GENERAL" as AgentType, label: "Relationships" },
} as const;

export type DomainSlug = keyof typeof DOMAIN_SLUGS;

export async function getDomainNextAction(userId: string, slug: DomainSlug) {
  const meta = DOMAIN_SLUGS[slug];
  const context = await buildSuggestionContext(userId);

  if (slug === "memory" || slug === "relationships") {
    const { collectSuggestions } = await import("@forward/ai");
    const rel = collectSuggestions(context, { agent: "GENERAL", limit: 10 }).find(
      (s) =>
        s.actionHref === "/relationships" ||
        s.actionHref === "/memory" ||
        /call|mom|dad|family|friend|message/i.test(s.title)
    );
    if (rel) {
      return {
        domain: "GENERAL",
        domainLabel: meta.label,
        title: rel.title,
        reason: rel.reason,
        actionLabel: rel.actionLabel ?? "Reach out",
        actionHref: rel.actionHref ?? "/relationships",
        entityId: rel.entityId,
      };
    }
  }

  return getDomainNextActionFromContext(context, meta.agent, meta.label);
}

export async function getModuleNextSteps(userId: string) {
  const context = await buildSuggestionContext(userId);
  return {
    career: getDomainNextActionFromContext(context, "CAREER", "Career"),
    money: getDomainNextActionFromContext(context, "MONEY", "Money"),
    health: getDomainNextActionFromContext(context, "HEALTH", "Health"),
    learning: getDomainNextActionFromContext(context, "LEARNING", "Learning"),
    relationships: getDomainNextActionFromContext(context, "GENERAL", "Relationships"),
  };
}
