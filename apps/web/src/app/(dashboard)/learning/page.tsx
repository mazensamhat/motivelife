import { DomainNextActionHero } from "@/components/domain-next-action-hero";
import {
  DOMAIN_PAGE_SHELL,
  DOMAIN_PAGE_SUBTITLE,
  DOMAIN_PAGE_TITLE,
} from "@/components/domain-page-shell";
import { LearningPanel } from "@/components/learning-panel";
import { ModuleImprovementPanel } from "@/components/module-improvement-panel";

export default function LearningPage() {
  return (
    <div className={DOMAIN_PAGE_SHELL}>
      <div>
        <h1 className={DOMAIN_PAGE_TITLE}>Learning</h1>
        <p className={DOMAIN_PAGE_SUBTITLE}>
          Track → Understand → Improve. Skills compound when coaching adapts to you.
        </p>
      </div>

      <ModuleImprovementPanel module="learning" />

      <DomainNextActionHero domain="learning" />

      <LearningPanel />
    </div>
  );
}
