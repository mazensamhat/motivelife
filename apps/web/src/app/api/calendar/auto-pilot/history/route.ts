import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { json, unauthorized, serverError } from "@/lib/api";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const actions = await prisma.autoPilotAction.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    return json({ actions });
  } catch (error) {
    console.error("[api/calendar/auto-pilot/history]", error);
    return serverError("Could not load Auto-Pilot history.");
  }
}
