import { DomainNextActionHero } from "@/components/domain-next-action-hero";
import {
  DOMAIN_PAGE_SHELL,
  DOMAIN_PAGE_SUBTITLE,
  DOMAIN_PAGE_TITLE,
} from "@/components/domain-page-shell";
import { RelationshipsImprovementPanel } from "@/components/relationships-improvement-panel";
import { RelationshipsPanel } from "@/components/relationships-panel";
import { VoicePracticePanel } from "@/components/voice-practice-panel";

export default function RelationshipsPage() {
  return (
    <div className={DOMAIN_PAGE_SHELL}>
      <div>
        <h1 className={DOMAIN_PAGE_TITLE}>Social & Relationships</h1>
        <p className={DOMAIN_PAGE_SUBTITLE}>
          Track → Understand → Improve. Stay connected with family, friends, and community.
        </p>
      </div>

      <VoicePracticePanel domain="relationships" />

      <RelationshipsImprovementPanel />

      <DomainNextActionHero domain="relationships" />

      <RelationshipsPanel />
    </div>
  );
}
