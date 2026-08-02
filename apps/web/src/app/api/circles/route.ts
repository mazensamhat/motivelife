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

    await createCircle({
      userId: session.id,
      name: parsed.data.name ?? (parsed.data.type === "FRIENDS" ? "Buddies" : "Circle"),
      type: parsed.data.type,
      displayName: session.name,
    });

    const [circles, activeCircle] = await Promise.all([
      listCirclesForUser(session.id),
      getActiveFriendsCircle(session.id),
    ]);
    return json({ circles, activeCircle });
  } catch (error) {
    console.error("[api/circles POST]", error);
    return serverError(databaseErrorMessage(error, "Could not create circle."));
  }
}
