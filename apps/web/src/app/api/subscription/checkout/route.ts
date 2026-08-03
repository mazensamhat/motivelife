import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import {
  getAppUrl,
  getStripe,
  getStripePriceId,
  isStripeConfigured,
  resolveStripeCustomerId,
  resolveStripeFamilyPriceId,
  resolveStripeMemberProPriceId,
  resolveStripePriceId,
  stripeConfigHint,
} from "@/lib/stripe";
import { getMemberForUser } from "@/lib/family-map/household";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";

type CheckoutBody = {
  plan?: "plus" | "family" | "member_pro";
};

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    if (!isStripeConfigured()) {
      const hint = stripeConfigHint();
      return badRequest(
        hint ||
          "Stripe is not configured yet. Add STRIPE_SECRET_KEY and STRIPE_PRICE_ID (or STRIPE_PRODUCT_ID) in Vercel → Environment Variables."
      );
    }

    let body: CheckoutBody = {};
    try {
      body = (await request.json()) as CheckoutBody;
    } catch {
      body = {};
    }
    const plan =
      body.plan === "family"
        ? "family"
        : body.plan === "member_pro"
          ? "member_pro"
          : "plus";

    if (plan === "member_pro") {
      const member = await getMemberForUser(session.id);
      if (!member || member.role === "OWNER") {
        return badRequest(
          "Family Member Pro ($5) is for invited household members. Open a family invite link first, or upgrade to full Pro / MyMotiveFamily."
        );
      }
    }

    const stripe = getStripe()!;
    const priceId =
      plan === "family"
        ? await resolveStripeFamilyPriceId(stripe)
        : plan === "member_pro"
          ? await resolveStripeMemberProPriceId(stripe)
          : await resolveStripePriceId(stripe);

    if (!priceId) {
      if (plan === "family") {
        return badRequest(
          "MyMotiveFamily checkout needs STRIPE_FAMILY_PRICE_ID (price_...) in Vercel → Environment Variables for the $19.99 Family product, then redeploy."
        );
      }
      if (plan === "member_pro") {
        return badRequest(
          "Family Member Pro needs STRIPE_MEMBER_PRO_PRICE_ID (price_... for $5 CAD/mo) in Vercel → Environment Variables, then redeploy."
        );
      }
      const badPrice = getStripePriceId();
      return badRequest(
        badPrice
          ? `Stripe price ${badPrice} was not found in your account. In Stripe Dashboard (Live mode) → Product catalog → MotiveLife Pro → copy the Price ID (price_...) into STRIPE_PRICE_ID in Vercel, then redeploy.`
          : "Could not find a Stripe price. Add STRIPE_PRICE_ID (price_...) or STRIPE_PRODUCT_ID (prod_...) in Vercel → Environment Variables (Production), then redeploy."
      );
    }

    const appUrl = getAppUrl();

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { email: true, stripeCustomerId: true, trialEndsAt: true },
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

    // Member Pro and paid upgrades start immediately — never attach a free trial to invitees.
    const trialStillActive =
      plan !== "member_pro" && user.trialEndsAt && user.trialEndsAt.getTime() > Date.now();
    const trialEndUnix = trialStillActive
      ? Math.floor(user.trialEndsAt!.getTime() / 1000)
      : undefined;

    const checkout = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings?checkout=success&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/settings?checkout=cancelled`,
      metadata: { userId: session.id, plan },
      subscription_data: {
        metadata: { userId: session.id, plan },
        ...(trialEndUnix ? { trial_end: trialEndUnix } : {}),
      },
    });

    if (!checkout.url) return serverError("Could not create checkout session.");
    return json({ url: checkout.url, plan });
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
        "That price ID is not in your Stripe account. In Test mode, go to Product catalog → your product → copy the Price ID (price_...) into STRIPE_PRICE_ID / STRIPE_FAMILY_PRICE_ID / STRIPE_MEMBER_PRO_PRICE_ID in apps/web/.env.local, then restart the dev server."
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
