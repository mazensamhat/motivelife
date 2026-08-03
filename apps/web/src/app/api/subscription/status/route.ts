import { FAMILY_MEMBER_PRO_UPGRADE_LABEL } from "@forward/shared";
import { getSession } from "@/lib/session";
import { getUserSubscription } from "@/lib/subscription";
import { isStripeConfigured, isStripeMemberProConfigured } from "@/lib/stripe";
import { getMemberForUser } from "@/lib/family-map/household";
import { json, unauthorized, serverError } from "@/lib/api";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const subscription = await getUserSubscription(session.id);
    const member = await getMemberForUser(session.id).catch(() => null);
    /** Invited household members (not the owner) can buy Twin Pro for $5. */
    const eligibleForMemberPro =
      !subscription.isPremium && Boolean(member && member.role === "MEMBER");

    return json({
      userId: session.id,
      subscription,
      stripeConfigured: isStripeConfigured(),
      memberProConfigured: isStripeMemberProConfigured(),
      eligibleForMemberPro,
      memberProPriceLabel: FAMILY_MEMBER_PRO_UPGRADE_LABEL,
      appleIapAvailable: true,
    });
  } catch (error) {
    console.error("[api/subscription/status]", error);
    return serverError("Could not load subscription.");
  }
}
