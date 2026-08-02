import Link from "next/link";
import { Check } from "lucide-react";
import { buttonClassName } from "@/components/button";
import {
  PLAN_NAME,
  PLAN_PRICE_CAD,
  PRO_FEATURES,
  TRIAL_DAYS,
} from "@/lib/marketing";

const FAMILY_FEATURES = [
  "Everything in MyMotiveLife Pro for the owner",
  "Live Family Intelligence Map — up to 6 members",
  "Place, Drive & Destination Intelligence™",
  "Family Flow™ + Something’s Different™",
] as const;

export function LandingPricing() {
  return (
    <section id="pricing" className="scroll-mt-20 bg-forward-50 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-brand-blue">Pricing</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-forward-900 sm:text-4xl">
            Try everything free for {TRIAL_DAYS} days
          </h2>
          <p className="mt-4 text-lg text-forward-600">
            Choose {PLAN_NAME} for yourself, or MyMotiveFamily for your household. Cancel anytime
            before billing starts.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-forward-200 bg-white shadow-lg">
            <div className="brand-gradient px-6 py-5 text-white">
              <p className="text-sm font-medium uppercase tracking-wider opacity-90">{PLAN_NAME}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-semibold">$14.99</span>
                <span className="text-forward-100">CAD / month after trial</span>
              </div>
              <p className="mt-2 text-sm text-white/85">
                {TRIAL_DAYS}-day free trial · {PLAN_PRICE_CAD}
              </p>
            </div>
            <div className="p-6">
              <ul className="space-y-3">
                {PRO_FEATURES.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm text-forward-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className={buttonClassName({ size: "lg", className: "mt-8 w-full" })}
              >
                Start {TRIAL_DAYS}-day free trial
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-brand-blue/30 bg-white shadow-lg">
            <div className="bg-forward-900 px-6 py-5 text-white">
              <p className="text-sm font-medium uppercase tracking-wider text-brand-blue">
                MyMotiveFamily
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-semibold">$19.99</span>
                <span className="text-forward-300">CAD / month</span>
              </div>
              <p className="mt-2 text-sm text-forward-300">
                Includes Life Pro for the owner · only $5 more than Pro
              </p>
            </div>
            <div className="p-6">
              <ul className="space-y-3">
                {FAMILY_FEATURES.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm text-forward-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/family"
                className={buttonClassName({
                  size: "lg",
                  variant: "secondary",
                  className: "mt-8 w-full",
                })}
              >
                Start my family
              </Link>
            </div>
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-lg text-center text-xs text-forward-500">
          By signing up you agree to our{" "}
          <Link href="/terms" className="underline hover:text-forward-700">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-forward-700">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
