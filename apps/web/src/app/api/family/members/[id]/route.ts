import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { ensureFamilyMapSchema } from "@/lib/family-map/ensure-schema";
import { getMemberForUser } from "@/lib/family-map/household";
import { getFamilyMapState } from "@/lib/family-map/map-state";

const schema = z.object({
  relationshipLabel: z
    .union([z.string().trim().min(1).max(40), z.literal(""), z.null()])
    .optional(),
  displayName: z.string().trim().min(1).max(80).optional(),
});

/** Update a household member’s relationship label / display name. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureFamilyMapSchema();
    const { id: memberId } = await context.params;

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid member update.");

    const me = await getMemberForUser(session.id);
    if (!me) return badRequest("Join a family first.");

    const target = await prisma.familyMember.findFirst({
      where: { id: memberId, householdId: me.householdId },
      select: { id: true, householdId: true },
    });
    if (!target) return badRequest("Family member not found.");

    const data: { relationshipLabel?: string | null; displayName?: string } = {};
    if (parsed.data.relationshipLabel !== undefined) {
      const raw = parsed.data.relationshipLabel;
      data.relationshipLabel =
        raw == null || raw === "" ? null : String(raw).trim().slice(0, 40);
    }
    if (parsed.data.displayName !== undefined) {
      data.displayName = parsed.data.displayName;
    }
    if (Object.keys(data).length === 0) {
      return badRequest("Nothing to update.");
    }

    await prisma.familyMember.update({
      where: { id: target.id },
      data,
    });

    const state = await getFamilyMapState(session.id);
    return json(state);
  } catch (error) {
    console.error("[api/family/members PATCH]", error);
    return serverError("Could not update family member.");
  }
}
