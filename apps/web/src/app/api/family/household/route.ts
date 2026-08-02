import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { getMemberForUser } from "@/lib/family-map/household";
import { getFamilyMapState } from "@/lib/family-map/map-state";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

/** Owner renames the household (any name they want). */
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest("Enter a household name (1–60 characters).");

    const member = await getMemberForUser(session.id);
    if (!member) return badRequest("Join a family first.");

    const household = await prisma.familyHousehold.findUnique({
      where: { id: member.householdId },
      select: { id: true, ownerUserId: true },
    });
    if (!household || household.ownerUserId !== session.id) {
      return badRequest("Only the household owner can rename the family.");
    }

    await prisma.familyHousehold.update({
      where: { id: household.id },
      data: { name: parsed.data.name },
    });

    const state = await getFamilyMapState(session.id);
    return json(state);
  } catch (error) {
    console.error("[api/family/household PATCH]", error);
    return serverError("Could not rename household.");
  }
}
