import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { activateApplePro, deactivateApplePro } from "@/lib/apple-iap";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["activate", "deactivate"]).default("activate"),
  originalTransactionId: z.string().min(4).max(128).optional(),
  productId: z.string().min(1).max(128).optional(),
  revenueCatAppUserId: z.string().min(1).max(128).optional(),
  entitlementActive: z.boolean().optional(),
});

/**
 * Sync Apple IAP / RevenueCat entitlement after a native purchase.
 * Auth: logged-in session cookie from the WebView.
 */
export async function POST(request: Request) {
  try {
    const user = await getSession();
    if (!user) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid Apple IAP payload.");

    const {
      action,
      originalTransactionId,
      productId,
      revenueCatAppUserId,
      entitlementActive,
    } = parsed.data;

    if (action === "deactivate" || entitlementActive === false) {
      await deactivateApplePro(user.id);
      return json({ ok: true, plan: "trial" });
    }

    if (!originalTransactionId) {
      return badRequest("originalTransactionId is required to activate Pro.");
    }

    await activateApplePro({
      userId: user.id,
      originalTransactionId,
      productId,
      revenueCatAppUserId: revenueCatAppUserId ?? user.id,
    });

    return json({ ok: true, plan: "plus" });
  } catch (error) {
    console.error("[api/subscription/apple]", error);
    return serverError("Could not sync Apple subscription.");
  }
}
