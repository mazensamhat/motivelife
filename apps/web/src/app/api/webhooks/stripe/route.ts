import { prisma } from "@forward/database";
import { getStripe } from "@/lib/stripe";
import { json, serverError } from "@/lib/api";
import type Stripe from "stripe";

export const runtime = "nodejs";

async function activatePro(userId: string, subscriptionId: string, customerId?: string | null) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionPlan: "plus",
      subscriptionStatus: "active",
      stripeSubscriptionId: subscriptionId,
      ...(customerId ? { stripeCustomerId: customerId } : {}),
    },
  });
}

async function deactivatePro(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionPlan: "trial",
      subscriptionStatus: "cancelled",
      stripeSubscriptionId: null,
    },
  });
}

async function resolveUserIdFromSubscription(sub: Stripe.Subscription): Promise<string | null> {
  if (sub.metadata?.userId) return sub.metadata.userId;

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return null;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function resolveUserIdFromCheckout(session: Stripe.Checkout.Session): Promise<string | null> {
  if (session.metadata?.userId) return session.metadata.userId;

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!customerId) return null;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function POST(request: Request) {
  try {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!stripe || !webhookSecret || webhookSecret.includes("...")) {
      return json({ error: "Stripe webhook not configured" }, 503);
    }

    const body = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (!signature) return json({ error: "Missing signature" }, 400);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch {
      return json({ error: "Invalid signature" }, 400);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        const userId = await resolveUserIdFromCheckout(checkoutSession);
        const subId =
          typeof checkoutSession.subscription === "string"
            ? checkoutSession.subscription
            : checkoutSession.subscription?.id;
        const customerId =
          typeof checkoutSession.customer === "string"
            ? checkoutSession.customer
            : checkoutSession.customer?.id;
        if (userId && subId) await activatePro(userId, subId, customerId);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await resolveUserIdFromSubscription(sub);
        if (!userId) break;
        if (sub.status === "active" || sub.status === "trialing") {
          const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
          await activatePro(userId, sub.id, customerId);
        } else if (sub.status === "past_due") {
          await prisma.user.update({
            where: { id: userId },
            data: { subscriptionStatus: "past_due" },
          });
        } else if (sub.status === "canceled" || sub.status === "unpaid") {
          await deactivatePro(userId);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await resolveUserIdFromSubscription(sub);
        if (userId) await deactivatePro(userId);
        break;
      }
      case "customer.subscription.trial_will_end":
        // Stripe sample logs this — no action required for MotiveLife (we use app-side trial)
        break;
      default:
        break;
    }

    return json({ received: true, status: "success" });
  } catch (error) {
    console.error("[api/webhooks/stripe]", error);
    return serverError("Webhook handler failed.");
  }
}
