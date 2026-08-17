"use client";

import Link from "next/link";
import {
  FAMILY_BASE_MEMBERS,
  FAMILY_EXTRA_SEATS_PACK_PRICE_LABEL,
  FAMILY_MAX_MEMBERS,
  FAMILY_MEMBER_PRO_UPGRADE_LABEL,
  FAMILY_PRICE_LABEL,
  LIFE_PRO_PRICE_LABEL,
} from "@forward/shared";
import {
  FAMILY_PLAN_NAME,
  FAMILY_PLAN_PRICE_LABEL,
  PLAN_NAME,
  PLAN_PRICE_LABEL,
} from "@/lib/subscription-display";

/** Absolute URLs so App Review can open Terms / Privacy from the WebView. */
export const SUBSCRIPTION_PRIVACY_URL = "https://www.mymotivelife.com/privacy";
export const SUBSCRIPTION_TERMS_URL = "https://www.mymotivelife.com/terms";

/** Primary App Store IAP currently sold in-app. */
export const SUBSCRIPTION_DISPLAY_NAME = PLAN_NAME;
export const SUBSCRIPTION_PERIOD_LABEL = "1 month";
/** Keep in sync with PLAN_PRICE_LABEL in subscription-display.ts. */
export const SUBSCRIPTION_PRICE_LABEL = PLAN_PRICE_LABEL;

export const FAMILY_SUBSCRIPTION_DISPLAY_NAME = FAMILY_PLAN_NAME;
export const FAMILY_SUBSCRIPTION_PRICE_LABEL = FAMILY_PLAN_PRICE_LABEL;

/**
 * Apple Guideline 3.1.2(c) — required disclosures in the purchase flow:
 * title, length, price, functional Privacy + Terms (EULA) links.
 * Also discloses MyMotiveFamily household pricing so Settings is not Pro-only.
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
        ({LIFE_PRO_PRICE_LABEL}). Payment is charged to your Apple ID. Subscription renews
        automatically unless cancelled at least 24 hours before the end of the current period.
        Manage or cancel in iOS Settings → Apple ID → Subscriptions.
      </p>
      <p>
        <span className="font-semibold text-forward-800">{FAMILY_SUBSCRIPTION_DISPLAY_NAME}</span>
        {" — "}
        household plan at{" "}
        <span className="font-medium text-forward-800">{FAMILY_SUBSCRIPTION_PRICE_LABEL}</span>
        {" "}
        ({FAMILY_PRICE_LABEL}), including Life Pro for the account owner and Family Intelligence for
        up to {FAMILY_BASE_MEMBERS} members (extend to {FAMILY_MAX_MEMBERS} with +2 seat packs at{" "}
        {FAMILY_EXTRA_SEATS_PACK_PRICE_LABEL} each). Active invited members can unlock full private
        Pro for {FAMILY_MEMBER_PRO_UPGRADE_LABEL} (household discount). See{" "}
        <Link
          href="/family"
          className="font-medium text-brand-blue underline underline-offset-2"
        >
          KINZO AI
        </Link>{" "}
        for plan details.
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
