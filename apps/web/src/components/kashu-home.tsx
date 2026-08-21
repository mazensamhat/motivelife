"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Check,
  LineChart,
  MessageCircle,
  RefreshCw,
  Shield,
  Sparkles,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import type {
  KashuAskResponse,
  KashuChatTurn,
  KashuForecast,
  KashuForecastBundle,
  KashuIncomeKind,
  KashuIncomeScenario,
  KashuProfileFields,
  KashuProposal,
  KashuTransitionState,
  KashuWhatIfResult,
} from "@forward/shared";
import { MoneyPanel } from "@/components/money-panel";
import { MoneyImprovementPanel } from "@/components/money-improvement-panel";
import { LifeFinanceEnginePanel } from "@/components/life-finance-engine-panel";
import { DomainNextActionHero } from "@/components/domain-next-action-hero";
import { CoachSetupMoneyNudge } from "@/components/coach-setup-money-nudge";
import { ProductSuiteIcon } from "@/components/product-icons";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { PRODUCT_SUITE } from "@/lib/product-suite";
import { notifyMoneyUpdated, MONEY_UPDATED_EVENT, KASHU_UPDATED_EVENT } from "@/lib/money-events";
import { readApiError, readApiJson } from "@/lib/fetch-api";
import { KashuLifeOsCard } from "@/components/kashu-life-os-card";
import { KashuCalendar } from "@/components/kashu-calendar";
import { KashuStatementUpload } from "@/components/kashu-statement-upload";
import {
  KashuRecurringConfirmPanel,
  type KashuRecurringCandidate,
} from "@/components/kashu-recurring-confirm";
import { cn } from "@/lib/utils";

type TabId =
  | "home"
  | "radar"
  | "calendar"
  | "bills"
  | "upload"
  | "buffers"
  | "payday"
  | "timing"
  | "whatif"
  | "ask"
  | "transition"
  | "engine";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "home", label: "Home" },
  { id: "radar", label: "Radar" },
  { id: "calendar", label: "Calendar" },
  { id: "bills", label: "Bills" },
  { id: "upload", label: "Upload" },
  { id: "buffers", label: "Buffers" },
  { id: "payday", label: "Payday" },
  { id: "timing", label: "Timing" },
  { id: "whatif", label: "Afford" },
  { id: "ask", label: "Ask" },
  { id: "transition", label: "Transition" },
  { id: "engine", label: "Accounts" },
];

function money(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function statusColor(status: string) {
  if (status === "red") return "text-red-600 bg-red-50 border-red-200";
  if (status === "yellow") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error(await readApiError(res));
  const data = await readApiJson<T>(res);
  if (!data) throw new Error("Empty response");
  return data;
}

type RecurringCandidate = KashuRecurringCandidate;

export function KashuHome() {
  const brand = PRODUCT_SUITE.kashu;
  const [tab, setTab] = useState<TabId>("home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<KashuProfileFields | null>(null);
  const [forecast, setForecast] = useState<KashuForecast | null>(null);
  const [forecasts, setForecasts] = useState<KashuForecastBundle | null>(null);
  const [incomeScenario, setIncomeScenario] = useState<KashuIncomeScenario>("expected");
  const [pendingRecurring, setPendingRecurring] = useState(0);
  const [candidates, setCandidates] = useState<RecurringCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async (opts?: {
    horizonDays?: number;
    scenario?: KashuIncomeScenario;
  }) => {
    setError(null);
    const activeScenario = opts?.scenario ?? incomeScenario;
    try {
      const params = new URLSearchParams();
      const horizonDays = opts?.horizonDays;
      if (horizonDays === 14 || horizonDays === 30 || horizonDays === 60 || horizonDays === 90) {
        params.set("horizonDays", String(horizonDays));
      }
      if (activeScenario !== "expected") params.set("scenario", activeScenario);
      const qs = params.toString() ? `?${params}` : "";
      const [kashu, recurring] = await Promise.all([
        fetchJson<{
          profile: KashuProfileFields;
          forecast: KashuForecast;
          forecasts: KashuForecastBundle | null;
          pendingRecurring: number;
        }>(`/api/kashu${qs}`),
        fetchJson<{ candidates: RecurringCandidate[] }>("/api/kashu/recurring"),
      ]);
      setProfile(kashu.profile);
      setForecast(kashu.forecast);
      setForecasts(kashu.forecasts ?? null);
      setPendingRecurring(kashu.pendingRecurring);
      setCandidates(recurring.candidates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Kashu.");
    } finally {
      setLoading(false);
    }
  }, [incomeScenario]);

  useEffect(() => {
    void refresh();
    // Initial load only — scenario changes call refresh explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Statement upload / bill confirm / buffers — refresh forecast everywhere in Kashu
  useEffect(() => {
    const onKashuSync = () => {
      void refresh({ horizonDays: 90 });
    };
    window.addEventListener(MONEY_UPDATED_EVENT, onKashuSync);
    window.addEventListener(KASHU_UPDATED_EVENT, onKashuSync);
    return () => {
      window.removeEventListener(MONEY_UPDATED_EVENT, onKashuSync);
      window.removeEventListener(KASHU_UPDATED_EVENT, onKashuSync);
    };
  }, [refresh]);

  async function selectIncomeScenario(scenario: KashuIncomeScenario) {
    setIncomeScenario(scenario);
    await refresh({ scenario });
  }

  async function patchProfile(body: Record<string, unknown>) {
    setBusy(true);
    setNotice(null);
    try {
      const data = await fetchJson<{
        profile: KashuProfileFields;
        forecast: KashuForecast;
        forecasts: KashuForecastBundle | null;
        pendingRecurring: number;
      }>("/api/kashu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setProfile(data.profile);
      setForecast(data.forecast);
      setForecasts(data.forecasts ?? null);
      setPendingRecurring(data.pendingRecurring);
      notifyMoneyUpdated();
      setNotice("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPayday(body: Record<string, unknown>) {
    setBusy(true);
    setNotice(null);
    try {
      const data = await fetchJson<{
        profile: KashuProfileFields;
        forecast: KashuForecast;
        forecasts: KashuForecastBundle | null;
        pendingRecurring: number;
        payday: { headline: string; freeToUse: number; deposit: number };
      }>("/api/kashu/payday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setProfile(data.profile);
      setForecast(data.forecast);
      setForecasts(data.forecasts ?? null);
      setPendingRecurring(data.pendingRecurring);
      notifyMoneyUpdated();
      setNotice(data.payday.headline);
      setTab("home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payday confirm failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kashu-shell space-y-6 p-4 sm:p-6">
      <header className="relative overflow-hidden rounded-[1.35rem] border border-slate-200/90 bg-white px-5 py-6 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)] sm:px-8">
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
                <ProductSuiteIcon id="kashu" className="h-8 w-8" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Cash-Flow Calendar
                </p>
                <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                  Kashu
                </h1>
              </div>
            </div>
            <p className="mt-3 max-w-xl text-sm text-slate-600 sm:text-base">
              {brand.tagline} Upload statements or enter balances — no bank connect required.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 gap-2 rounded-full"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {forecast ? (
          <div className="relative mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Safe to Spend
            </p>
            <p className="mt-1 font-display text-5xl font-semibold tracking-tight text-[var(--kashu-pay)] sm:text-6xl">
              {money(forecast.safeToSpend)}
            </p>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">{forecast.message}</p>
            {forecasts && profile?.incomeKind === "VARIABLE" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ["conservative", "Conservative"],
                    ["expected", "Expected"],
                    ["high", "High"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => void selectIncomeScenario(id)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold ring-1 transition",
                      incomeScenario === id
                        ? "bg-[var(--kashu-pay)] text-white ring-[var(--kashu-pay)]"
                        : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {label}
                    <span className="ml-1 opacity-80">
                      {money(forecasts[id].safeToSpend)}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3 text-xs sm:text-sm">
              <MetricChip label="Balance" value={money(forecast.liquidBalance)} />
              <MetricChip label="Reserved" value={money(forecast.reservedObligations)} />
              <MetricChip label="Safety floor" value={money(forecast.safetyFloor)} />
              <MetricChip
                label="Projected low"
                value={`${money(forecast.projectedLow)}${forecast.projectedLowDate ? ` · ${forecast.projectedLowDate}` : ""}`}
              />
              <MetricChip
                label="Next payday"
                value={
                  forecast.nextPayday
                    ? `${forecast.nextPayday}${forecast.daysUntilPayday != null ? ` · ${forecast.daysUntilPayday}d` : ""}`
                    : "Set payday"
                }
              />
              <MetricChip
                label="Model confidence"
                value={`${Math.round((forecast.forecastConfidence ?? 0) * 100)}%`}
              />
            </div>
          </div>
        ) : null}
      </header>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}

      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1" aria-label="Kashu sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              if (t.id === "calendar" && (forecast?.horizonDays ?? 0) < 90) {
                void refresh({ horizonDays: 90 });
              }
            }}
            className={cn(
              "kashu-nav-pill shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition",
              tab === t.id
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            )}
          >
            {t.label}
            {(t.id === "bills" || t.id === "upload") && pendingRecurring > 0 ? (
              <span className="ml-1 rounded-full bg-[var(--kashu-life)] px-1.5 text-[10px] text-white">
                {pendingRecurring}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {loading && !forecast ? (
        <p className="text-sm text-forward-500">Loading cash-flow model…</p>
      ) : null}

      {tab === "home" && forecast && profile ? (
        <HomeTab
          forecast={forecast}
          profile={profile}
          pendingRecurring={pendingRecurring}
          onOpenUpload={() => setTab("upload")}
          onOpenBuffers={() => setTab("buffers")}
          onOpenBills={() => setTab("bills")}
          onOpenPayday={() => setTab("payday")}
          onOpenCalendar={() => {
            setTab("calendar");
            if ((forecast?.horizonDays ?? 0) < 90) void refresh({ horizonDays: 90 });
          }}
          onOpenAsk={() => setTab("ask")}
        />
      ) : null}
      {tab === "radar" && forecast ? (
        <RadarTab
          forecast={forecast}
          onHorizonChange={(d) => void refresh({ horizonDays: d })}
        />
      ) : null}
      {tab === "calendar" && forecast ? (
        <KashuCalendar
          forecast={forecast}
          onNeedHorizon={(d) => void refresh({ horizonDays: d })}
        />
      ) : null}
      {tab === "bills" ? (
        <div className="kashu-panel space-y-4 p-4 md:p-6">
          <CoachSetupMoneyNudge />
          <KashuRecurringConfirmPanel
            candidates={candidates}
            busy={busy}
            setBusy={setBusy}
            setNotice={setNotice}
            setError={setError}
            onDone={async () => {
              await refresh();
              notifyMoneyUpdated();
            }}
            onOpenCalendar={() => {
              setTab("calendar");
              if ((forecast?.horizonDays ?? 0) < 90) void refresh({ horizonDays: 90 });
            }}
          />
          <div id="commitments" className="kashu-panel space-y-3 p-4 md:p-6">
            <h2 className="text-lg font-semibold text-slate-900">All commitments</h2>
            <p className="text-sm leading-snug text-slate-600">
              Confirmed bills live here too. Use the panel above to select &amp; confirm for Timing —
              then edit details here anytime.
            </p>
            <div className="mt-2">
              <MoneyPanel appearance="light" />
            </div>
          </div>
        </div>
      ) : null}
      {tab === "upload" ? (
        <KashuStatementUpload
          candidates={candidates}
          busy={busy}
          setBusy={setBusy}
          setNotice={setNotice}
          setError={setError}
          onDone={async () => {
            await refresh();
            notifyMoneyUpdated();
          }}
          onOpenCalendar={() => {
            setTab("calendar");
            if ((forecast?.horizonDays ?? 0) < 90) void refresh({ horizonDays: 90 });
          }}
          onOpenTiming={() => setTab("timing")}
        />
      ) : null}
      {tab === "buffers" && profile ? (
        <BuffersTab profile={profile} busy={busy} onSave={patchProfile} />
      ) : null}
      {tab === "payday" && profile && forecast ? (
        <PaydayTab
          profile={profile}
          forecast={forecast}
          busy={busy}
          onConfirm={(body) => void confirmPayday(body)}
        />
      ) : null}
      {tab === "timing" && forecast ? (
        <TimingTab
          forecast={forecast}
          pendingRecurring={pendingRecurring}
          onOpenBills={() => setTab("bills")}
          onOpenBuffers={() => setTab("buffers")}
        />
      ) : null}
      {tab === "whatif" && forecast ? <WhatIfTab forecast={forecast} /> : null}
      {tab === "ask" ? (
        <AskTab
          forecast={forecast}
          onApplied={async () => {
            await refresh();
            notifyMoneyUpdated();
          }}
        />
      ) : null}
      {tab === "transition" && profile ? (
        <TransitionTab profile={profile} busy={busy} onSave={patchProfile} />
      ) : null}
      {tab === "engine" ? (
        <div className="space-y-6">
          <LifeFinanceEnginePanel />
          <MoneyImprovementPanel />
          <DomainNextActionHero domain="money" />
        </div>
      ) : null}
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="kashu-kpi inline-flex items-center gap-1.5 text-slate-700">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </span>
  );
}

function HomeTab({
  forecast,
  profile,
  pendingRecurring,
  onOpenUpload,
  onOpenBuffers,
  onOpenBills,
  onOpenPayday,
  onOpenCalendar,
  onOpenAsk,
}: {
  forecast: KashuForecast;
  profile: KashuProfileFields;
  pendingRecurring: number;
  onOpenUpload: () => void;
  onOpenBuffers: () => void;
  onOpenBills: () => void;
  onOpenPayday: () => void;
  onOpenCalendar: () => void;
  onOpenAsk: () => void;
}) {
  const steps = [
    {
      id: "income",
      done: (profile.monthlyTakeHome ?? 0) > 0 && Boolean(profile.nextPayday),
      title: "Income & payday",
      body:
        profile.incomeKind === "VARIABLE"
          ? "Variable income bands + next payday."
          : "Typical take-home, pay frequency, next payday.",
      action: onOpenBuffers,
      cta: "Set income",
    },
    {
      id: "balance",
      done: profile.liquidBalance != null,
      title: "Current balance & floor",
      body: "Operating balance, safety floor, emergency reserve.",
      action: onOpenBuffers,
      cta: "Set buffers",
    },
    {
      id: "upload",
      done: forecast.radar.length > 0 || pendingRecurring > 0,
      title: "Upload a statement",
      body: "PDF or CSV — Kashu learns patterns without bank login.",
      action: onOpenUpload,
      cta: "Upload",
    },
    {
      id: "confirm",
      done: pendingRecurring === 0 && forecast.reservedObligations > 0,
      title: "Confirm obligations",
      body:
        pendingRecurring > 0
          ? `${pendingRecurring} recurring suggestion${pendingRecurring === 1 ? "" : "s"} waiting.`
          : "Confirm bills so Safe to Spend stays accurate.",
      action: onOpenBills,
      cta: pendingRecurring > 0 ? "Confirm on Bills" : "Add bills",
    },
  ];
  const incomplete = steps.filter((s) => !s.done);
  const paydaySoon =
    forecast.daysUntilPayday != null && forecast.daysUntilPayday <= 2;

  return (
    <div className="space-y-4">
      <KashuLifeOsCard insights={forecast.lifeOsInsights ?? []} />
      {paydaySoon || (forecast.daysUntilPayday === 0) ? (
        <div className="kashu-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
              Payday Mode
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              Confirm pay landed — see what isn&apos;t already spoken for.
            </p>
          </div>
          <Button type="button" className="rounded-full bg-[var(--kashu-pay)] hover:bg-emerald-700" onClick={onOpenPayday}>
            Open Payday Mode
          </Button>
        </div>
      ) : null}
      {incomplete.length > 0 ? (
        <div className="kashu-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
              Talk to Kashu
            </p>
            <p className="mt-1 text-sm text-slate-700">
              Skip the forms — say your income, payday, and bills in your own words. Kashu drafts the
              model; you confirm.
            </p>
          </div>
          <Button type="button" variant="secondary" className="rounded-full" onClick={onOpenAsk}>
            Open Ask Kashu
          </Button>
        </div>
      ) : null}
      {incomplete.length > 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 md:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
            Build your money model
          </p>
          <h2 className="mt-1 text-lg font-semibold text-forward-900">
            Upload → Understand → Confirm → Predict
          </h2>
          <p className="mt-1 text-sm text-forward-600">
            No bank connection. Tell Kashu what matters so Safe to Spend is real.
          </p>
          <ul className="mt-4 space-y-2">
            {steps.map((step) => (
              <li
                key={step.id}
                className="flex flex-col gap-2 rounded-xl border border-emerald-100 bg-white/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-forward-900">
                    <span className={step.done ? "text-emerald-700" : "text-forward-400"}>
                      {step.done ? "✓" : "○"}
                    </span>{" "}
                    {step.title}
                  </p>
                  <p className="text-xs text-forward-500">{step.body}</p>
                </div>
                {!step.done ? (
                  <Button type="button" size="sm" onClick={step.action}>
                    {step.cta}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            title: "Protect what matters",
            body: `${money(forecast.reservedObligations)} reserved through next payday.`,
            Icon: Shield,
            action: onOpenBills as (() => void) | undefined,
          },
          {
            title: "See the month",
            body: `Paydays and bills on a calendar — leftover day by day.`,
            Icon: LineChart,
            action: onOpenCalendar,
          },
          {
            title: "Spend with confidence",
            body: `${money(forecast.safeToSpend)} available without breaking the plan.`,
            Icon: Wallet,
            action: onOpenAsk as (() => void) | undefined,
          },
        ].map(({ title, body, Icon, action }) => (
          <button
            key={title}
            type="button"
            onClick={action}
            className="rounded-2xl border border-forward-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40"
          >
            <Icon className="h-5 w-5 text-emerald-700" />
            <p className="mt-2 text-sm font-semibold text-forward-900">{title}</p>
            <p className="mt-1 text-xs text-forward-500">{body}</p>
          </button>
        ))}
      </div>

      {forecast.collisions.length > 0 ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">Cash-flow collisions</p>
          <ul className="mt-2 space-y-1 text-sm text-red-800">
            {forecast.collisions.slice(0, 5).map((c) => (
              <li key={`${c.date}-${c.title}`}>
                {c.date}: {c.title} — short {money(c.shortfall)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {forecast.emergencyInsight ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Emergency reserve</p>
          <p className="mt-1">{forecast.emergencyInsight.message}</p>
        </div>
      ) : forecast.emergencyReserve > 0 && forecast.safeToSpendShortfall > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Shortfall predicted: {money(forecast.safeToSpendShortfall)}. Your emergency reserve (
          {money(forecast.emergencyReserve)}) can cover this, but the reserve would fall to{" "}
          {money(Math.max(0, forecast.emergencyReserve - forecast.safeToSpendShortfall))}.
        </div>
      ) : null}

      <button
        type="button"
        onClick={onOpenUpload}
        className="flex w-full items-center justify-between rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-4 text-left transition hover:bg-emerald-50"
      >
        <span>
          <span className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <Upload className="h-4 w-4" />
            Drop statements &amp; screenshots — Kashu consolidates
          </span>
          <span className="mt-1 block text-xs text-emerald-800/80">
            Multi-file PDF, CSV, TXT, or photos. One scan → payroll + bills on the calendar.
          </span>
        </span>
        <Sparkles className="h-5 w-5 text-emerald-700" />
      </button>
    </div>
  );
}

function RadarTab({
  forecast,
  onHorizonChange,
}: {
  forecast: KashuForecast;
  onHorizonChange: (days: 14 | 30 | 60 | 90) => void;
}) {
  const horizons = [14, 30, 60, 90] as const;
  const waves = forecast.billWaves ?? [];

  return (
    <div className="space-y-4">
      <div className="kashu-panel flex flex-wrap items-center justify-between gap-2 p-4">
        <p className="text-sm text-slate-600">
          Your next {forecast.horizonDays} days. Green = covered, yellow = near floor, red =
          collision.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {horizons.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onHorizonChange(d)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition",
                forecast.horizonDays === d
                  ? "bg-[var(--kashu-pay)] text-white shadow-sm"
                  : "bg-white text-slate-600 ring-1 ring-emerald-100 hover:bg-emerald-50"
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {waves.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-forward-500">
            Bill waves — which paycheck funds what
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {waves.map((w) => (
              <div
                key={w.id}
                className={cn("rounded-2xl border p-3", statusColor(w.status))}
              >
                <p className="text-sm font-semibold">{w.label}</p>
                <p className="mt-1 text-lg font-semibold">{money(w.totalObligations)}</p>
                <p className="mt-1 text-[11px] opacity-80">
                  {w.eventIds.length} obligation{w.eventIds.length === 1 ? "" : "s"}
                  {w.fundingPayday ? ` · funded by ${w.fundingPayday}` : " · before next payday"}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="kashu-panel overflow-x-auto p-3 pb-2">
        <div className="flex min-w-max gap-2">
          {forecast.radar.map((ev) => (
            <div
              key={ev.id}
              className={cn(
                "kashu-event-bubble w-40 shrink-0 rounded-2xl border p-3 shadow-sm",
                statusColor(ev.status)
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                {ev.date} · {ev.kind}
              </p>
              <p className="mt-1 truncate text-sm font-semibold">{ev.title}</p>
              <p className="mt-1 text-lg font-semibold">
                {ev.kind === "payday" || ev.kind === "income" ? "+" : "-"}
                {money(ev.amount)}
              </p>
              <p className="mt-1 text-[11px] opacity-80">Bal {money(ev.balanceAfter)}</p>
              {ev.kind === "obligation" && ev.fundingPayday ? (
                <p className="mt-1 text-[10px] opacity-70">Funded by {ev.fundingPayday}</p>
              ) : null}
            </div>
          ))}
          {forecast.radar.length === 0 ? (
            <p className="text-sm text-forward-500">
              Add bills or upload a statement to populate the radar.
            </p>
          ) : null}
        </div>
      </div>
      <div className="kashu-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
          Daily projected ending balance
        </p>
        <div className="mt-3 flex h-24 items-end gap-0.5">
          {forecast.days.map((d) => {
            const max = Math.max(
              ...forecast.days.map((x) => Math.abs(x.endingBalance)),
              forecast.safetyFloor,
              1
            );
            const h = Math.max(4, Math.round((Math.abs(d.endingBalance) / max) * 88));
            return (
              <div
                key={d.date}
                title={`${d.date}: ${money(d.endingBalance)}`}
                className={cn(
                  "flex-1 rounded-t",
                  d.status === "red"
                    ? "bg-red-400"
                    : d.status === "yellow"
                      ? "bg-amber-400"
                      : "bg-emerald-500"
                )}
                style={{ height: h }}
              />
            );
          })}
        </div>
      </div>

      {forecast.collisions.length > 0 ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">Cash-flow collisions</p>
          <p className="mt-1 text-xs text-red-700/90">
            Income may be enough for the month, but payment timing creates a gap.
          </p>
          <ul className="mt-3 space-y-2">
            {forecast.collisions.slice(0, 6).map((c) => (
              <li key={`${c.date}-${c.title}`} className="text-sm text-red-900">
                <span className="font-semibold">{c.date}</span> — {c.title}: shortfall{" "}
                {money(c.shortfall)} (projected {money(c.projectedBalance)})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function BuffersTab({
  profile,
  busy,
  onSave,
}: {
  profile: KashuProfileFields;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [liquidBalance, setLiquidBalance] = useState(String(profile.liquidBalance ?? ""));
  const [safetyFloor, setSafetyFloor] = useState(String(profile.safetyFloor ?? 0));
  const [emergencyReserve, setEmergencyReserve] = useState(String(profile.emergencyReserve ?? 0));
  const [lifestyleBurnDaily, setLifestyleBurnDaily] = useState(
    String(profile.lifestyleBurnDaily ?? 0)
  );
  const [monthlyTakeHome, setMonthlyTakeHome] = useState(String(profile.monthlyTakeHome ?? ""));
  const [incomeKind, setIncomeKind] = useState<KashuIncomeKind>(profile.incomeKind ?? "FIXED");
  const [incomeConservative, setIncomeConservative] = useState(
    String(profile.incomeConservative ?? "")
  );
  const [incomeHigh, setIncomeHigh] = useState(String(profile.incomeHigh ?? ""));
  const [payFrequency, setPayFrequency] = useState(profile.payFrequency ?? "BIWEEKLY");
  const [nextPayday, setNextPayday] = useState(
    profile.nextPayday ? profile.nextPayday.slice(0, 10) : ""
  );

  useEffect(() => {
    setLiquidBalance(String(profile.liquidBalance ?? ""));
    setSafetyFloor(String(profile.safetyFloor ?? 0));
    setEmergencyReserve(String(profile.emergencyReserve ?? 0));
    setLifestyleBurnDaily(String(profile.lifestyleBurnDaily ?? 0));
    setMonthlyTakeHome(String(profile.monthlyTakeHome ?? ""));
    setIncomeKind(profile.incomeKind ?? "FIXED");
    setIncomeConservative(String(profile.incomeConservative ?? ""));
    setIncomeHigh(String(profile.incomeHigh ?? ""));
    setPayFrequency(profile.payFrequency ?? "BIWEEKLY");
    setNextPayday(profile.nextPayday ? profile.nextPayday.slice(0, 10) : "");
  }, [profile]);

  return (
    <form
      className="kashu-panel space-y-4 p-4 md:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({
          liquidBalance: liquidBalance === "" ? null : Number(liquidBalance),
          safetyFloor: Number(safetyFloor) || 0,
          emergencyReserve: Number(emergencyReserve) || 0,
          lifestyleBurnDaily: Number(lifestyleBurnDaily) || 0,
          monthlyTakeHome: monthlyTakeHome === "" ? null : Number(monthlyTakeHome),
          incomeKind,
          incomeConservative:
            incomeKind === "VARIABLE"
              ? incomeConservative === ""
                ? null
                : Number(incomeConservative)
              : null,
          incomeHigh:
            incomeKind === "VARIABLE"
              ? incomeHigh === ""
                ? null
                : Number(incomeHigh)
              : null,
          payFrequency,
          nextPayday: nextPayday ? new Date(`${nextPayday}T12:00:00`).toISOString() : null,
        });
      }}
    >
      <h2 className="text-lg font-semibold text-forward-900">Income, balance & buffers</h2>
      <p className="text-sm text-forward-500">
        Safe to Spend = Balance − Reserved obligations − Safety floor. Emergency reserve stays
        protected and is never treated as spendable.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="text-forward-600">Income type</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {(
              [
                ["FIXED", "Fixed / guaranteed"],
                ["VARIABLE", "Variable (tips, commission, gig)"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setIncomeKind(id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
                  incomeKind === id
                    ? "bg-emerald-700 text-white ring-emerald-700"
                    : "bg-white text-forward-700 ring-forward-200"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </label>
        <label className="text-sm">
          <span className="text-forward-600">
            {incomeKind === "VARIABLE" ? "Expected monthly take-home (net)" : "Typical monthly take-home (net)"}
          </span>
          <Input
            className="mt-1"
            type="number"
            min={0}
            step="0.01"
            value={monthlyTakeHome}
            onChange={(e) => setMonthlyTakeHome(e.target.value)}
            placeholder="7400"
          />
        </label>
        <label className="text-sm">
          <span className="text-forward-600">Pay frequency</span>
          <select
            className="mt-1 w-full rounded-xl border border-forward-200 px-3 py-2"
            value={payFrequency}
            onChange={(e) => setPayFrequency(e.target.value as typeof payFrequency)}
          >
            <option value="WEEKLY">Weekly</option>
            <option value="BIWEEKLY">Biweekly</option>
            <option value="SEMI_MONTHLY">Semi-monthly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="IRREGULAR">Irregular</option>
          </select>
        </label>
        {incomeKind === "VARIABLE" ? (
          <>
            <label className="text-sm">
              <span className="text-forward-600">Conservative monthly (funds obligations)</span>
              <Input
                className="mt-1"
                type="number"
                min={0}
                step="0.01"
                value={incomeConservative}
                onChange={(e) => setIncomeConservative(e.target.value)}
                placeholder="5200"
              />
            </label>
            <label className="text-sm">
              <span className="text-forward-600">High / upside monthly</span>
              <Input
                className="mt-1"
                type="number"
                min={0}
                step="0.01"
                value={incomeHigh}
                onChange={(e) => setIncomeHigh(e.target.value)}
                placeholder="9000"
              />
            </label>
          </>
        ) : null}
        <label className="text-sm">
          <span className="text-forward-600">Next payday</span>
          <Input
            className="mt-1"
            type="date"
            value={nextPayday}
            onChange={(e) => setNextPayday(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="text-forward-600">Today&apos;s actual account balance</span>
          <Input
            className="mt-1"
            type="number"
            step="0.01"
            value={liquidBalance}
            onChange={(e) => setLiquidBalance(e.target.value)}
            placeholder="812.37 or -150.00"
          />
          <span className="mt-1 block text-[11px] text-forward-400">
            Enter what your bank shows today — negative overdraft balances are allowed.
          </span>
        </label>
        <label className="text-sm">
          <span className="text-forward-600">Safety floor</span>
          <Input
            className="mt-1"
            type="number"
            min={0}
            value={safetyFloor}
            onChange={(e) => setSafetyFloor(e.target.value)}
          />
          <span className="mt-1 flex flex-wrap gap-1.5">
            {[250, 500, 1000].map((n) => (
              <button
                key={n}
                type="button"
                className="rounded-full bg-forward-100 px-2 py-0.5 text-[11px] font-medium text-forward-700"
                onClick={() => setSafetyFloor(String(n))}
              >
                ${n}
              </button>
            ))}
          </span>
        </label>
        <label className="text-sm">
          <span className="text-forward-600">Emergency reserve</span>
          <Input
            className="mt-1"
            type="number"
            min={0}
            value={emergencyReserve}
            onChange={(e) => setEmergencyReserve(e.target.value)}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="text-forward-600">Daily lifestyle burn (optional)</span>
          <Input
            className="mt-1"
            type="number"
            min={0}
            value={lifestyleBurnDaily}
            onChange={(e) => setLifestyleBurnDaily(e.target.value)}
          />
        </label>
      </div>
      <Button type="submit" disabled={busy}>
        Save income & buffers
      </Button>
    </form>
  );
}

function PaydayTab({
  profile,
  forecast,
  busy,
  onConfirm,
}: {
  profile: KashuProfileFields;
  forecast: KashuForecast;
  busy: boolean;
  onConfirm: (body: Record<string, unknown>) => void;
}) {
  const [mode, setMode] = useState<"balance" | "deposit">("balance");
  const [newBalance, setNewBalance] = useState(String(profile.liquidBalance ?? ""));
  const [depositAmount, setDepositAmount] = useState("");

  useEffect(() => {
    setNewBalance(String(profile.liquidBalance ?? ""));
  }, [profile.liquidBalance]);

  const previewDeposit =
    mode === "deposit"
      ? Number(depositAmount) || 0
      : Math.max(0, (Number(newBalance) || 0) - (profile.liquidBalance ?? 0));

  return (
    <div className="kashu-panel space-y-4 p-4 md:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
          Payday Mode
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">
          Confirm pay — then see what isn&apos;t spoken for
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Payday is an event. After you update the balance, Kashu recalculates Safe to Spend so you
          know how much of the deposit is already reserved.
        </p>
      </div>

      <div className="rounded-xl border border-emerald-100 bg-white/90 p-4 text-sm text-slate-700">
        <p>
          Right now: {money(forecast.safeToSpend)} Safe to Spend ·{" "}
          {money(forecast.reservedObligations)} reserved · floor {money(forecast.safetyFloor)}
        </p>
        {forecast.nextPayday ? (
          <p className="mt-1 text-xs text-forward-500">
            Next modeled payday: {forecast.nextPayday}
            {forecast.daysUntilPayday != null ? ` (${forecast.daysUntilPayday}d)` : ""}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
            mode === "balance"
              ? "bg-teal-700 text-white ring-teal-700"
              : "bg-white text-forward-700 ring-forward-200"
          )}
          onClick={() => setMode("balance")}
        >
          Enter new balance
        </button>
        <button
          type="button"
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
            mode === "deposit"
              ? "bg-teal-700 text-white ring-teal-700"
              : "bg-white text-forward-700 ring-forward-200"
          )}
          onClick={() => setMode("deposit")}
        >
          Enter deposit amount
        </button>
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === "balance") {
            onConfirm({
              newBalance: Number(newBalance) || 0,
              advanceNextPayday: true,
            });
          } else {
            onConfirm({
              depositAmount: Number(depositAmount) || 0,
              advanceNextPayday: true,
            });
          }
        }}
      >
        {mode === "balance" ? (
          <label className="block text-sm">
            <span className="text-forward-600">Operating balance after payday</span>
            <Input
              className="mt-1"
              type="number"
              min={0}
              step="0.01"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              required
            />
          </label>
        ) : (
          <label className="block text-sm">
            <span className="text-forward-600">Deposit that just landed</span>
            <Input
              className="mt-1"
              type="number"
              min={0}
              step="0.01"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              required
            />
          </label>
        )}
        {previewDeposit > 0 ? (
          <p className="text-sm text-teal-900">
            Confirming about {money(previewDeposit)} — Kashu will tell you how much of that isn&apos;t
            already spoken for.
          </p>
        ) : null}
        <Button type="submit" disabled={busy}>
          Confirm payday &amp; recalculate
        </Button>
      </form>
    </div>
  );
}

function TimingTab({
  forecast,
  pendingRecurring,
  onOpenBills,
  onOpenBuffers,
}: {
  forecast: KashuForecast;
  pendingRecurring: number;
  onOpenBills: () => void;
  onOpenBuffers: () => void;
}) {
  const floor = forecast.safetyFloor ?? 0;
  const underfunded = forecast.projectedLow <= floor + 25;
  return (
    <div className="kashu-panel space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
            Linked to Bills · Calendar · Buffers
          </p>
          <h2 className="text-lg font-black text-slate-900">Bill Timing Optimizer</h2>
        </div>
        <span className="kashu-chip">Cash-map engine</span>
      </div>
      <p className="text-sm text-slate-600">
        Each tip below is an alternative versus doing nothing — do not add the dollar lifts together.
        Only moves that raise the projected low by a meaningful amount are shown. Ask each provider
        to change the date; Kashu does not move money for you.
      </p>
      {underfunded ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-950">
          <p className="font-bold">
            You&apos;re still running short (projected low {money(forecast.projectedLow)}
            {forecast.projectedLowDate ? ` on ${forecast.projectedLowDate}` : ""})
          </p>
          <p className="mt-1 text-rose-900/90">
            Timing can only soften when bills hit. If the low stays negative, raise today&apos;s
            balance in Buffers or cut daily burn — due dates cannot invent cash. Confirm Buffers
            matches your real checking balance (statements should drive this when Buffers is empty).
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-2 rounded-full"
            onClick={onOpenBuffers}
          >
            Open Buffers
          </Button>
        </div>
      ) : null}
      {pendingRecurring > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950">
          <p className="font-semibold">
            {pendingRecurring} bill{pendingRecurring === 1 ? "" : "s"} waiting for confirmation
          </p>
          <p className="mt-1 text-amber-900/80">
            Timing needs confirmed due days. Open Bills, select what looks right, and hit Confirm
            selected.
          </p>
          <Button type="button" size="sm" className="mt-3 rounded-full" onClick={onOpenBills}>
            Review &amp; confirm on Bills
          </Button>
        </div>
      ) : null}
      {forecast.timingScenarios.length === 0 ? (
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            {underfunded
              ? `No material due-date lift found. Projected low ${money(forecast.projectedLow)}${
                  forecast.projectedLowDate ? ` on ${forecast.projectedLowDate}` : ""
                } — fix funding in Buffers first.`
              : `No timing improvements found yet${
                  forecast.collisions.length > 0
                    ? ` — even though ${forecast.collisions.length} collision${forecast.collisions.length === 1 ? "" : "s"} exist`
                    : ""
                }.`}
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              On Bills, confirm every statement bill with type (housing / tax / utility), frequency,
              and due day 1–28.
            </li>
            <li>Set your next payday and today&apos;s balance in Buffers.</li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" size="sm" className="rounded-full bg-slate-900 hover:bg-slate-800" onClick={onOpenBills}>
              Open Bills → Confirm
            </Button>
            <Button type="button" size="sm" variant="secondary" className="rounded-full" onClick={onOpenBuffers}>
              Open Buffers
            </Button>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {forecast.timingScenarios.map((s) => {
            const lift = s.projectedLow - forecast.projectedLow;
            const stillShort = s.projectedLow < floor;
            const isCoach = s.billId === "underfunded" || s.currentDueDay === 0;
            return (
              <li
                key={`${s.billId}-${s.moveToDay}-${s.moves?.length ?? 0}`}
                className={cn(
                  "kashu-scenario-card text-sm text-slate-800",
                  stillShort || isCoach ? "border-rose-200 bg-rose-50/40" : "border-emerald-200"
                )}
              >
                <p className="font-bold text-slate-900">
                  {isCoach
                    ? s.billTitle
                    : s.moves && s.moves.length > 1
                      ? `Spread plan · ${s.moves.length} bills`
                      : `${s.billTitle}: day ${s.currentDueDay} → ${s.moveToDay}`}
                </p>
                {s.moves && s.moves.length > 1 ? (
                  <ul className="mt-2 space-y-1 text-xs text-slate-700">
                    {s.moves.map((m) => (
                      <li key={m.billId}>
                        <span className="font-semibold">{m.billTitle}</span>: {m.currentDueDay} →{" "}
                        {m.moveToDay}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-1 leading-snug">{s.note}</p>
                {!isCoach ? (
                  <p
                    className={cn(
                      "mt-2 text-xs font-bold",
                      stillShort || s.projectedLow < 0 ? "text-rose-800" : "text-emerald-800"
                    )}
                  >
                    {s.projectedLow < 0
                      ? `Alone: softens to ${money(s.projectedLow)} (${lift >= 0 ? "+" : ""}${money(lift)}) — still negative`
                      : stillShort
                        ? `Alone: softens to ${money(s.projectedLow)} (${lift >= 0 ? "+" : ""}${money(lift)}) — still under your ${money(floor)} floor`
                        : `Alone: projected low becomes ${money(s.projectedLow)} (${lift >= 0 ? "+" : ""}${money(lift)})`}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function WhatIfTab({ forecast }: { forecast: KashuForecast }) {
  const [mode, setMode] = useState<"spend" | "bonus" | "cut" | "bill">("spend");
  const [spendToday, setSpendToday] = useState("400");
  const [bonusDelta, setBonusDelta] = useState("500");
  const [lowerIncomeBy, setLowerIncomeBy] = useState("400");
  const [cutLifestyleDaily, setCutLifestyleDaily] = useState("15");
  const [billTitle, setBillTitle] = useState("New car payment");
  const [billAmount, setBillAmount] = useState("450");
  const [billDueDay, setBillDueDay] = useState("15");
  const [result, setResult] = useState<KashuWhatIfResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const data = await fetchJson<KashuWhatIfResult>("/api/kashu/what-if", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed.");
    } finally {
      setBusy(false);
    }
  }

  function runActive() {
    if (mode === "spend") {
      void run({ spendToday: Number(spendToday) || 0 });
    } else if (mode === "bonus") {
      void run({ bonusDelta: Number(bonusDelta) || 0 });
    } else if (mode === "cut") {
      const lower = Number(lowerIncomeBy) || 0;
      const cut = Number(cutLifestyleDaily) || 0;
      void run({
        ...(lower > 0 ? { lowerIncomeBy: lower } : {}),
        ...(cut > 0 ? { cutLifestyleDaily: cut } : {}),
      });
    } else {
      void run({
        newMonthlyBill: {
          title: billTitle.trim() || "New bill",
          amount: Number(billAmount) || 0,
          dueDay: Math.min(31, Math.max(1, Number(billDueDay) || 1)),
        },
      });
    }
  }

  const verdictStyles =
    result?.verdict === "yes"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : result?.verdict === "caution"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-red-200 bg-red-50 text-red-950";

  return (
    <div className="kashu-panel space-y-4 p-4 md:p-6">
      <div>
        <h2 className="text-lg font-semibold text-forward-900">Can I afford it?</h2>
        <p className="mt-1 text-sm text-forward-500">
          Kashu does not only compare a purchase to today&apos;s balance — it simulates the
          forecast and checks whether obligations stay covered.
        </p>
        <p className="mt-2 text-xs text-forward-500">
          Current Safe to Spend:{" "}
          <span className="font-semibold text-forward-800">{money(forecast.safeToSpend)}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["spend", "Spend today"],
            ["bonus", "Bonus / raise"],
            ["cut", "Lower income / cut burn"],
            ["bill", "New monthly bill"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMode(id);
              setResult(null);
            }}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
              mode === id
                ? "bg-emerald-700 text-white ring-emerald-700"
                : "bg-white text-forward-700 ring-forward-200"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "spend" ? (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-forward-600">What if I spend this today?</span>
            <Input
              className="mt-1 max-w-xs"
              type="number"
              min={0}
              value={spendToday}
              onChange={(e) => setSpendToday(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[50, 100, 250, 400, 600, 1000].map((n) => (
              <button
                key={n}
                type="button"
                className="rounded-full bg-forward-100 px-2.5 py-1 text-[11px] font-medium text-forward-700"
                onClick={() => setSpendToday(String(n))}
              >
                ${n}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {mode === "bonus" ? (
        <label className="block text-sm">
          <span className="text-forward-600">Extra on next payday</span>
          <Input
            className="mt-1 max-w-xs"
            type="number"
            value={bonusDelta}
            onChange={(e) => setBonusDelta(e.target.value)}
          />
        </label>
      ) : null}

      {mode === "cut" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-forward-600">Lower next payday by</span>
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={lowerIncomeBy}
              onChange={(e) => setLowerIncomeBy(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-forward-600">Cut daily lifestyle burn by</span>
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={cutLifestyleDaily}
              onChange={(e) => setCutLifestyleDaily(e.target.value)}
            />
          </label>
        </div>
      ) : null}

      {mode === "bill" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm sm:col-span-1">
            <span className="text-forward-600">Title</span>
            <Input
              className="mt-1"
              value={billTitle}
              onChange={(e) => setBillTitle(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-forward-600">Amount / month</span>
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-forward-600">Due day</span>
            <Input
              className="mt-1"
              type="number"
              min={1}
              max={31}
              value={billDueDay}
              onChange={(e) => setBillDueDay(e.target.value)}
            />
          </label>
        </div>
      ) : null}

      <Button type="button" disabled={busy} onClick={runActive}>
        {busy ? "Simulating…" : mode === "spend" ? "Can I afford this?" : "Run simulation"}
      </Button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {result ? (
        <div className={cn("space-y-3 rounded-xl border p-4 text-sm", verdictStyles)}>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">
            {result.verdict === "yes"
              ? "Yes"
              : result.verdict === "caution"
                ? "Caution"
                : "No"}
          </p>
          <p className="text-base font-semibold">{result.verdictLabel}</p>
          <p className="opacity-90">{result.explanation}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-white/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide opacity-70">Safe to Spend</p>
              <p className="font-semibold">
                {money(result.baseline.safeToSpend)} → {money(result.scenario.safeToSpend)}
              </p>
            </div>
            <div className="rounded-lg bg-white/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide opacity-70">Projected low</p>
              <p className="font-semibold">
                {money(result.baseline.projectedLow)} → {money(result.scenario.projectedLow)}
              </p>
            </div>
            <div className="rounded-lg bg-white/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide opacity-70">Obligations</p>
              <p className="font-semibold">
                {result.obligationsCovered ? "Covered" : "Collision risk"}
              </p>
            </div>
          </div>
          {result.scenario.collisions.length > 0 ? (
            <ul className="space-y-1 text-xs">
              {result.scenario.collisions.slice(0, 4).map((c) => (
                <li key={`${c.date}-${c.title}`}>
                  {c.date}: {c.title} — short {money(c.shortfall)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AskTab({
  forecast,
  onApplied,
}: {
  forecast: KashuForecast | null;
  onApplied: () => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Array<KashuChatTurn & { proposals?: KashuProposal[] }>>(
    [
      {
        role: "kashu",
        text: "Tell me how money moves — income, payday, bills, balance — in your own words. I’ll draft the model; nothing is saved until you confirm.",
      },
    ]
  );
  const [pending, setPending] = useState<KashuProposal[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string, apply?: KashuProposal[]) {
    const trimmed = text.trim();
    if (!trimmed && !apply?.length) return;
    setBusy(true);
    setError(null);
    if (trimmed) {
      setMessages((m) => [...m, { role: "user", text: trimmed }]);
      setDraft("");
    }
    try {
      const history: KashuChatTurn[] = [
        ...messages.map(({ role, text: t }) => ({ role, text: t })),
        ...(trimmed ? [{ role: "user" as const, text: trimmed }] : []),
      ];
      const data = await fetchJson<KashuAskResponse>("/api/kashu/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed || undefined,
          history,
          pendingProposals: pending,
          apply,
        }),
      });
      setMessages((m) => [
        ...m,
        { role: "kashu", text: data.answer, proposals: data.proposals },
      ]);
      const appliedIds = new Set((apply ?? []).map((p) => p.id));
      if (data.applied && apply?.length) {
        setPending((prev) => {
          const rest = prev.filter((p) => !appliedIds.has(p.id));
          return data.proposals?.length ? data.proposals : rest;
        });
      } else {
        setPending(data.proposals ?? []);
      }
      if (data.applied && (data.applied.profileUpdated || data.applied.billsCreated || data.applied.billsUpdated)) {
        await onApplied();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ask failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    await send(draft);
  }

  return (
    <div className="kashu-panel space-y-4 p-4 md:p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-forward-900">
        <MessageCircle className="h-5 w-5 text-emerald-700" />
        Ask Kashu
      </h2>
      <p className="text-sm text-forward-500">
        Conversational cash-flow intelligence. Teach Kashu your money, or ask what you can safely
        spend — grounded in your model, not generic advice.
      </p>
      {forecast ? (
        <p className="text-xs text-forward-500">
          Safe to Spend now {money(forecast.safeToSpend)}
          {forecast.nextPayday ? ` · next payday ${forecast.nextPayday}` : ""}.
        </p>
      ) : null}

      <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-xl border border-forward-100 bg-forward-50/60 p-3">
        {messages.map((msg, i) => (
          <div
            key={`${msg.role}-${i}`}
            className={cn(
              "max-w-[95%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
              msg.role === "user"
                ? "ml-auto bg-emerald-700 text-white"
                : "bg-white text-forward-800 ring-1 ring-forward-100"
            )}
          >
            {msg.text}
            {msg.role === "kashu" && msg.proposals && msg.proposals.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {msg.proposals.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-start justify-between gap-2 rounded-lg bg-emerald-50 px-2 py-1.5 text-xs text-emerald-950"
                  >
                    <span>{p.label}</span>
                    <button
                      type="button"
                      className="shrink-0 rounded-full p-0.5 text-emerald-800 hover:bg-emerald-100"
                      title="Add just this"
                      onClick={() => void send("", [p])}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>

      {pending.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={() => void send("", pending)}>
            <Check className="mr-1 h-4 w-4" />
            Confirm all
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setPending([]);
              void send("skip");
            }}
          >
            <X className="mr-1 h-4 w-4" />
            Skip
          </Button>
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-3">
        <textarea
          className="min-h-[5.5rem] w-full rounded-xl border border-forward-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600/30"
          placeholder="I make $3,700 every two weeks. Next payday is Friday. Rent is $1,800 on the 1st…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy}
        />
        <div className="flex flex-wrap gap-2">
          {[
            "I make $3,700 every two weeks. Next payday is Friday.",
            "Rent is $1,800 on the 1st. Car is $380 every 14 days. Phone $85 on the 23rd.",
            "Checking is $4,200. Safety floor $500. Emergency reserve $3,000.",
            "Can I spend $400 this weekend?",
          ].map((q) => (
            <button
              key={q}
              type="button"
              className="rounded-full bg-forward-50 px-3 py-1 text-left text-xs text-forward-700 ring-1 ring-forward-200"
              onClick={() => setDraft(q)}
            >
              {q.length > 64 ? `${q.slice(0, 61)}…` : q}
            </button>
          ))}
        </div>
        <Button type="submit" disabled={busy || !draft.trim()}>
          {busy ? "Thinking…" : "Send"}
        </Button>
      </form>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function TransitionTab({
  profile,
  busy,
  onSave,
}: {
  profile: KashuProfileFields;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const initial: KashuTransitionState = (() => {
    try {
      return profile.transitionJson
        ? (JSON.parse(profile.transitionJson) as KashuTransitionState)
        : {
            oldAccountLabel: "",
            newAccountLabel: "",
            payrollMoved: false,
            oldOverdraftBalance: 0,
            notes: "",
            pads: [],
          };
    } catch {
      return {
        oldAccountLabel: "",
        newAccountLabel: "",
        payrollMoved: false,
        oldOverdraftBalance: 0,
        notes: "",
        pads: [],
      };
    }
  })();

  const [state, setState] = useState<KashuTransitionState>(initial);
  const [padTitle, setPadTitle] = useState("");
  const [padAmount, setPadAmount] = useState("");

  const uncleared = state.pads.filter((p) => !p.clearedOnNew).length;
  const safeToClose = state.payrollMoved && state.pads.length > 0 && uncleared === 0;

  return (
    <div className="kashu-panel space-y-4 p-4 md:p-6">
      <h2 className="text-lg font-semibold text-forward-900">Transition Mode</h2>
      <p className="text-sm text-forward-500">
        Switching banks? Track payroll and each recurring PAD until the new account is structurally
        healthy — then close the old one.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Old account
          <Input
            className="mt-1"
            value={state.oldAccountLabel}
            onChange={(e) => setState({ ...state, oldAccountLabel: e.target.value })}
          />
        </label>
        <label className="text-sm">
          New account
          <Input
            className="mt-1"
            value={state.newAccountLabel}
            onChange={(e) => setState({ ...state, newAccountLabel: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Old overdraft / negative balance
          <Input
            className="mt-1"
            type="number"
            min={0}
            value={state.oldOverdraftBalance}
            onChange={(e) =>
              setState({ ...state, oldOverdraftBalance: Number(e.target.value) || 0 })
            }
          />
        </label>
        <label className="flex items-center gap-2 text-sm sm:mt-6">
          <input
            type="checkbox"
            checked={state.payrollMoved}
            onChange={(e) => setState({ ...state, payrollMoved: e.target.checked })}
          />
          Payroll moved to new account
        </label>
      </div>

      <div className="rounded-xl border border-forward-100 bg-forward-50/60 p-3">
        <p className="text-sm font-semibold text-forward-900">Recurring PADs</p>
        <ul className="mt-2 space-y-2">
          {state.pads.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={p.clearedOnNew}
                  onChange={(e) =>
                    setState({
                      ...state,
                      pads: state.pads.map((x) =>
                        x.id === p.id ? { ...x, clearedOnNew: e.target.checked } : x
                      ),
                    })
                  }
                />
                {p.title} ({money(p.amount)})
              </label>
              <button
                type="button"
                className="text-xs text-red-600"
                onClick={() =>
                  setState({ ...state, pads: state.pads.filter((x) => x.id !== p.id) })
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            placeholder="PAD name"
            value={padTitle}
            onChange={(e) => setPadTitle(e.target.value)}
            className="max-w-[10rem]"
          />
          <Input
            placeholder="Amount"
            type="number"
            value={padAmount}
            onChange={(e) => setPadAmount(e.target.value)}
            className="max-w-[7rem]"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              if (!padTitle.trim()) return;
              setState({
                ...state,
                pads: [
                  ...state.pads,
                  {
                    id: `pad-${Date.now()}`,
                    title: padTitle.trim(),
                    amount: Number(padAmount) || 0,
                    clearedOnNew: false,
                  },
                ],
              });
              setPadTitle("");
              setPadAmount("");
            }}
          >
            Add PAD
          </Button>
        </div>
      </div>

      <textarea
        className="w-full rounded-xl border border-forward-200 px-3 py-2 text-sm"
        rows={3}
        placeholder="Notes"
        value={state.notes}
        onChange={(e) => setState({ ...state, notes: e.target.value })}
      />

      {safeToClose ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          SAFE TO CLOSE OLD ACCOUNT — payroll moved and every tracked PAD cleared on the new
          account.
        </p>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Do not close the old account yet.
          {!state.payrollMoved ? " Payroll still on the old account." : ""}
          {uncleared > 0 ? ` ${uncleared} recurring payment(s) have not cleared the new account.` : ""}
        </p>
      )}

      <Button
        type="button"
        disabled={busy}
        onClick={() => void onSave({ transitionJson: JSON.stringify(state) })}
      >
        Save transition checklist
      </Button>
    </div>
  );
}
