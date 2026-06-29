import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { formatLifeMoment, getLifeMoments, recordLifeMoment } from "@/lib/life-moments";

const createSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(1000).optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 50)));

    const moments = await getLifeMoments(session.id, limit);
    return json({ moments: moments.map(formatLifeMoment) });
  } catch (error) {
    console.error("[api/life-moments]", error);
    return serverError("Could not load life moments.");
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const moment = await recordLifeMoment(session.id, {
      title: parsed.data.title,
      description: parsed.data.description,
      category: "LIFE_EVENT",
      sourceType: "MANUAL",
    });

    return json({ moment: formatLifeMoment(moment) }, 201);
  } catch (error) {
    console.error("[api/life-moments]", error);
    return serverError("Could not save life moment.");
  }
}
