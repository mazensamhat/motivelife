import { CareerImprovementPanel } from "@/components/career-improvement-panel";
import { CareerPanel } from "@/components/career-panel";
import { DomainNextActionHero } from "@/components/domain-next-action-hero";
import {
  DOMAIN_PAGE_SHELL,
  DOMAIN_PAGE_SUBTITLE,
  DOMAIN_PAGE_TITLE,
} from "@/components/domain-page-shell";
import { VoicePracticePanel } from "@/components/voice-practice-panel";

export default function CareerPage() {
  return (
    <div className={DOMAIN_PAGE_SHELL}>
      <div>
        <h1 className={DOMAIN_PAGE_TITLE}>Career</h1>
        <p className={DOMAIN_PAGE_SUBTITLE}>
          Track → Understand → Improve. Resume, interview, job search, and workplace momentum.
        </p>
      </div>

      <VoicePracticePanel domain="career" />

      <CareerImprovementPanel />

      <DomainNextActionHero domain="career" />

      <CareerPanel />
    </div>
  );
}
