import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { ensureFamilyMapSchema } from "@/lib/family-map/ensure-schema";
import { asMemberKind, canLeaveHousehold } from "@/lib/family-map/guardian";
import {
  getMemberForUser,
  isFamilyMemberColor,
} from "@/lib/family-map/household";
import { getFamilyMapState } from "@/lib/family-map/map-state";

const schema = z.object({
  relationshipLabel: z
    .union([z.string().trim().min(1).max(40), z.literal(""), z.null()])
    .optional(),
  displayName: z.string().trim().min(1).max(80).optional(),
  color: z.string().trim().optional(),
});

/** Update a household member’s relationship label / display name / map color. */
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

    const data: {
      relationshipLabel?: string | null;
      displayName?: string;
      color?: string;
    } = {};
    if (parsed.data.relationshipLabel !== undefined) {
      const raw = parsed.data.relationshipLabel;
      data.relationshipLabel =
        raw == null || raw === "" ? null : String(raw).trim().slice(0, 40);
    }
    if (parsed.data.displayName !== undefined) {
      data.displayName = parsed.data.displayName;
    }
    if (parsed.data.color !== undefined) {
      const color = parsed.data.color.trim().toLowerCase();
      if (!isFamilyMemberColor(color)) {
        return badRequest("Pick a valid hex color like #228be6.");
      }
      data.color = color;
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

/**
 * Remove a member (owner) or leave the household (self).
 * Owner cannot be removed; child accounts cannot leave alone.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureFamilyMapSchema();
    const { id: memberId } = await context.params;

    const me = await getMemberForUser(session.id);
    if (!me) return badRequest("Join a family first.");

    const household = await prisma.familyHousehold.findUnique({
      where: { id: me.householdId },
      select: { id: true, ownerUserId: true },
    });
    if (!household) return badRequest("Household not found.");

    const target = await prisma.familyMember.findFirst({
      where: { id: memberId, householdId: me.householdId, isSimulated: false },
    });
    if (!target) return badRequest("Family member not found.");

    const isOwner = household.ownerUserId === session.id;
    const isSelf = target.userId === session.id;

    if (target.userId && target.userId === household.ownerUserId) {
      return badRequest(
        "The family owner can’t be removed. Transfer ownership first (coming soon)."
      );
    }

    if (isSelf) {
      if (!canLeaveHousehold(asMemberKind(target.memberKind))) {
        return badRequest("Child accounts stay in the household. Ask an adult owner to help.");
      }
      if (isOwner) {
        return badRequest("Owners can’t leave while others are in the household.");
      }
    } else if (!isOwner) {
      return badRequest("Only the family owner can remove someone.");
    }

    await prisma.familyMember.delete({ where: { id: target.id } });

    const state = await getFamilyMapState(session.id);
    return json(state);
  } catch (error) {
    console.error("[api/family/members DELETE]", error);
    return serverError("Could not update household membership.");
  }
}
