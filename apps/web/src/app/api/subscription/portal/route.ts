import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { getAppUrl, getStripe, resolveStripeCustomerId } from "@/lib/stripe";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const stripe = getStripe();
    if (!stripe) return badRequest("Stripe is not configured.");

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { email: true, stripeCustomerId: true },
    });
    if (!user?.email) return badRequest("User email required.");

    const customerId = await resolveStripeCustomerId(
      stripe,
      session.id,
      user.email,
      user.stripeCustomerId
    );
    if (customerId !== user.stripeCustomerId) {
      await prisma.user.update({
        where: { id: session.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getAppUrl()}/settings`,
    });

    return json({ url: portal.url });
  } catch (error) {
    console.error("[api/subscription/portal]", error);
    return serverError("Could not open billing portal.");
  }
}
