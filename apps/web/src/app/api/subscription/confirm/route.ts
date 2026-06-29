import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import { getUserSubscription } from "@/lib/subscription";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";

/** Fallback when webhooks are delayed — verify Stripe Checkout session and activate Pro */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = (await request.json()) as { sessionId?: string };
    const sessionId = body.sessionId?.trim();
    if (!sessionId?.startsWith("cs_")) {
      return badRequest("Missing checkout session id.");
    }

    const stripe = getStripe();
    if (!stripe) return badRequest("Stripe is not configured.");

    const checkout = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (checkout.metadata?.userId && checkout.metadata.userId !== session.id) {
      return unauthorized("Checkout session does not belong to this user.");
    }

    if (checkout.status !== "complete") {
      return badRequest("Checkout is not complete yet.");
    }

    const subId =
      typeof checkout.subscription === "string"
        ? checkout.subscription
        : checkout.subscription?.id;

    if (!subId) return badRequest("No subscription on checkout session.");

    const customerId =
      typeof checkout.customer === "string" ? checkout.customer : checkout.customer?.id;

    await prisma.user.update({
      where: { id: session.id },
      data: {
        subscriptionPlan: "plus",
        subscriptionStatus: "active",
        stripeSubscriptionId: subId,
        ...(customerId ? { stripeCustomerId: customerId } : {}),
      },
    });

    const subscription = await getUserSubscription(session.id);
    return json({ ok: true, subscription });
  } catch (error) {
    console.error("[api/subscription/confirm]", error);
    return serverError("Could not confirm subscription.");
  }
}
