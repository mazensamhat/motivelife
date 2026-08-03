import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { databaseErrorMessage } from "@/lib/db-error";
import {
  createCircle,
  getActiveFriendsCircle,
  listCirclesForUser,
} from "@/lib/family-map/circles";

const createSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  type: z.enum(["FAMILY", "FRIENDS", "CUSTOM"]).default("FRIENDS"),
  shareMinutes: z.number().int().min(30).max(10080).optional(),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const [circles, activeCircle] = await Promise.all([
      listCirclesForUser(session.id),
      getActiveFriendsCircle(session.id),
    ]);
    return json({ circles, activeCircle });
  } catch (error) {
    console.error("[api/circles GET]", error);
    return serverError(databaseErrorMessage(error, "Could not load circles."));
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid circle.");

    // Temporary / CUSTOM circles require Family Intelligence.
    if (parsed.data.type === "CUSTOM") {
      const { getViewerFamilyEntitlements } = await import(
        "@/lib/family-map/require-intelligence"
      );
      const { entitlements } = await getViewerFamilyEntitlements();
      if (!entitlements?.intelligence) {
        return badRequest("Upgrade to MyMotiveFamily to create temporary Circles.");
      }
    }

    const circle = await createCircle({
      userId: session.id,
      name:
        parsed.data.name ??
        (parsed.data.type === "FRIENDS"
          ? "Buddies"
          : parsed.data.type === "CUSTOM"
            ? "Temporary circle"
            : "Circle"),
      type: parsed.data.type,
      displayName: session.name,
      shareMinutes: parsed.data.shareMinutes,
    });

    const [circles, activeCircle] = await Promise.all([
      listCirclesForUser(session.id),
      getActiveFriendsCircle(session.id),
    ]);
    return json({
      circles,
      activeCircle,
      circle: { id: circle.id, inviteCode: circle.inviteCode, name: circle.name },
      inviteCode: circle.inviteCode,
    });
  } catch (error) {
    console.error("[api/circles POST]", error);
    return serverError(databaseErrorMessage(error, "Could not create circle."));
  }
}
