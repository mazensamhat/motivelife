import { FAMILY_MEMBER_PRO_UPGRADE_LABEL } from "@forward/shared";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import {
  defaultTrialEndsAt,
  getUserSubscription,
} from "@/lib/subscription";
import {
  isStripeConfigured,
  isStripeFamilyConfigured,
  isStripeMemberProConfigured,
} from "@/lib/stripe";
import { getMemberForUser } from "@/lib/family-map/household";
import { json, unauthorized, serverError } from "@/lib/api";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    // Heal legacy rows that were marked plan=trial but never got a trialEndsAt.
    // Does not invent trials for free / family-invite accounts.
    const row = await prisma.user.findUnique({
      where: { id: session.id },
      select: { subscriptionPlan: true, trialEndsAt: true },
    });
    if (row?.subscriptionPlan === "trial" && !row.trialEndsAt) {
      await prisma.user.update({
        where: { id: session.id },
        data: { trialEndsAt: defaultTrialEndsAt() },
      });
    }

    const subscription = await getUserSubscription(session.id);
    const member = await getMemberForUser(session.id).catch(() => null);
    /** Invited household members (not the owner) can buy Twin Pro for $5. */
    const eligibleForMemberPro =
      !subscription.isPremium && Boolean(member && member.role === "MEMBER");
    const eligibleForFamilyCheckout = Boolean(member && member.role === "OWNER");

    return json({
      userId: session.id,
      subscription,
      stripeConfigured: isStripeConfigured(),
      familyConfigured: isStripeFamilyConfigured(),
      memberProConfigured: isStripeMemberProConfigured(),
      eligibleForMemberPro,
      eligibleForFamilyCheckout,
      memberProPriceLabel: FAMILY_MEMBER_PRO_UPGRADE_LABEL,
      appleIapAvailable: true,
    });
  } catch (error) {
    console.error("[api/subscription/status]", error);
    return serverError("Could not load subscription.");
  }
}
