import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { joinHouseholdByInviteCode } from "@/lib/family-map/household";
import { getFamilyMapState } from "@/lib/family-map/map-state";

const schema = z.object({
  code: z.string().min(4).max(12),
  displayName: z.string().min(1).max(80).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Enter a valid invite code.");

    try {
      await joinHouseholdByInviteCode(session.id, parsed.data.code, parsed.data.displayName);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "INVALID_CODE") return badRequest("That invite code was not found.");
        if (error.message === "HOUSEHOLD_FULL") return badRequest("This family is full.");
        if (error.message === "ALREADY_IN_HOUSEHOLD") {
          return badRequest("You already belong to a family household.");
        }
      }
      throw error;
    }

    const state = await getFamilyMapState(session.id);
    return json(state);
  } catch (error) {
    console.error("[api/family/join]", error);
    return serverError("Could not join family.");
  }
}
