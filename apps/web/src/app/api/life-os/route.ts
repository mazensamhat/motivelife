import { getSession } from "@/lib/session";
import { getDailyOperatingSystem } from "@/lib/life-os";
import { json, unauthorized, serverError } from "@/lib/api";
import { prisma } from "@forward/database";
import { startOfDay } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get("refresh") === "true";

    if (refresh) {
      const today = startOfDay();
      await prisma.dailyBriefing.deleteMany({
        where: { userId: session.id, date: { gte: today } },
      });
    }

    const os = await getDailyOperatingSystem(session.id, session.name);
    return json(os);
  } catch (error) {
    console.error("[api/life-os]", error);
    return serverError("Could not load your day. Run: npx pnpm@9.15.0 db:push");
  }
}
