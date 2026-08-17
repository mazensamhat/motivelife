import { getSession } from "@/lib/session";
import {
  addFamilyExtraSeatPack,
  getFamilySeatInfoForUser,
  reconcileFamilySeatPacksFromStripe,
  removeFamilyExtraSeatPack,
} from "@/lib/family-seats";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const seats = await getFamilySeatInfoForUser(session.id);
    if (seats?.isOwner && seats.hasFamilyPlan) {
      await reconcileFamilySeatPacksFromStripe(session.id);
    }
    const refreshed = await getFamilySeatInfoForUser(session.id);
    if (!refreshed) {
      return json({
        inHousehold: false,
      });
    }

    return json({
      inHousehold: true,
      seats: refreshed,
    });
  } catch (error) {
    console.error("[api/subscription/family-seats GET]", error);
    return serverError("Could not load household seats.");
  }
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const seats = await getFamilySeatInfoForUser(session.id);
    if (!seats?.isOwner) {
      return badRequest("Only the household owner can add extra seats.");
    }
    if (!seats.hasFamilyPlan) {
      return badRequest("Unlock KINZO AI first, then add extra household seats.");
    }
    if (!seats.canAddPack) {
      return badRequest("Your household is already at the maximum seat limit.");
    }

    try {
      const result = await addFamilyExtraSeatPack(session.id);
      return json({
        ok: true,
        extraSeatPacks: result.extraSeatPacks,
        seatLimit: result.seatLimit,
        message: `Added ${seats.packSize} seats. Your household can now have up to ${result.seatLimit} members.`,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "SEAT_PACKS_MAX") {
          return badRequest("Maximum extra seat packs already purchased.");
        }
        if (error.message === "STRIPE_SUB_REQUIRED") {
          return badRequest(
            "Extra seats bill through Stripe on your KINZO AI subscription. Subscribe via web Settings first, or use Manage billing."
          );
        }
        if (error.message === "EXTRA_SEATS_PRICE_MISSING") {
          return badRequest(
            "Extra seat packs need STRIPE_FAMILY_EXTRA_SEATS_PRICE_ID ($5.99 CAD/mo +2 seats) in Vercel, then redeploy."
          );
        }
        if (error.message === "FAMILY_PLAN_REQUIRED") {
          return badRequest("Unlock KINZO AI first, then add extra household seats.");
        }
      }
      throw error;
    }
  } catch (error) {
    console.error("[api/subscription/family-seats POST]", error);
    return serverError("Could not add extra seats.");
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const seats = await getFamilySeatInfoForUser(session.id);
    if (!seats?.isOwner) {
      return badRequest("Only the household owner can remove extra seats.");
    }
    if (!seats.hasFamilyPlan) {
      return badRequest("Unlock KINZO AI first to manage household seats.");
    }
    if (!seats.canRemovePack) {
      if (seats.extraSeatPacks <= 0) {
        return badRequest("No extra seat packs to remove.");
      }
      const nextLimit = seats.seatLimit - seats.packSize;
      return badRequest(
        `Remove ${seats.linkedCount - nextLimit} member${seats.linkedCount - nextLimit === 1 ? "" : "s"} first — you have ${seats.linkedCount} linked but the lower limit would be ${nextLimit}.`
      );
    }

    try {
      const result = await removeFamilyExtraSeatPack(session.id);
      return json({
        ok: true,
        extraSeatPacks: result.extraSeatPacks,
        seatLimit: result.seatLimit,
        message: `Removed ${seats.packSize} seats. Your household can now have up to ${result.seatLimit} members.`,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "SEAT_PACKS_MIN") {
          return badRequest("No extra seat packs to remove.");
        }
        if (error.message === "SEATS_IN_USE") {
          return badRequest(
            "Too many members linked for the lower seat limit. Remove members first, then remove the seat pack."
          );
        }
        if (error.message === "STRIPE_SUB_REQUIRED") {
          return badRequest(
            "Extra seats bill through Stripe on your KINZO AI subscription. Subscribe via web Settings first, or use Manage billing."
          );
        }
        if (error.message === "EXTRA_SEATS_PRICE_MISSING") {
          return badRequest(
            "Extra seat packs need STRIPE_FAMILY_EXTRA_SEATS_PRICE_ID in Vercel, then redeploy."
          );
        }
        if (error.message === "FAMILY_PLAN_REQUIRED") {
          return badRequest("Unlock KINZO AI first to manage household seats.");
        }
      }
      throw error;
    }
  } catch (error) {
    console.error("[api/subscription/family-seats DELETE]", error);
    return serverError("Could not remove extra seats.");
  }
}
