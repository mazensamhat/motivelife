import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/** Reject placeholders and publishable keys — Stripe secret keys start with sk_test_ or sk_live_ */
export function isValidStripeSecretKey(key: string | undefined): boolean {
  if (!key?.trim()) return false;
  const trimmed = key.trim();
  if (trimmed.includes("...") || trimmed.endsWith("_")) return false;
  if (trimmed.startsWith("pk_")) return false;
  return /^sk_(test|live)_[A-Za-z0-9]+$/.test(trimmed) && trimmed.length >= 24;
}

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || !isValidStripeSecretKey(key)) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(key, { apiVersion: "2025-08-27.basil" });
  }
  return stripeClient;
}

export function getStripePriceId() {
  const priceId = process.env.STRIPE_PRICE_ID?.trim() ?? "";
  if (!priceId || priceId.includes("...") || !priceId.startsWith("price_")) return "";
  return priceId;
}

/** Stripe sample uses price lookup keys — set on your price in Product catalog */
export function getStripePriceLookupKey() {
  const key = process.env.STRIPE_PRICE_LOOKUP_KEY?.trim() ?? "";
  if (!key || key.includes("...") || key.startsWith("{{")) return "";
  return key;
}

export function hasStripePriceConfig() {
  return Boolean(getStripePriceId() || getStripePriceLookupKey());
}

/** Resolve price ID from env or Stripe lookup_key (matches Stripe sample server.rb) */
export async function resolveStripePriceId(stripe: Stripe): Promise<string | null> {
  const direct = getStripePriceId();
  if (direct) {
    try {
      const price = await stripe.prices.retrieve(direct);
      if (price.active) return price.id;
    } catch {
      // STRIPE_PRICE_ID is stale or from another account — try lookup key below
    }
  }

  const lookupKey = getStripePriceLookupKey();
  if (!lookupKey) return null;

  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
    expand: ["data.product"],
  });

  return prices.data[0]?.id ?? null;
}

export function stripeConfigHint(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return "Add STRIPE_SECRET_KEY to apps/web/.env.local";
  if (!isValidStripeSecretKey(key)) {
    return "STRIPE_SECRET_KEY looks invalid — use Secret key (sk_test_...) from Stripe Dashboard → Developers → API keys";
  }
  if (!hasStripePriceConfig()) {
    return "Add STRIPE_PRICE_LOOKUP_KEY (recommended) or STRIPE_PRICE_ID for MotiveLife Pro in apps/web/.env.local";
  }
  if (getStripePriceLookupKey()) {
    return "";
  }
  const priceId = getStripePriceId();
  if (!priceId.startsWith("price_")) {
    return "STRIPE_PRICE_ID must be a Price ID (price_...) from your MotiveLife Pro product in Stripe";
  }
  return "";
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3002";
}

export function isStripeConfigured() {
  return Boolean(getStripe() && hasStripePriceConfig());
}

/** Returns a valid Stripe customer id; creates one if missing or stale (wrong account) */
export async function resolveStripeCustomerId(
  stripe: Stripe,
  userId: string,
  email: string,
  existingCustomerId: string | null | undefined
): Promise<string> {
  if (existingCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(existingCustomerId);
      if (!customer.deleted) return customer.id;
    } catch {
      // Stale customer from another Stripe account
    }
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  return customer.id;
}
