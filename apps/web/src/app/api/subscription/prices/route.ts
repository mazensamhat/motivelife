import { getSession } from "@/lib/session";
import { getStripe, getStripePriceId, isValidStripeSecretKey } from "@/lib/stripe";
import { json, unauthorized, serverError, badRequest } from "@/lib/api";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key || !isValidStripeSecretKey(key)) {
      return badRequest("STRIPE_SECRET_KEY is missing or invalid in apps/web/.env.local");
    }

    const stripe = getStripe();
    if (!stripe) return badRequest("Could not initialize Stripe client.");

    const prices = await stripe.prices.list({
      active: true,
      limit: 20,
      expand: ["data.product"],
    });

    const configured = getStripePriceId();
    const items = prices.data.map((p) => {
      const product = p.product;
      const productName =
        typeof product === "object" && product && "name" in product ? product.name : "Product";
      return {
        id: p.id,
        lookupKey: p.lookup_key,
        amount: p.unit_amount,
        currency: p.currency,
        interval: p.recurring?.interval ?? null,
        productName,
        matchesEnv: configured === p.id,
      };
    });

    const envPriceValid = configured
      ? items.some((p) => p.id === configured)
      : false;

    return json({
      mode: key.startsWith("sk_live_") ? "live" : "test",
      configuredPriceId: configured || null,
      envPriceValid,
      prices: items,
      hint:
        items.length === 0
          ? "No active prices in this Stripe account. Create MotiveLife Pro in Product catalog (Test mode), then restart the dev server."
          : !envPriceValid && configured
            ? "STRIPE_PRICE_ID in .env.local does not match any price in THIS account. Copy an id from the list below."
            : envPriceValid
              ? "Price ID matches — checkout should work."
              : "Set STRIPE_PRICE_ID in .env.local to one of the price ids below, then restart the dev server.",
    });
  } catch (error) {
    console.error("[api/subscription/prices]", error);
    return serverError("Could not list Stripe prices.");
  }
}
