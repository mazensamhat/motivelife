import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import { json, unauthorized, serverError, badRequest } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = (await request.json()) as { action?: string };
    const stripe = getStripe();

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { stripeSubscriptionId: true },
    });

    if (body.action === "pause") {
      if (stripe && user?.stripeSubscriptionId) {
        await stripe.subscriptions.update(user.stripeSubscriptionId, {
          pause_collection: { behavior: "mark_uncollectible" },
        });
      }
      await prisma.user.update({
        where: { id: session.id },
        data: { subscriptionStatus: "paused" },
      });
      return json({ ok: true, status: "paused" });
    }

    if (body.action === "resume") {
      if (stripe && user?.stripeSubscriptionId) {
        await stripe.subscriptions.update(user.stripeSubscriptionId, {
          pause_collection: null,
        });
      }
      await prisma.user.update({
        where: { id: session.id },
        data: { subscriptionStatus: "active" },
      });
      return json({ ok: true, status: "active" });
    }

    if (body.action === "cancel") {
      if (stripe && user?.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(user.stripeSubscriptionId);
        } catch (error) {
          console.error("[api/subscription/manage] Stripe cancel", error);
          return badRequest(
            "Could not cancel in Stripe. Use Manage billing or try again."
          );
        }
      }
      await prisma.user.update({
        where: { id: session.id },
        data: { subscriptionStatus: "cancelled" },
      });
      return json({ ok: true, status: "cancelled" });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("[api/subscription/manage]", error);
    return serverError("Could not update subscription.");
  }
}
