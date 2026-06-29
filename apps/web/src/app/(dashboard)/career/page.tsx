import { CareerImprovementPanel } from "@/components/career-improvement-panel";
import { CareerPanel } from "@/components/career-panel";
import { DomainNextActionHero } from "@/components/domain-next-action-hero";
import { VoicePracticePanel } from "@/components/voice-practice-panel";

export default function CareerPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-forward-900">Career</h1>
        <p className="mt-1 text-forward-500">
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
