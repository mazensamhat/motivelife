import { DomainNextActionHero } from "@/components/domain-next-action-hero";
import { HealthPanel } from "@/components/health-panel";
import { ModuleImprovementPanel } from "@/components/module-improvement-panel";

export default function HealthPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-forward-900">Health</h1>
        <p className="mt-1 text-forward-500">
          Track → Understand → Improve. Build capacity, not just log workouts.
        </p>
      </div>

      <ModuleImprovementPanel module="health" />

      <DomainNextActionHero domain="health" />

      <HealthPanel />
    </div>
  );
}
