import { json, serverError } from "@/lib/api";
import {
  activateApplePro,
  deactivateApplePro,
  findUserIdByAppleTransaction,
  findUserIdByRevenueCatAppUserId,
} from "@/lib/apple-iap";

export const runtime = "nodejs";

/**
 * RevenueCat server webhook.
 * Configure in RevenueCat → Project → Integrations → Webhooks:
 *   URL: https://www.mymotivelife.com/api/webhooks/revenuecat
 *   Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
 */
export async function POST(request: Request) {
  try {
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return json({ error: "RevenueCat webhook not configured" }, 503);
    }

    const auth = request.headers.get("authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (token !== secret) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = (await request.json()) as {
      event?: {
        type?: string;
        app_user_id?: string;
        original_app_user_id?: string;
        product_id?: string;
        original_transaction_id?: string;
        transferred_from?: string[];
        transferred_to?: string[];
      };
    };

    const event = body.event;
    if (!event?.type) return json({ ok: true, ignored: true });

    const appUserId = event.app_user_id ?? event.original_app_user_id;
    let userId =
      (appUserId ? await findUserIdByRevenueCatAppUserId(appUserId) : null) ??
      (event.original_transaction_id
        ? await findUserIdByAppleTransaction(event.original_transaction_id)
        : null);

    const type = event.type.toUpperCase();

    // Grant / refresh Pro
    if (
      type === "INITIAL_PURCHASE" ||
      type === "RENEWAL" ||
      type === "UNCANCELLATION" ||
      type === "PRODUCT_CHANGE" ||
      type === "NON_RENEWING_PURCHASE"
    ) {
      if (!userId || !event.original_transaction_id) {
        return json({ ok: true, skipped: "missing user or transaction" });
      }
      await activateApplePro({
        userId,
        originalTransactionId: event.original_transaction_id,
        productId: event.product_id,
        revenueCatAppUserId: appUserId,
      });
      return json({ ok: true, activated: userId });
    }

    // Lose Pro
    if (
      type === "CANCELLATION" ||
      type === "EXPIRATION" ||
      type === "SUBSCRIPTION_PAUSED"
    ) {
      if (!userId) return json({ ok: true, skipped: "missing user" });
      // Cancellation still has access until period end — only expire on EXPIRATION.
      if (type === "EXPIRATION") {
        await deactivateApplePro(userId);
      }
      return json({ ok: true, handled: type });
    }

    return json({ ok: true, ignored: type });
  } catch (error) {
    console.error("[webhooks/revenuecat]", error);
    return serverError("RevenueCat webhook failed");
  }
}
