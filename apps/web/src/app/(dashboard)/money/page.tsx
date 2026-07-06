import { DomainNextActionHero } from "@/components/domain-next-action-hero";
import { LifeFinanceEnginePanel } from "@/components/life-finance-engine-panel";
import { MoneyPanel } from "@/components/money-panel";
import { MoneyImprovementPanel } from "@/components/money-improvement-panel";
import { ResponsivePage } from "@/components/responsive-page";
import { CoachSetupMoneyNudge } from "@/components/coach-setup-money-nudge";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function MoneyPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <ResponsivePage width="module" className="space-y-8 rounded-2xl bg-forward-950 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-white md:text-3xl">Life Finance Engine</h1>
        <p className="mt-1 max-w-2xl text-forward-400">
          Help your AI understand your financial life — not to track every coffee, but to make better
          decisions across career, retirement, goals, and your calendar.
        </p>
      </div>

      <CoachSetupMoneyNudge />

      <LifeFinanceEnginePanel />

      <MoneyImprovementPanel />

      <DomainNextActionHero domain="money" />

      <div id="commitments" className="rounded-2xl border border-white/10 bg-forward-950 p-4 md:p-6">
        <h2 className="text-lg font-semibold text-white">Monthly commitments & accounts</h2>
        <p className="mt-1 text-sm text-forward-400">
          Enter fixed costs once (mortgage, hydro, phone…). Your AI uses this baseline — not daily
          receipts.
        </p>
        <div className="mt-4">
          <MoneyPanel />
        </div>
      </div>
    </ResponsivePage>
  );
}
