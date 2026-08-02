import { z } from "zod";
import { LOCATION_SHARING_LEVELS } from "@forward/shared";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { getMemberForUser } from "@/lib/family-map/household";
import { getFamilyMapState } from "@/lib/family-map/map-state";
import { prisma } from "@forward/database";

const schema = z.object({
  locationSharingLevel: z.enum(LOCATION_SHARING_LEVELS).optional(),
  shareDrivingData: z.boolean().optional(),
  sharePlaceHistory: z.boolean().optional(),
  shareRoutineLearning: z.boolean().optional(),
  shareFamilyInsights: z.boolean().optional(),
  displayName: z.string().min(1).max(80).optional(),
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

    await prisma.familyMember.update({
      where: { id: member.id },
      data: {
        locationSharingLevel: parsed.data.locationSharingLevel,
        shareDrivingData: parsed.data.shareDrivingData,
        sharePlaceHistory: parsed.data.sharePlaceHistory,
        shareRoutineLearning: parsed.data.shareRoutineLearning,
        shareFamilyInsights: parsed.data.shareFamilyInsights,
        displayName: parsed.data.displayName,
      },
    });

    const state = await getFamilyMapState(session.id);
    return json(state);
  } catch (error) {
    console.error("[api/family/privacy]", error);
    return serverError("Could not update privacy settings.");
  }
}
