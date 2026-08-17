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
  life_pro: "Personal Life OS",
  family: "Family + owner Pro",
  family_member_pro: "Active KINZO members",
};

const PLAN_CTA: Record<(typeof FAMILY_PLANS)[number]["id"], string> = {
  life_pro: "Start 14-day Pro trial",
  family: "Start free map · unlock KINZO AI",
  family_member_pro: "Join a Family household",
};

const PLAN_HREF: Record<(typeof FAMILY_PLANS)[number]["id"], string> = {
  life_pro: "/register",
  family: "/register?plan=family",
  family_member_pro: "/family",
};

/**
 * Canonical marketing pricing — Pro · KINZO AI · Family Pro Upgrade.
 */
export function MarketingPricingSection({
  id = "pricing",
  title = "One Life OS. Family optional.",
  variant = "light",
}: {
  id?: string;
  title?: string;
  variant?: "light" | "dark";
}) {
  const isDark = variant === "dark";
  return (
    <section
      id={id}
      className={
        isDark
          ? "scroll-mt-24 border-t border-white/[0.06] bg-[#121C2B] py-20 text-[#F7F9FC] sm:py-24"
          : "scroll-mt-24 border-t border-forward-200 bg-forward-50 py-20 text-forward-900 sm:py-24"
      }
    >
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h2>
        <p
          className={`mx-auto mt-4 max-w-2xl text-center ${isDark ? "text-[#98A5B7]" : "text-forward-600"}`}
        >
          MyMotiveLife Pro is your personal Life OS — DayO, LifeVue, UPLIFT, Kashu, Vitalu, and
          VYRA with a Digital Twin that learns you. KINZO AI ({FAMILY_PRICE_LABEL}) adds family
          intelligence and includes Pro for the owner. Up to {FAMILY_MAX_MEMBERS} people.
        </p>
        <p
          className={`mx-auto mt-2 max-w-2xl text-center text-sm font-medium ${isDark ? "text-[#98A5B7]" : "text-forward-700"}`}
        >
          Start with a 14-day Pro trial (no card). The KINZO live map stays free forever. Invited
          members join Family at no cost; they can unlock private Pro for {FAMILY_MEMBER_PRO_UPGRADE_LABEL}{" "}
          while the household runs KINZO AI (vs {LIFE_PRO_PRICE_LABEL} standalone). Twin data stays
          private.
        </p>

        <AlignedPricingGrid columns={3}>
          {FAMILY_PLANS.map((plan) => {
            const highlighted = plan.id === "family";
            return (
              <AlignedPricingCard
                key={plan.id}
                highlighted={highlighted}
                light={isDark ? false : !highlighted}
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

        <p className={`mt-8 text-center text-sm ${isDark ? "text-[#98A5B7]" : "text-forward-500"}`}>
          MyMotiveLife Pro on its own is {LIFE_PRO_PRICE_LABEL}. Family members upgrade for less
          when they’re already in a household.
        </p>
        <p
          className={`mx-auto mt-3 max-w-2xl text-center text-xs ${isDark ? "text-[#98A5B7]/80" : "text-forward-500"}`}
        >
          Subscriptions bill through Stripe. Cancel anytime from Settings → Manage billing. On iOS /
          Android, Pro uses the App Store / Google Play.
        </p>
      </div>
    </section>
  );
}
