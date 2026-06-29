import { DomainNextActionHero } from "@/components/domain-next-action-hero";
import { LearningPanel } from "@/components/learning-panel";
import { ModuleImprovementPanel } from "@/components/module-improvement-panel";

export default function LearningPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-forward-900">Learning</h1>
        <p className="mt-1 text-forward-500">
          Track → Understand → Improve. Skills compound when coaching adapts to you.
        </p>
      </div>

      <ModuleImprovementPanel module="learning" />

      <DomainNextActionHero domain="learning" />

      <LearningPanel />
    </div>
  );
}
