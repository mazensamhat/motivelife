import { getSession } from "@/lib/session";
import { getUserSubscription } from "@/lib/subscription";
import { isStripeConfigured } from "@/lib/stripe";
import { json, unauthorized, serverError } from "@/lib/api";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const subscription = await getUserSubscription(session.id);
    return json({
      userId: session.id,
      subscription,
      stripeConfigured: isStripeConfigured(),
      appleIapAvailable: true,
    });
  } catch (error) {
    console.error("[api/subscription/status]", error);
    return serverError("Could not load subscription.");
  }
}
