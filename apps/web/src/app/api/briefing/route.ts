import { getSession } from "@/lib/session";
import { getOrCreateDailyBriefing, refreshSuggestions } from "@/lib/forward";
import { json, unauthorized, serverError } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get("refresh") === "true";

    if (refresh) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { prisma } = await import("@forward/database");
      await prisma.dailyBriefing.deleteMany({
        where: { userId: session.id, date: { gte: today } },
      });
    }

    const [briefing, suggestions] = await Promise.all([
      getOrCreateDailyBriefing(session.id, session.name),
      refreshSuggestions(session.id),
    ]);

    return json({ briefing, suggestions });
  } catch (error) {
    console.error("[api/briefing]", error);
    return serverError("Could not load briefing. Run: npx pnpm@9.15.0 db:push");
  }
}