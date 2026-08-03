import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { ensureFamilyMapSchema } from "@/lib/family-map/ensure-schema";
import { getMemberForUser } from "@/lib/family-map/household";
import { createNotification } from "@/lib/notifications";

/** Ask a household member to turn on live location (in-app notification). */
export async function POST(
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

    const target = await prisma.familyMember.findFirst({
      where: {
        id: memberId,
        householdId: me.householdId,
        isSimulated: false,
        NOT: { userId: null },
      },
      select: { id: true, userId: true, displayName: true },
    });
    if (!target?.userId) return badRequest("That person isn’t linked to an account yet.");
    if (target.userId === session.id) {
      return badRequest("That’s you — turn on Allow location on this phone.");
    }

    const fromName = me.displayName?.trim() || session.name?.trim() || "Someone in your family";

    await createNotification({
      userId: target.userId,
      type: "family_location_ping",
      title: "Family is asking for your location",
      body: `${fromName} wants to see you on Family Map. Open MotiveLife → Family Map → Allow location.`,
      href: "/family-map",
      force: true,
    });

    return json({ ok: true });
  } catch (error) {
    console.error("[api/family/members/ping]", error);
    return serverError("Could not send location request.");
  }
}
