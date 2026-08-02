import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { databaseErrorMessage } from "@/lib/db-error";
import {
  getActiveFriendsCircle,
  joinCircleByCode,
  listCirclesForUser,
} from "@/lib/family-map/circles";

const schema = z.object({
  code: z.string().min(4).max(12),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Enter a valid invite code.");

    try {
      await joinCircleByCode({
        userId: session.id,
        code: parsed.data.code,
        displayName: session.name,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "INVALID_CODE") return badRequest("That invite code was not found.");
        if (error.message === "CIRCLE_FULL") return badRequest("This circle is full.");
      }
      throw error;
    }

    const [circles, activeCircle] = await Promise.all([
      listCirclesForUser(session.id),
      getActiveFriendsCircle(session.id),
    ]);
    return json({ circles, activeCircle });
  } catch (error) {
    console.error("[api/circles/join]", error);
    return serverError(databaseErrorMessage(error, "Could not join circle."));
  }
}
