import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import {
  addLifeCircleMember,
  getLifeCircleSummary,
  removeLifeCircleMember,
  updateLifeCircleMember,
} from "@/lib/life-circle-server";

const addSchema = z.object({
  displayName: z.string().min(1).max(80),
  relationship: z.enum(["FRIEND", "FAMILY"]),
});

const patchSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).max(80).optional(),
  relationship: z.enum(["FRIEND", "FAMILY"]).optional(),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const circle = await getLifeCircleSummary(session.id);
    return json(circle);
  } catch (error) {
    console.error("[api/life-circle]", error);
    return serverError("Could not load Life Circle.");
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) return badRequest("Enter a name and choose friend or family.");

    try {
      await addLifeCircleMember(session.id, parsed.data.displayName, parsed.data.relationship);
    } catch (error) {
      if (error instanceof Error && error.message === "CIRCLE_FULL") {
        return badRequest("Your Life Circle is full (5 people max).");
      }
      throw error;
    }

    const circle = await getLifeCircleSummary(session.id);
    return json(circle);
  } catch (error) {
    console.error("[api/life-circle POST]", error);
    return serverError("Could not add circle member.");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid update.");

    try {
      await updateLifeCircleMember(session.id, parsed.data.id, {
        displayName: parsed.data.displayName,
        relationship: parsed.data.relationship,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        return badRequest("Circle member not found.");
      }
      throw error;
    }

    const circle = await getLifeCircleSummary(session.id);
    return json(circle);
  } catch (error) {
    console.error("[api/life-circle PATCH]", error);
    return serverError("Could not update circle member.");
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid request.");

    try {
      await removeLifeCircleMember(session.id, parsed.data.id);
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        return badRequest("Circle member not found.");
      }
      throw error;
    }

    const circle = await getLifeCircleSummary(session.id);
    return json(circle);
  } catch (error) {
    console.error("[api/life-circle DELETE]", error);
    return serverError("Could not remove circle member.");
  }
}
