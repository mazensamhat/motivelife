import { DomainNextActionHero } from "@/components/domain-next-action-hero";
import { LifeFinanceEnginePanel } from "@/components/life-finance-engine-panel";
import { MoneyPanel } from "@/components/money-panel";
import { MoneyImprovementPanel } from "@/components/money-improvement-panel";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function MoneyPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-forward-900">Life Finance Engine</h1>
        <p className="mt-1 text-forward-500">
          Help your AI understand your financial life — not to track every coffee, but to make better
          decisions across career, retirement, goals, and your calendar.
        </p>
      </div>

      <LifeFinanceEnginePanel />

      <MoneyImprovementPanel />

      <DomainNextActionHero domain="money" />

      <div>
        <h2 className="text-lg font-semibold text-forward-900">Monthly commitments & accounts</h2>
        <p className="mt-1 text-sm text-forward-500">
          Enter fixed costs once (mortgage, hydro, phone…). Your AI uses this baseline — not daily
          receipts.
        </p>
        <div className="mt-4">
          <MoneyPanel />
        </div>
      </div>
    </div>
  );
}
