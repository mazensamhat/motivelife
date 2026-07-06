import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";

const prepItemSchema = z.object({
  label: z.string().min(1),
  done: z.boolean(),
});

const putSchema = z.object({
  eventKey: z.string().min(1).max(500),
  items: z.array(prepItemSchema),
});

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const key = new URL(request.url).searchParams.get("key");
    if (!key) return badRequest("Missing event key.");

    const row = await prisma.eventPrepState.findUnique({
      where: { userId_eventKey: { userId: session.id, eventKey: key } },
    });

    if (!row) return json({ items: null });

    return json({ items: JSON.parse(row.items) });
  } catch (error) {
    console.error("[api/event-prep GET]", error);
    return serverError("Could not load prep state.");
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid prep payload.");

    const { eventKey, items } = parsed.data;

    await prisma.eventPrepState.upsert({
      where: { userId_eventKey: { userId: session.id, eventKey } },
      create: {
        userId: session.id,
        eventKey,
        items: JSON.stringify(items),
      },
      update: {
        items: JSON.stringify(items),
      },
    });

    return json({ ok: true });
  } catch (error) {
    console.error("[api/event-prep PUT]", error);
    return serverError("Could not save prep state.");
  }
}
