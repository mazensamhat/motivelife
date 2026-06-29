import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import {
  getAppUrl,
  getStripe,
  getStripePriceId,
  isStripeConfigured,
  resolveStripeCustomerId,
  resolveStripePriceId,
  stripeConfigHint,
} from "@/lib/stripe";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { TRIAL_DAYS } from "@/lib/marketing";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    if (!isStripeConfigured()) {
      const hint = stripeConfigHint();
      return badRequest(
        hint ||
          "Stripe is not configured yet. Add STRIPE_SECRET_KEY and STRIPE_PRICE_LOOKUP_KEY to apps/web/.env.local"
      );
    }

    const stripe = getStripe()!;
    const priceId = await resolveStripePriceId(stripe);
    if (!priceId) {
      const badPrice = getStripePriceId();
      return badRequest(
        badPrice
          ? `Stripe price ${badPrice} was not found in your account. Open Stripe Dashboard (Test mode) → Product catalog → MotiveLife Pro → copy the Price ID (price_...) into STRIPE_PRICE_ID, or set a Lookup key on that price and use STRIPE_PRICE_LOOKUP_KEY in .env.local.`
          : "Could not find a Stripe price. In Dashboard → Product catalog → MotiveLife Pro → set Lookup key to match STRIPE_PRICE_LOOKUP_KEY in .env.local, or set STRIPE_PRICE_ID directly."
      );
    }

    const appUrl = getAppUrl();

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { email: true, stripeCustomerId: true },
    });
    if (!user?.email) return badRequest("User email required for checkout.");

    let customerId = await resolveStripeCustomerId(
      stripe,
      session.id,
      user.email,
      user.stripeCustomerId
    );
    if (customerId !== user.stripeCustomerId) {
      await prisma.user.update({
        where: { id: session.id },
        data: { stripeCustomerId: customerId, stripeSubscriptionId: null },
      });
    }

    const checkout = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/settings?checkout=cancelled`,
      metadata: { userId: session.id },
      subscription_data: {
        metadata: { userId: session.id },
        trial_period_days: TRIAL_DAYS,
      },
    });

    if (!checkout.url) return serverError("Could not create checkout session.");
    return json({ url: checkout.url });
  } catch (error) {
    console.error("[api/subscription/checkout]", error);
    if (
      error instanceof Error &&
      (error.message.includes("Invalid API Key") || error.name === "StripeAuthenticationError")
    ) {
      return badRequest(
        "Invalid Stripe secret key. In Stripe Dashboard → Developers → API keys, copy the Secret key (sk_test_...) — not the Publishable key (pk_). Restart the dev server after updating .env.local."
      );
    }
    if (error instanceof Error && error.message.includes("No such price")) {
      return badRequest(
        "That price ID is not in your Stripe account. In Test mode, go to Product catalog → your product → copy the Price ID (price_...) into STRIPE_PRICE_ID in apps/web/.env.local, then restart the dev server."
      );
    }
    if (error instanceof Error && error.message.includes("No such customer")) {
      return badRequest(
        "Billing customer was reset — try Upgrade again. (Stale customer from a previous Stripe account.)"
      );
    }
    return serverError("Checkout failed.");
  }
}
