"use client";

import Link from "next/link";

/** Absolute URLs so App Review can open Terms / Privacy from the WebView. */
export const SUBSCRIPTION_PRIVACY_URL = "https://www.mymotivelife.com/privacy";
export const SUBSCRIPTION_TERMS_URL = "https://www.mymotivelife.com/terms";

export const SUBSCRIPTION_DISPLAY_NAME = "MotiveLife Pro";
export const SUBSCRIPTION_PERIOD_LABEL = "1 month";
/** Keep in sync with PLAN_PRICE_LABEL in subscription.ts — do not import that file (Prisma/fs). */
export const SUBSCRIPTION_PRICE_LABEL = "$14.99/mo";

/**
 * Apple Guideline 3.1.2(c) — required disclosures in the purchase flow:
 * title, length, price, functional Privacy + Terms (EULA) links.
 */
export function SubscriptionLegalDisclosure({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        className ||
        (compact
          ? "mt-2 space-y-1 text-[11px] leading-snug text-forward-500"
          : "mt-4 space-y-2 rounded-xl border border-forward-200 bg-forward-50 px-4 py-3 text-xs leading-relaxed text-forward-600")
      }
      data-testid="subscription-legal-disclosure"
    >
      <p>
        <span className="font-semibold text-forward-800">{SUBSCRIPTION_DISPLAY_NAME}</span>
        {" — "}
        auto-renewable subscription. Length:{" "}
        <span className="font-medium text-forward-800">{SUBSCRIPTION_PERIOD_LABEL}</span>
        {" · "}
        Price:{" "}
        <span className="font-medium text-forward-800">{SUBSCRIPTION_PRICE_LABEL}</span>
        {" "}
        (billed monthly). Payment is charged to your Apple ID. Subscription renews automatically
        unless cancelled at least 24 hours before the end of the current period. Manage or cancel in
        iOS Settings → Apple ID → Subscriptions.
      </p>
      <p>
        By continuing you agree to our{" "}
        <Link
          href={SUBSCRIPTION_TERMS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-blue underline underline-offset-2"
        >
          Terms of Use (EULA)
        </Link>{" "}
        and{" "}
        <Link
          href={SUBSCRIPTION_PRIVACY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-blue underline underline-offset-2"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
