"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calculator,
  Compass,
  LineChart,
  Pencil,
  Receipt,
} from "lucide-react";
import type { LifeFinanceSnapshot, UpcomingCommitment } from "@forward/shared";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import { Input } from "./input";
import { ResponsiveMetricGrid } from "./responsive-page";
import { cn } from "@/lib/utils";
import { readApiJson } from "@/lib/fetch-api";
import { FeedbackNavButton } from "./dashboard-mobile-nav";
import { ExpenseBreakdownChart } from "./expense-breakdown-chart";
import { MONEY_UPDATED_EVENT, notifyMoneyUpdated } from "@/lib/money-events";
import type { FinancialProfilePayload } from "@forward/shared";

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const PRESSURE_STYLES = {
  low: { dot: "bg-brand-green", label: "Low pressure", text: "text-brand-green" },
  moderate: { dot: "bg-amber-500", label: "Moderate pressure", text: "text-amber-600" },
  high: { dot: "bg-red-500", label: "High pressure", text: "text-red-600" },
} as const;

const SLICE_COLORS = [
  "#0072ff",
  "#7C3AED",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#6366F1",
  "#14B8A6",
];

function netWorth(snapshot: LifeFinanceSnapshot) {
  return (
    snapshot.totalSavings +
    snapshot.totalInvestments +
    snapshot.totalRetirement -
    snapshot.totalDebt
  );
}

function availablePercent(snapshot: LifeFinanceSnapshot) {
  if (snapshot.monthlyTakeHome <= 0) return 0;
  return Math.round((snapshot.availableMonthly / snapshot.monthlyTakeHome) * 100);
}

function commitmentPercent(snapshot: LifeFinanceSnapshot) {
  if (snapshot.monthlyTakeHome <= 0) return 0;
  return Math.round((snapshot.fixedMonthlyExpenses / snapshot.monthlyTakeHome) * 100);
}

function DonutChart({
  percent,
  amount,
  sublabel,
  className,
}: {
  percent: number;
  amount: number;
  sublabel: string;
  className?: string;
}) {
  const p = Math.min(100, Math.max(0, percent));
  return (
    <div className={cn("relative mx-auto h-36 w-36", className)}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#00ff87 0% ${p}%, rgba(255,255,255,0.12) ${p}% 100%)`,
        }}
      />
      <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-forward-900 text-center">
        <p className="text-xl font-bold tabular-nums text-white">{formatMoney(amount)}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-green">{sublabel}</p>
        <p className="text-xs text-forward-400">{p}% of income</p>
      </div>
    </div>
  );
}

function CostOfLifeChart({ snapshot }: { snapshot: LifeFinanceSnapshot }) {
  const slices = snapshot.costOfLife.filter((s) => s.amount > 0);
  if (slices.length === 0) {
    return (
      <p className="text-sm text-forward-500">
        Add monthly commitments below to see your cost-of-life breakdown.
      </p>
    );
  }

  let cursor = 0;
  const gradient = slices
    .map((slice, i) => {
      const start = cursor;
      cursor += slice.percent;
      return `${SLICE_COLORS[i % SLICE_COLORS.length]} ${start}% ${cursor}%`;
    })
    .join(", ");

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div
        className="h-40 w-40 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${gradient})` }}
        aria-hidden
      />
      <ul className="min-w-0 flex-1 space-y-2">
        {slices.map((slice, i) => (
          <li key={slice.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }}
              />
              <span className="truncate text-forward-700">{slice.label}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-forward-900">
              {formatMoney(slice.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  accent,
  onEdit,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "green" | "amber" | "blue";
  onEdit?: () => void;
}) {
  const accentClass =
    accent === "green"
      ? "text-brand-green"
      : accent === "amber"
        ? "text-amber-600"
        : accent === "blue"
          ? "text-brand-blue"
          : "text-forward-900";

  return (
    <div className="rounded-xl border border-forward-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-forward-500">{label}</p>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md p-1 text-forward-400 transition hover:bg-forward-100 hover:text-brand-blue"
            aria-label={`Edit ${label}`}
          >
            <Pencil size={14} />
          </button>
        ) : null}
      </div>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", accentClass)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-forward-500">{hint}</p> : null}
    </div>
  );
}

function UpcomingBillsList({ items }: { items: UpcomingCommitment[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-forward-500">
        No upcoming bills yet. Add commitments in the section below.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-forward-100">
      {items.map((bill) => (
        <li key={bill.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate font-medium text-forward-900">{bill.title}</p>
            <p
              className={cn(
                "text-xs",
                bill.status === "due_soon" ? "text-amber-600" : "text-forward-500"
              )}
            >
              {bill.status === "due_soon"
                ? `Due in ${bill.daysUntil} day${bill.daysUntil === 1 ? "" : "s"}`
                : bill.status === "paid"
                  ? "Paid"
                  : `Due in ${bill.daysUntil} days`}
            </p>
          </div>
          <span className="shrink-0 font-semibold tabular-nums text-forward-900">
            {formatMoney(bill.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}

const QUICK_ACTIONS = [
  { href: "#commitments", label: "Bills", icon: Receipt },
  { href: "#retirement", label: "Retirement", icon: Compass },
  { href: "#commitments", label: "Investments", icon: LineChart },
  { href: "#retirement", label: "What if", icon: Calculator },
] as const;

function MobileMoneyOverview({
  snapshot,
  onEditIncome,
}: {
  snapshot: LifeFinanceSnapshot;
  onEditIncome: () => void;
}) {
  const pressure = PRESSURE_STYLES[snapshot.lifeCapacity.financialPressure];
  const availPct = availablePercent(snapshot);

  return (
    <div className="space-y-4 lg:hidden">
      <Card className="overflow-hidden border-forward-800 bg-forward-950 p-0 text-white">
        <div className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-cyan">
            Money overview
          </p>
          <DonutChart
            percent={availPct}
            amount={snapshot.availableMonthly}
            sublabel="Available"
          />
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-forward-400">Monthly income</p>
                <button
                  type="button"
                  onClick={onEditIncome}
                  className="rounded-md p-1 text-forward-500 transition hover:bg-forward-800 hover:text-emerald-300"
                  aria-label="Edit monthly income"
                >
                  <Pencil size={14} />
                </button>
              </div>
              <p className="font-bold tabular-nums">{formatMoney(snapshot.monthlyTakeHome)}</p>
              <p className="text-xs text-forward-500">After tax</p>
            </div>
            <div className="text-right">
              <p className="text-forward-400">Commitments</p>
              <p className="font-bold tabular-nums text-amber-400">
                {formatMoney(snapshot.fixedMonthlyExpenses)}
              </p>
              <p className="text-xs text-forward-500">{commitmentPercent(snapshot)}% of income</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-forward-800">
          <div className="bg-forward-900/80 p-4">
            <p className="text-xs text-forward-400">Money Score</p>
            <p className="text-2xl font-bold text-brand-green">{snapshot.moneyHealth.overall}</p>
            <p className={cn("text-xs font-medium", pressure.text)}>{pressure.label}</p>
          </div>
          <div className="bg-forward-900/80 p-4">
            <p className="text-xs text-forward-400">Net worth</p>
            <p className="text-2xl font-bold">{formatMoney(netWorth(snapshot))}</p>
          </div>
        </div>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl border border-forward-200 bg-white px-4 py-3 text-center shadow-sm"
          >
            <Icon size={20} className="text-brand-blue" />
            <span className="text-[10px] font-medium text-forward-700">{label}</span>
          </Link>
        ))}
      </div>

      <Card className="p-4">
        <CardHeading className="text-sm">Expense breakdown</CardHeading>
        <p className="mt-1 text-xs text-forward-500">
          Home, subscriptions, bills, living costs, debt, savings & investing — mapped from your
          entries below.
        </p>
        <div className="mt-4">
          <ExpenseBreakdownChart breakdown={snapshot.expenseBreakdown} />
        </div>
      </Card>

      <Card className="border-brand-blue/20 bg-brand-blue/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">
          AI insight
        </p>
        <p className="mt-2 text-sm leading-relaxed text-forward-700">{snapshot.aiInsight}</p>
      </Card>

      <Card className="p-4">
        <CardHeading className="text-sm">Upcoming bills</CardHeading>
        <div className="mt-3">
          <UpcomingBillsList items={snapshot.upcomingCommitments} />
        </div>
      </Card>
    </div>
  );
}

function DesktopMoneyOverview({
  snapshot,
  onEditIncome,
}: {
  snapshot: LifeFinanceSnapshot;
  onEditIncome: () => void;
}) {
  const pressure = PRESSURE_STYLES[snapshot.lifeCapacity.financialPressure];

  return (
    <div className="hidden space-y-6 lg:block">
      <ResponsiveMetricGrid cols={5}>
        <MetricCard
          label="Monthly income"
          value={formatMoney(snapshot.monthlyTakeHome)}
          hint="After tax · click pencil to edit"
          onEdit={onEditIncome}
        />
        <MetricCard
          label="Total commitments"
          value={formatMoney(snapshot.fixedMonthlyExpenses)}
          hint={`${commitmentPercent(snapshot)}% of income`}
          accent="amber"
        />
        <MetricCard
          label="Available to allocate"
          value={formatMoney(snapshot.availableMonthly)}
          hint={`${availablePercent(snapshot)}% of income`}
          accent="green"
        />
        <MetricCard
          label="Money score"
          value={String(snapshot.moneyHealth.overall)}
          hint={pressure.label}
          accent="blue"
        />
        <MetricCard label="Net worth" value={formatMoney(netWorth(snapshot))} />
      </ResponsiveMetricGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5 xl:col-span-2">
          <CardHeading className="text-sm">Monthly expense breakdown</CardHeading>
          <p className="mt-1 text-xs text-forward-500">
            Income vs home, subscriptions, bills, living expenses, debt, savings, and investments.
          </p>
          <div className="mt-4">
            <ExpenseBreakdownChart breakdown={snapshot.expenseBreakdown} />
          </div>
          <Link
            href="#commitments"
            className="mt-4 inline-flex text-sm font-medium text-brand-blue hover:underline"
          >
            Add or edit categories →
          </Link>
        </Card>

        {snapshot.retirement ? (
          <div id="retirement">
          <Card className="p-5">
            <CardHeading className="text-sm">Retirement GPS</CardHeading>
            <p className="mt-2 text-sm text-forward-600">{snapshot.retirement.headline}</p>
            <div className="mt-4 flex flex-wrap gap-4">
              <div>
                <p className="text-xs text-forward-500">Goal age</p>
                <p className="text-2xl font-bold">{snapshot.retirement.targetAge}</p>
              </div>
              <div>
                <p className="text-xs text-forward-500">Projected</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    snapshot.retirement.onTrack ? "text-brand-green" : "text-amber-600"
                  )}
                >
                  {snapshot.retirement.projectedAge}
                </p>
              </div>
              <div>
                <p className="text-xs text-forward-500">On track</p>
                <p className="text-lg font-semibold">
                  {snapshot.retirement.onTrack ? "Yes" : "Not yet"}
                </p>
              </div>
            </div>
            {snapshot.retirement.scenarios.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {snapshot.retirement.scenarios.map((s) => (
                  <li
                    key={s.id}
                    className="flex justify-between rounded-lg border border-forward-100 px-3 py-2 text-sm"
                  >
                    <span>
                      {s.label} · {s.action}
                    </span>
                    <span className="font-semibold text-brand-green">{s.impactLabel}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <CardHeading className="text-sm">Life Capacity — Money</CardHeading>
          <p className="mt-2 text-3xl font-bold">{snapshot.lifeCapacity.moneyCapacity}%</p>
          <p className={cn("mt-1 text-sm font-medium", pressure.text)}>{pressure.label}</p>
        </Card>
        <Card className="p-5">
          <CardHeading className="text-sm">Financial Health Score</CardHeading>
          <p className="mt-2 text-3xl font-bold text-brand-blue">{snapshot.moneyHealth.overall}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {snapshot.moneyHealth.components.map((c) => (
              <li key={c.key} className="flex justify-between">
                <span>{c.label}</span>
                <span className="font-semibold">{c.score}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function MoneyAside({ snapshot }: { snapshot: LifeFinanceSnapshot }) {
  return (
    <div className="hidden space-y-4 xl:block">
      <Card className="border-brand-cyan/20 bg-gradient-to-br from-brand-cyan/5 to-white p-5">
        <CardHeading className="text-sm">AI Financial Assistant</CardHeading>
        <p className="mt-2 text-sm leading-relaxed text-forward-700">{snapshot.aiInsight}</p>
        <div className="mt-4">
          <FeedbackNavButton className="w-full justify-center" />
        </div>
      </Card>
      <Card className="p-5">
        <CardHeading className="text-sm">Upcoming bills</CardHeading>
        <div className="mt-3">
          <UpcomingBillsList items={snapshot.upcomingCommitments} />
        </div>
      </Card>
    </div>
  );
}

function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [monthlyTakeHome, setMonthlyTakeHome] = useState("");
  const [grossAnnualIncome, setGrossAnnualIncome] = useState("");
  const [monthlyInvestments, setMonthlyInvestments] = useState("");
  const [retirementTargetAge, setRetirementTargetAge] = useState("65");

  async function saveProfile(complete: boolean) {
    setBusy(true);
    try {
      await fetch("/api/financial-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyTakeHome: monthlyTakeHome ? Number(monthlyTakeHome) : null,
          grossAnnualIncome: grossAnnualIncome ? Number(grossAnnualIncome) : null,
          monthlyInvestments: monthlyInvestments ? Number(monthlyInvestments) : 0,
          retirementTargetAge: retirementTargetAge ? Number(retirementTargetAge) : 65,
          setupComplete: complete,
        }),
      });
      if (complete) onComplete();
      else setStep((s) => s + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-brand-blue/20 bg-gradient-to-br from-brand-blue/5 to-white p-6">
      <CardHeading className="text-lg">Build your Life Financial Profile</CardHeading>
      <p className="mt-2 text-sm text-forward-600">
        Teach your AI how your money works so it can coach career, retirement, goals, and daily
        decisions.
      </p>
      {step === 0 ? (
        <div className="mt-6 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
            Step 1 — Income
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium">Monthly take-home pay</label>
            <Input
              type="number"
              placeholder="6800"
              value={monthlyTakeHome}
              onChange={(e) => setMonthlyTakeHome(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Annual gross income (optional)
            </label>
            <Input
              type="number"
              placeholder="95000"
              value={grossAnnualIncome}
              onChange={(e) => setGrossAnnualIncome(e.target.value)}
            />
          </div>
          <Button disabled={!monthlyTakeHome || busy} onClick={() => saveProfile(false)}>
            Continue
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
            Step 2 — Investing
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium">Monthly investments</label>
            <Input
              type="number"
              placeholder="800"
              value={monthlyInvestments}
              onChange={(e) => setMonthlyInvestments(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Retirement target age</label>
            <Input
              type="number"
              value={retirementTargetAge}
              onChange={(e) => setRetirementTargetAge(e.target.value)}
            />
          </div>
          <Button disabled={busy} onClick={() => saveProfile(true)}>
            Finish profile setup
          </Button>
        </div>
      )}
    </Card>
  );
}

function FinancialProfileEditor({
  profile,
  editing,
  onEditingChange,
  onSaved,
}: {
  profile: FinancialProfilePayload;
  editing: boolean;
  onEditingChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [monthlyTakeHome, setMonthlyTakeHome] = useState("");
  const [grossAnnualIncome, setGrossAnnualIncome] = useState("");
  const [monthlyInvestments, setMonthlyInvestments] = useState("");
  const [retirementTargetAge, setRetirementTargetAge] = useState("65");

  useEffect(() => {
    setMonthlyTakeHome(profile.monthlyTakeHome != null ? String(profile.monthlyTakeHome) : "");
    setGrossAnnualIncome(profile.grossAnnualIncome != null ? String(profile.grossAnnualIncome) : "");
    setMonthlyInvestments(
      profile.monthlyInvestments != null ? String(profile.monthlyInvestments) : ""
    );
    setRetirementTargetAge(
      profile.retirementTargetAge != null ? String(profile.retirementTargetAge) : "65"
    );
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/financial-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyTakeHome: monthlyTakeHome ? Number(monthlyTakeHome) : null,
          grossAnnualIncome: grossAnnualIncome ? Number(grossAnnualIncome) : null,
          monthlyInvestments: monthlyInvestments ? Number(monthlyInvestments) : 0,
          retirementTargetAge: retirementTargetAge ? Number(retirementTargetAge) : 65,
        }),
      });
      onEditingChange(false);
      notifyMoneyUpdated();
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="income-profile">
      <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardHeading className="text-sm">Income & financial profile</CardHeading>
          {!editing ? (
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-forward-500">Monthly take-home</dt>
                <dd className="font-semibold tabular-nums text-forward-900">
                  {profile.monthlyTakeHome != null
                    ? formatMoney(profile.monthlyTakeHome)
                    : "Not set"}
                </dd>
              </div>
              <div>
                <dt className="text-forward-500">Annual gross (optional)</dt>
                <dd className="font-semibold tabular-nums text-forward-900">
                  {profile.grossAnnualIncome != null
                    ? formatMoney(profile.grossAnnualIncome)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-forward-500">Monthly investments</dt>
                <dd className="font-semibold tabular-nums text-forward-900">
                  {formatMoney(profile.monthlyInvestments ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="text-forward-500">Retirement target age</dt>
                <dd className="font-semibold text-forward-900">
                  {profile.retirementTargetAge ?? 65}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
        {!editing ? (
          <Button size="sm" variant="secondary" onClick={() => onEditingChange(true)}>
            <Pencil size={14} className="mr-1.5" />
            Edit income
          </Button>
        ) : null}
      </div>

      {editing ? (
        <form onSubmit={save} className="mt-4 space-y-4 border-t border-forward-100 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Monthly take-home pay</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                required
                value={monthlyTakeHome}
                onChange={(e) => setMonthlyTakeHome(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Annual gross income (optional)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={grossAnnualIncome}
                onChange={(e) => setGrossAnnualIncome(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Monthly investments</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={monthlyInvestments}
                onChange={(e) => setMonthlyInvestments(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Retirement target age</label>
              <Input
                type="number"
                min="45"
                max="80"
                value={retirementTargetAge}
                onChange={(e) => setRetirementTargetAge(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              Save profile
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => onEditingChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      </Card>
    </div>
  );
}

function FinanceDashboard({
  snapshot,
  onProfileSaved,
}: {
  snapshot: LifeFinanceSnapshot;
  onProfileSaved: () => void;
}) {
  const [incomeEditing, setIncomeEditing] = useState(false);

  const openIncomeEdit = () => {
    setIncomeEditing(true);
    requestAnimationFrame(() => {
      document.getElementById("income-profile")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-8">
      <div className="min-w-0 space-y-6">
        <FinancialProfileEditor
          profile={snapshot.profile}
          editing={incomeEditing}
          onEditingChange={setIncomeEditing}
          onSaved={onProfileSaved}
        />
        <MobileMoneyOverview snapshot={snapshot} onEditIncome={openIncomeEdit} />
        <DesktopMoneyOverview snapshot={snapshot} onEditIncome={openIncomeEdit} />
        <div className="lg:hidden">
          <FeedbackNavButton className="w-full justify-center" />
        </div>
      </div>
      <MoneyAside snapshot={snapshot} />
    </div>
  );
}

export function LifeFinanceEnginePanel() {
  const [snapshot, setSnapshot] = useState<LifeFinanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/financial-profile");
    const data = await readApiJson<{ snapshot?: LifeFinanceSnapshot }>(res);
    setSnapshot(data?.snapshot ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const onMoneyUpdated = () => load();
    window.addEventListener(MONEY_UPDATED_EVENT, onMoneyUpdated);
    return () => window.removeEventListener(MONEY_UPDATED_EVENT, onMoneyUpdated);
  }, []);

  if (loading) return <div className="h-48 animate-pulse rounded-2xl bg-forward-100" />;
  if (!snapshot?.profile.setupComplete) return <SetupWizard onComplete={load} />;
  return <FinanceDashboard snapshot={snapshot} onProfileSaved={load} />;
}
