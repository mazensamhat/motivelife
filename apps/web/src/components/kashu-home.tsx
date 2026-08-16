"use client";

import Link from "next/link";
import { LineChart, Shield, Wallet } from "lucide-react";
import { LifeFinanceEnginePanel } from "@/components/life-finance-engine-panel";
import { MoneyPanel } from "@/components/money-panel";
import { MoneyImprovementPanel } from "@/components/money-improvement-panel";
import { DomainNextActionHero } from "@/components/domain-next-action-hero";
import { CoachSetupMoneyNudge } from "@/components/coach-setup-money-nudge";
import { ProductSuiteIcon } from "@/components/product-icons";
import { PRODUCT_SUITE } from "@/lib/product-suite";

const PILLARS = [
  {
    title: "Protect what matters",
    body: "Bills, obligations, and a safety floor stay reserved — not spendable.",
    Icon: Shield,
  },
  {
    title: "See the future",
    body: "Forecast from today through your next paydays so collisions surface early.",
    Icon: LineChart,
  },
  {
    title: "Spend with confidence",
    body: "Safe to Spend is the number you can use without breaking the plan.",
    Icon: Wallet,
  },
] as const;

/**
 * Kashu product home — Cash-Flow Intelligence.
 * Safe to Spend is the hero metric; existing finance engine powers the model.
 */
export function KashuHome() {
  const brand = PRODUCT_SUITE.kashu;

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-3xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 via-teal-50/80 to-cyan-50 px-5 py-7 sm:px-8 sm:py-9">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-40 blur-3xl"
          style={{ background: brand.primaryLight }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full opacity-30 blur-3xl"
          style={{ background: brand.primaryDark }}
          aria-hidden
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm"
                style={{
                  background: `color-mix(in srgb, ${brand.primary} 18%, white)`,
                  boxShadow: `0 0 28px color-mix(in srgb, ${brand.primary} 28%, transparent)`,
                }}
              >
                <ProductSuiteIcon id="kashu" className="h-8 w-8" />
              </span>
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-[0.2em]"
                  style={{ color: brand.primaryDark }}
                >
                  Cash-Flow Intelligence
                </p>
                <h1
                  className="font-display text-4xl font-semibold tracking-tight sm:text-5xl"
                  style={{
                    background: `linear-gradient(120deg, ${brand.primary}, ${brand.primaryDark})`,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  Kashu
                </h1>
              </div>
            </div>
            <p className="mt-4 max-w-xl text-base text-forward-600 sm:text-lg">
              {brand.tagline} Know what&apos;s coming, what&apos;s already committed, and exactly
              what you can safely spend.
            </p>
          </div>
          <Link
            href="#commitments"
            className="inline-flex shrink-0 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
            style={{ background: `linear-gradient(120deg, ${brand.primary}, ${brand.primaryDark})` }}
          >
            Update balance &amp; bills
          </Link>
        </div>

        <ul className="relative mt-8 grid gap-4 sm:grid-cols-3">
          {PILLARS.map(({ title, body, Icon }) => (
            <li key={title} className="flex gap-3">
              <span
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: `color-mix(in srgb, ${brand.primary} 14%, white)` }}
              >
                <Icon className="h-4 w-4" style={{ color: brand.primaryDark }} aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-forward-900">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-forward-500">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </header>

      <CoachSetupMoneyNudge />

      <LifeFinanceEnginePanel />

      <MoneyImprovementPanel />

      <DomainNextActionHero domain="money" />

      <div
        id="commitments"
        className="rounded-2xl border border-emerald-200/70 bg-white p-4 shadow-sm md:p-6"
      >
        <h2 className="text-lg font-semibold text-forward-900">Monthly commitments &amp; accounts</h2>
        <p className="mt-1 text-sm text-forward-500">
          Enter fixed costs once (mortgage, hydro, phone…). Kashu reserves them so Safe to Spend
          stays honest.
        </p>
        <div className="mt-4">
          <MoneyPanel />
        </div>
      </div>
    </div>
  );
}
