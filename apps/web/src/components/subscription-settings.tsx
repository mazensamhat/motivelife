"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "./button";
import { Card, CardHeading } from "./card";
import { AiUsageSettings } from "./ai-usage-settings";
import { buildRetentionPitch, type RetentionContext } from "@/lib/subscription-retention";
import type { UserSubscription } from "@/lib/subscription";

export function SubscriptionSettings() {
  const searchParams = useSearchParams();
  const [sub, setSub] = useState<UserSubscription | null>(null);
  const [ctx, setCtx] = useState<RetentionContext | null>(null);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [step, setStep] = useState<"idle" | "confirm" | "saved">("idle");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [stripePrices, setStripePrices] = useState<
    Array<{
      id: string;
      productName: string;
      amount: number | null;
      currency: string;
      interval: string | null;
      matchesEnv: boolean;
    }>
  >([]);
  const [stripePriceHint, setStripePriceHint] = useState("");
  const [envPriceValid, setEnvPriceValid] = useState<boolean | null>(null);
  const [stripeMode, setStripeMode] = useState<"live" | "test" | "unknown">("unknown");

  const isProd = process.env.NODE_ENV === "production";

  async function loadSubscription() {
    const res = await fetch("/api/subscription/status");
    const data = await res.json();
    setSub(data.subscription ?? null);
    setStripeConfigured(Boolean(data.stripeConfigured));
  }

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");

    if (checkout === "success") {
      setMessage("Payment received — activating MotiveLife Pro…");
      const confirm = sessionId
        ? fetch("/api/subscription/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          }).then((r) => r.json())
        : Promise.resolve(null);

      confirm
        .then(async (data) => {
          await loadSubscription();
          if (data?.subscription?.plan === "plus") {
            setMessage("Welcome to MotiveLife Pro — your subscription is active.");
          } else if (sessionId) {
            setMessage(
              "Payment succeeded. Pro should activate shortly — refresh this page. If it does not, contact support."
            );
          } else {
            setMessage("Welcome to MotiveLife Pro — your subscription is active.");
          }
        })
        .catch(() => {
          loadSubscription();
          setMessage("Payment received. Refresh in a moment if Pro is not active yet.");
        });
    }
  }, [searchParams]);

  async function loadStripePrices() {
    const res = await fetch("/api/subscription/prices");
    const data = await res.json();
    if (data.prices) {
      setStripePrices(data.prices);
      setStripePriceHint(data.hint ?? "");
      setEnvPriceValid(data.envPriceValid ?? null);
      setStripeMode(data.mode === "live" ? "live" : data.mode === "test" ? "test" : "unknown");
    }
  }

  useEffect(() => {
    Promise.all([
      loadSubscription(),
      fetch("/api/subscription/retention")
        .then((r) => r.json())
        .then((d) => setCtx(d as RetentionContext))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (stripeConfigured) loadStripePrices();
  }, [stripeConfigured]);

  if (loading || !sub) {
    return <div className="h-32 animate-pulse rounded-xl bg-forward-100" />;
  }

  const pitch = ctx ? buildRetentionPitch(ctx) : null;

  async function handleUpgrade() {
    setMessage("");
    const res = await fetch("/api/subscription/checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    setMessage(data.error ?? "Checkout unavailable. Configure Stripe in your environment.");
  }

  async function manage(action: "pause" | "resume" | "cancel") {
    const res = await fetch("/api/subscription/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      await loadSubscription();
      if (action === "pause") setMessage("Subscription paused for 30 days.");
      else if (action === "cancel") setMessage("Subscription cancelled.");
      else setMessage("Welcome back — your Life OS is active again.");
      setStep("saved");
    }
  }

  async function openPortal() {
    const res = await fetch("/api/subscription/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setMessage(data.error ?? "Billing portal unavailable.");
  }

  return (
    <Card className="p-6">
      <CardHeading>MotiveLife Pro</CardHeading>
      <p className="mt-1 text-sm text-forward-500">
        AI coach, Life Engine streaks, Life Graph, and weekly letters — {sub.priceLabel}
      </p>

      <div className="mt-4 rounded-xl border border-forward-200 bg-forward-50 px-4 py-3 text-sm">
        {sub.status === "cancelled" ? (
          <p className="text-forward-700">Plan cancelled. Resubscribe when you&apos;re ready.</p>
        ) : sub.status === "paused" ? (
          <p className="text-forward-700">Paused — no charges until you resume.</p>
        ) : sub.plan === "plus" ? (
          <p className="text-forward-700">MotiveLife Pro · {sub.priceLabel} · active</p>
        ) : sub.plan === "trial" && sub.trialDaysLeft != null ? (
          <p className="text-forward-700">
            Free trial · {sub.trialDaysLeft} day{sub.trialDaysLeft === 1 ? "" : "s"} left · then{" "}
            {sub.priceLabel}
          </p>
        ) : (
          <p className="text-forward-700">Trial ended · upgrade for full access</p>
        )}
      </div>

      <AiUsageSettings />

      {message && (
        <p className={`mt-3 text-sm ${message.includes("not found") || message.includes("does not match") ? "text-amber-700" : "text-brand-blue"}`}>
          {message}
        </p>
      )}

      {stripeConfigured && envPriceValid === false && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Stripe account mismatch</p>
          <p className="mt-1">
            Your secret key and Price ID are from different Stripe accounts or modes. Copy the{" "}
            <strong>Secret key</strong> and a <strong>Price ID</strong> from the same dashboard
            ({stripeMode === "live" ? "Live" : "Test"} mode).
          </p>
          {stripePriceHint && <p className="mt-2">{stripePriceHint}</p>}
        </div>
      )}

      {stripeConfigured && stripePrices.length > 0 && sub.plan !== "plus" && (
        <div className="mt-3 rounded-xl border border-forward-200 bg-white px-4 py-3 text-sm">
          <p className="font-semibold text-forward-900">
            Prices in your Stripe account{" "}
            <span
              className={
                stripeMode === "live"
                  ? "rounded bg-brand-green/15 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand-green"
                  : "rounded bg-forward-200 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-forward-600"
              }
            >
              {stripeMode}
            </span>
          </p>
          <ul className="mt-2 space-y-2">
            {stripePrices.map((p) => (
              <li key={p.id} className="rounded-lg bg-forward-50 px-3 py-2 font-mono text-xs">
                <span className={p.matchesEnv ? "font-semibold text-brand-green" : "text-forward-800"}>
                  {p.id}
                </span>
                <span className="ml-2 font-sans text-forward-600">
                  {p.productName}
                  {p.amount != null
                    ? ` · ${(p.amount / 100).toFixed(2)} ${p.currency.toUpperCase()}${p.interval ? ` / ${p.interval}` : ""}`
                    : ""}
                  {p.matchesEnv ? (isProd ? " ✓ configured" : " ✓ in .env.local") : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-forward-500">
            {isProd
              ? "To change the price, update STRIPE_PRICE_ID in Vercel (Production) and redeploy."
              : (
                <>
                  Paste the correct id into STRIPE_PRICE_ID in apps/web/.env.local, then restart{" "}
                  <code className="rounded bg-forward-100 px-1">npx pnpm dev</code>.
                </>
              )}
          </p>
        </div>
      )}

      {stripeConfigured && stripePrices.length === 0 && stripePriceHint && (
        <p className="mt-3 text-sm text-amber-700">{stripePriceHint}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!sub.isPremium && sub.plan !== "plus" && (
          <Button size="sm" onClick={handleUpgrade}>
            {stripeConfigured ? `Upgrade to Pro — ${sub.priceLabel}` : "Upgrade (Stripe setup required)"}
          </Button>
        )}
        {(sub.plan === "plus" && sub.isPremium && stripeConfigured) && (
          <Button size="sm" variant="secondary" onClick={openPortal}>
            Manage billing
          </Button>
        )}
        {sub.status === "paused" && (
          <Button size="sm" onClick={() => manage("resume")}>
            Resume subscription
          </Button>
        )}
        {sub.isPremium && sub.status !== "paused" && sub.status !== "cancelled" && (
          <Button variant="ghost" size="sm" onClick={() => setStep("confirm")}>
            Cancel subscription
          </Button>
        )}
      </div>

      {step === "confirm" && pitch && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">
              Before you go
            </p>
            <h2 className="mt-2 text-xl font-semibold text-forward-900">{pitch.headline}</h2>
            <ul className="mt-4 space-y-2 text-sm text-forward-600">
              {pitch.bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-brand-green">✓</span>
                  {b}
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-lg border border-brand-blue/20 bg-brand-blue/5 px-3 py-2 text-sm text-forward-700">
              {pitch.offer}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={() => manage("pause")}>
                Pause 30 days (recommended)
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => setStep("idle")}>
                Keep subscription
              </Button>
            </div>
            <button
              type="button"
              onClick={() => manage("cancel")}
              className="mt-4 w-full text-center text-xs text-forward-400 underline-offset-2 hover:text-forward-600 hover:underline"
            >
              Cancel anyway
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
