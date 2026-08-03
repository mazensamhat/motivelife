import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { ensureHouseholdForUser } from "@/lib/family-map/household";
import { ensureFamilyMapSchema } from "@/lib/family-map/ensure-schema";

const schema = z.object({
  /** Optional note — keep short. */
  note: z.string().max(200).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
});

/**
 * Household SOS — Life360-style panic ping without insurance / dispatch.
 * Notifies every other household member (in-app + push).
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureFamilyMapSchema();
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid SOS payload.");

    const { household, member } = await ensureHouseholdForUser(session.id, session.name);
    const others = await prisma.familyMember.findMany({
      where: {
        householdId: household.id,
        isSimulated: false,
        NOT: { id: member.id },
        userId: { not: null },
      },
      select: { userId: true, displayName: true },
    });

    const note = parsed.data.note?.trim();
    const where =
      parsed.data.lat != null && parsed.data.lng != null
        ? ` · map pinned near ${parsed.data.lat.toFixed(3)}, ${parsed.data.lng.toFixed(3)}`
        : "";
    const title = `SOS from ${member.displayName}`;
    const bodyText = note
      ? `${member.displayName} sent an SOS: ${note}${where}`
      : `${member.displayName} needs you to check in now.${where}`;

    await Promise.all(
      others
        .filter((o): o is { userId: string; displayName: string } => Boolean(o.userId))
        .map((o) =>
          createNotification({
            userId: o.userId,
            type: "family_sos",
            title,
            body: bodyText,
            href: "/family-map",
            force: true,
          })
        )
    );

    return json({ ok: true, notified: others.length });
  } catch (error) {
    console.error("[api/family/sos]", error);
    return serverError("Could not send SOS.");
  }
}
