import { z } from "zod";
import { LOCATION_SHARING_LEVELS } from "@forward/shared";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { getMemberForUser } from "@/lib/family-map/household";
import { getFamilyMapState } from "@/lib/family-map/map-state";
import { asMemberKind, canManageMemberKind } from "@/lib/family-map/guardian";
import { prisma } from "@forward/database";

const schema = z.object({
  /** Accepted for older clients; always stored as precise. */
  locationSharingLevel: z.enum(LOCATION_SHARING_LEVELS).optional(),
  shareDrivingData: z.boolean().optional(),
  sharePlaceHistory: z.boolean().optional(),
  shareRoutineLearning: z.boolean().optional(),
  shareFamilyInsights: z.boolean().optional(),
  shareDigitalTwinIntegration: z.boolean().optional(),
  displayName: z.string().min(1).max(80).optional(),
  memberKind: z.enum(["ADULT", "TEEN", "CHILD"]).optional(),
});

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid privacy settings.");

    const member = await getMemberForUser(session.id);
    if (!member) return badRequest("Join a family first.");

    const household = await prisma.familyHousehold.findUnique({
      where: { id: member.householdId },
      select: { ownerUserId: true },
    });
    const actorKind = asMemberKind(member.memberKind);
    const isOwner = household?.ownerUserId === session.id;

    let nextKind = parsed.data.memberKind;
    if (nextKind && nextKind !== actorKind) {
      if (!canManageMemberKind({ actorKind, actorIsOwner: !!isOwner })) {
        return badRequest("Only an adult owner can change account type.");
      }
    }

    // locationSharingLevel is ignored — Family Map is always precise for the household.
    await prisma.familyMember.update({
      where: { id: member.id },
      data: {
        locationSharingLevel: "precise",
        shareDrivingData: parsed.data.shareDrivingData,
        sharePlaceHistory: parsed.data.sharePlaceHistory,
        shareRoutineLearning: parsed.data.shareRoutineLearning,
        shareFamilyInsights: parsed.data.shareFamilyInsights,
        shareDigitalTwinIntegration: parsed.data.shareDigitalTwinIntegration,
        displayName: parsed.data.displayName,
        memberKind: nextKind,
        guardianUserId:
          nextKind === "CHILD" && !member.guardianUserId
            ? household?.ownerUserId ?? null
            : undefined,
      },
    });

    const state = await getFamilyMapState(session.id);
    return json(state);
  } catch (error) {
    console.error("[api/family/privacy]", error);
    return serverError("Could not update privacy settings.");
  }
}
