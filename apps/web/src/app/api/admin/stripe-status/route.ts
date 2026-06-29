import { requireAdmin } from "@/lib/admin";
import { json, serverError, unauthorized, forbidden } from "@/lib/api";
import {
  getStripe,
  getStripePriceId,
  hasStripePriceConfig,
  isStripeConfigured,
  isValidStripeSecretKey,
  resolveStripePriceId,
} from "@/lib/stripe";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) return unauthorized(auth.error);
    return forbidden(auth.error);
  }

  try {
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
    const mode = secretKey.startsWith("sk_live_")
      ? "live"
      : secretKey.startsWith("sk_test_")
        ? "test"
        : "unknown";
    const webhookSet = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());

    let priceOk = false;
    let priceId: string | null = null;
    const stripe = getStripe();
    if (stripe && hasStripePriceConfig()) {
      priceId = await resolveStripePriceId(stripe);
      priceOk = Boolean(priceId);
    }

    const envPriceId = getStripePriceId();

    return json({
      configured: isStripeConfigured() && priceOk && webhookSet,
      mode,
      secretKeyValid: isValidStripeSecretKey(secretKey),
      priceId: priceId ?? (envPriceId || null),
      priceResolvable: priceOk,
      webhookSecretSet: webhookSet,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.mymotivelife.com"}/api/webhooks/stripe`,
      checklist: [
        { ok: isValidStripeSecretKey(secretKey), label: "STRIPE_SECRET_KEY is valid" },
        { ok: hasStripePriceConfig(), label: "STRIPE_PRICE_ID or lookup key is set" },
        { ok: priceOk, label: "Price exists in this Stripe account (same test/live mode)" },
        { ok: webhookSet, label: "STRIPE_WEBHOOK_SECRET is set" },
        {
          ok: Boolean(process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://")),
          label: "NEXT_PUBLIC_APP_URL is HTTPS production URL",
        },
      ],
    });
  } catch (error) {
    console.error("[admin/stripe-status]", error);
    return serverError("Could not check Stripe status.");
  }
}
