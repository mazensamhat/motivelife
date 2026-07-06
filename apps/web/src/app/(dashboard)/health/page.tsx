import { DomainNextActionHero } from "@/components/domain-next-action-hero";
import {
  DOMAIN_PAGE_SHELL,
  DOMAIN_PAGE_SUBTITLE,
  DOMAIN_PAGE_TITLE,
} from "@/components/domain-page-shell";
import { HealthPanel } from "@/components/health-panel";
import { ModuleImprovementPanel } from "@/components/module-improvement-panel";

export default function HealthPage() {
  return (
    <div className={DOMAIN_PAGE_SHELL}>
      <div>
        <h1 className={DOMAIN_PAGE_TITLE}>Health</h1>
        <p className={DOMAIN_PAGE_SUBTITLE}>
          Track → Understand → Improve. Build capacity, not just log workouts.
        </p>
      </div>

      <ModuleImprovementPanel module="health" />

      <DomainNextActionHero domain="health" />

      <HealthPanel />
    </div>
  );
}
