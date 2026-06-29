import { DomainNextActionHero } from "@/components/domain-next-action-hero";
import { RelationshipsImprovementPanel } from "@/components/relationships-improvement-panel";
import { RelationshipsPanel } from "@/components/relationships-panel";
import { VoicePracticePanel } from "@/components/voice-practice-panel";

export default function RelationshipsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-forward-900">Social & Relationships</h1>
        <p className="mt-1 text-forward-500">
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
