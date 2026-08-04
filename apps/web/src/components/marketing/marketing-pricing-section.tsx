import Link from "next/link";
import { buttonClassName } from "@/components/button";
import {
  AlignedPricingCard,
  AlignedPricingGrid,
  PricingCardEyebrow,
  PricingCardFeatures,
  PricingCardMeta,
  PricingCardName,
  PricingCardPrice,
  pricingCtaClassName,
} from "@/components/marketing/aligned-pricing-card";
import {
  FAMILY_MAX_MEMBERS,
  FAMILY_MEMBER_PRO_UPGRADE_LABEL,
  FAMILY_PLANS,
  FAMILY_PRICE_LABEL,
  LIFE_PRO_PRICE_LABEL,
} from "@/lib/family-marketing";

const PLAN_EYEBROW: Record<(typeof FAMILY_PLANS)[number]["id"], string> = {
  life_pro: "ME intelligence",
  family: "Includes owner Pro",
  family_member_pro: "Active Family members",
};

const PLAN_CTA: Record<(typeof FAMILY_PLANS)[number]["id"], string> = {
  life_pro: "Start 14-day Pro trial",
  family: "Start free map · unlock intelligence",
  family_member_pro: "Join a Family household",
};

const PLAN_HREF: Record<(typeof FAMILY_PLANS)[number]["id"], string> = {
  life_pro: "/register",
  family: "/register?plan=family",
  family_member_pro: "/family",
};

/**
 * Canonical marketing pricing — same 3 cards on homepage and /family.
 * Pro · MyMotiveFamily · Family Pro Upgrade ($9.99 household discount).
 */
export function MarketingPricingSection({
  id = "pricing",
  title = "Free map. Intelligence is optional.",
}: {
  id?: string;
  title?: string;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-t border-forward-200 bg-forward-50 py-20 text-forward-900 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-forward-600">
          One free experience — live Family Map + speed forever. Family Intelligence (
          {FAMILY_PRICE_LABEL}) unlocks history, Drive Score, and calm alerts, and includes
          MyMotiveLife Pro for the owner. Up to {FAMILY_MAX_MEMBERS} people.
        </p>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm font-medium text-forward-700">
          Owner signup includes a 14-day Pro trial (no card) — and the free Family Map. Invited
          members get Family free; they can unlock full private Pro for{" "}
          {FAMILY_MEMBER_PRO_UPGRADE_LABEL} while the household is on MyMotiveFamily (vs{" "}
          {LIFE_PRO_PRICE_LABEL} standalone). Their Twin data stays private.
        </p>

        <AlignedPricingGrid columns={3}>
          {FAMILY_PLANS.map((plan) => {
            const highlighted = plan.id === "family";
            return (
              <AlignedPricingCard
                key={plan.id}
                highlighted={highlighted}
                light={!highlighted}
              >
                <PricingCardName>{plan.name}</PricingCardName>
                <PricingCardEyebrow highlighted={highlighted}>
                  {PLAN_EYEBROW[plan.id]}
                </PricingCardEyebrow>
                <PricingCardPrice
                  amount={
                    Number.isInteger(plan.priceCad)
                      ? `$${plan.priceCad}`
                      : `$${plan.priceCad.toFixed(2)}`
                  }
                  period="CAD / month"
                />
                <PricingCardMeta highlighted={highlighted}>{plan.summary}</PricingCardMeta>
                <PricingCardFeatures items={plan.includes} highlighted={highlighted} />
                <Link
                  href={PLAN_HREF[plan.id]}
                  className={buttonClassName({
                    size: "md",
                    variant: highlighted ? "primary" : "secondary",
                    className: pricingCtaClassName(),
                  })}
                >
                  {PLAN_CTA[plan.id]}
                </Link>
              </AlignedPricingCard>
            );
          })}
        </AlignedPricingGrid>

        <p className="mt-8 text-center text-sm text-forward-500">
          MyMotiveLife Pro on its own is {LIFE_PRO_PRICE_LABEL}. Family members upgrade for less
          when they’re already in a household.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-center text-xs text-forward-500">
          Subscriptions bill through Stripe. Cancel anytime from Settings → Manage billing. On iOS /
          Android, Pro uses the App Store / Google Play.
        </p>
      </div>
    </section>
  );
}
