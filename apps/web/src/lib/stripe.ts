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

/** Family extra seats +2 pack $5.99 — add-on to active KINZO AI subscription */
export function getStripeFamilyExtraSeatsPriceId() {
  const priceId = process.env.STRIPE_FAMILY_EXTRA_SEATS_PRICE_ID?.trim() ?? "";
  if (!priceId || priceId.includes("...") || !priceId.startsWith("price_")) return "";
  return priceId;
}

export function getStripeFamilyExtraSeatsProductId() {
  const id = process.env.STRIPE_FAMILY_EXTRA_SEATS_PRODUCT_ID?.trim() ?? "";
  if (!id || id.includes("...") || !id.startsWith("prod_")) return "";
  return id;
}

export async function resolveStripeFamilyExtraSeatsPriceId(
  stripe: Stripe
): Promise<string | null> {
  const direct = getStripeFamilyExtraSeatsPriceId();
  if (direct) {
    try {
      const price = await stripe.prices.retrieve(direct);
      if (price.active) return price.id;
    } catch {
      // fall through
    }
  }
  const lookupKey = process.env.STRIPE_FAMILY_EXTRA_SEATS_PRICE_LOOKUP_KEY?.trim() ?? "";
  if (lookupKey && !lookupKey.includes("...")) {
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      limit: 1,
    });
    if (prices.data[0]?.id) return prices.data[0].id;
  }
  const productId = getStripeFamilyExtraSeatsProductId();
  if (productId) {
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 1,
    });
    if (prices.data[0]?.id) return prices.data[0].id;
  }
  return null;
}

export function isStripeFamilyExtraSeatsConfigured() {
  return Boolean(
    getStripe() &&
      (getStripeFamilyExtraSeatsPriceId() ||
        getStripeFamilyExtraSeatsProductId() ||
        process.env.STRIPE_FAMILY_EXTRA_SEATS_PRICE_LOOKUP_KEY?.trim())
  );
}

/** MyMotiveFamily $19.99 — optional until set in Vercel */
export function getStripeFamilyPriceId() {
  const priceId = process.env.STRIPE_FAMILY_PRICE_ID?.trim() ?? "";
  if (!priceId || priceId.includes("...") || !priceId.startsWith("price_")) return "";
  return priceId;
}

/** Family Pro Upgrade $9.99 — active MyMotiveFamily invitees only (household discount) */
export function getStripeMemberProPriceId() {
  const priceId = process.env.STRIPE_MEMBER_PRO_PRICE_ID?.trim() ?? "";
  if (!priceId || priceId.includes("...") || !priceId.startsWith("price_")) return "";
  return priceId;
}

export async function resolveStripeMemberProPriceId(stripe: Stripe): Promise<string | null> {
  const direct = getStripeMemberProPriceId();
  if (direct) {
    try {
      const price = await stripe.prices.retrieve(direct);
      if (price.active) return price.id;
    } catch {
      // fall through
    }
  }
  const lookupKey = process.env.STRIPE_MEMBER_PRO_PRICE_LOOKUP_KEY?.trim() ?? "";
  if (lookupKey && !lookupKey.includes("...")) {
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      limit: 1,
    });
    if (prices.data[0]?.id) return prices.data[0].id;
  }
  return null;
}

export function isStripeMemberProConfigured() {
  return Boolean(
    getStripe() &&
      (getStripeMemberProPriceId() || process.env.STRIPE_MEMBER_PRO_PRICE_LOOKUP_KEY?.trim())
  );
}

export async function resolveStripeFamilyPriceId(stripe: Stripe): Promise<string | null> {
  const direct = getStripeFamilyPriceId();
  if (direct) {
    try {
      const price = await stripe.prices.retrieve(direct);
      if (price.active) return price.id;
    } catch {
      // fall through
    }
  }
  const lookupKey = process.env.STRIPE_FAMILY_PRICE_LOOKUP_KEY?.trim() ?? "";
  if (lookupKey && !lookupKey.includes("...")) {
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      limit: 1,
    });
    if (prices.data[0]?.id) return prices.data[0].id;
  }
  return null;
}

export function isStripeFamilyConfigured() {
  return Boolean(getStripe() && (getStripeFamilyPriceId() || process.env.STRIPE_FAMILY_PRICE_LOOKUP_KEY?.trim()));
}

/** Stripe sample uses price lookup keys — set on your price in Product catalog */
export function getStripePriceLookupKey() {
  const key = process.env.STRIPE_PRICE_LOOKUP_KEY?.trim() ?? "";
  if (!key || key.includes("...") || key.startsWith("{{")) return "";
  return key;
}

export function getStripeProductId() {
  const id = process.env.STRIPE_PRODUCT_ID?.trim() ?? "";
  if (!id || !id.startsWith("prod_")) return "";
  return id;
}

export function hasStripePriceConfig() {
  return Boolean(getStripePriceId() || getStripePriceLookupKey() || getStripeProductId());
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
  if (lookupKey) {
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      limit: 1,
      expand: ["data.product"],
    });
    if (prices.data[0]?.id) return prices.data[0].id;
  }

  const productId = getStripeProductId();
  if (productId) {
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 1,
    });
    return prices.data[0]?.id ?? null;
  }

  return null;
}

export function stripeConfigHint(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return "Add STRIPE_SECRET_KEY to apps/web/.env.local";
  if (!isValidStripeSecretKey(key)) {
    return "STRIPE_SECRET_KEY looks invalid — use Secret key (sk_test_...) from Stripe Dashboard → Developers → API keys";
  }
  if (!hasStripePriceConfig()) {
    return "Add STRIPE_PRICE_ID, STRIPE_PRODUCT_ID (prod_...), or STRIPE_PRICE_LOOKUP_KEY in Vercel → Environment Variables (Production), then redeploy.";
  }
  if (getStripePriceLookupKey() || getStripeProductId()) {
    return "";
  }
  const priceId = getStripePriceId();
  if (priceId && !priceId.startsWith("price_")) {
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
