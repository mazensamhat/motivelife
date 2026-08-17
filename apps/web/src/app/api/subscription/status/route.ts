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
  isStripeFamilyExtraSeatsConfigured,
  isStripeMemberProConfigured,
} from "@/lib/stripe";
import { memberEligibleForFamilyProUpgrade } from "@/lib/family-map/entitlements";
import { getMemberForUser } from "@/lib/family-map/household";
import { getFamilySeatInfoForUser } from "@/lib/family-seats";
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
    /** Active MyMotiveFamily invitees — household-discounted full Pro ($9.99). */
    const eligibleForMemberPro = await memberEligibleForFamilyProUpgrade({
      role: member?.role ?? "OWNER",
      householdOwnerUserId: member?.household.ownerUserId,
      viewerIsPremium: subscription.isPremium,
    });
    const eligibleForFamilyCheckout = Boolean(member && member.role === "OWNER");
    const familySeats = await getFamilySeatInfoForUser(session.id);

    return json({
      userId: session.id,
      subscription,
      stripeConfigured: isStripeConfigured(),
      familyConfigured: isStripeFamilyConfigured(),
      familyExtraSeatsConfigured: isStripeFamilyExtraSeatsConfigured(),
      memberProConfigured: isStripeMemberProConfigured(),
      eligibleForMemberPro,
      eligibleForFamilyCheckout,
      familySeats,
      memberProPriceLabel: FAMILY_MEMBER_PRO_UPGRADE_LABEL,
      appleIapAvailable: true,
    });
  } catch (error) {
    console.error("[api/subscription/status]", error);
    return serverError("Could not load subscription.");
  }
}
