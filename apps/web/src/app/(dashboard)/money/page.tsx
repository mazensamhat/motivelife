import { DomainNextActionHero } from "@/components/domain-next-action-hero";
import { MoneyPanel } from "@/components/money-panel";
import { MoneyImprovementPanel } from "@/components/money-improvement-panel";
import { RetirementGapPanel } from "@/components/retirement-gap-panel";
import { getSession } from "@/lib/session";
import { computeRetirementGap } from "@/lib/retirement-gap";
import { redirect } from "next/navigation";

export default async function MoneyPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const retirementGap = await computeRetirementGap(session.id);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-forward-900">Money</h1>
        <p className="mt-1 text-forward-500">
          Track → Understand → Improve. Not just what you spent — how to get better.
        </p>
      </div>

      {retirementGap && <RetirementGapPanel gap={retirementGap} />}

      <MoneyImprovementPanel />

      <DomainNextActionHero domain="money" />

      <MoneyPanel />
    </div>
  );
}
