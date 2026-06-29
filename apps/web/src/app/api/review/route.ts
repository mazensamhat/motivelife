import { getSession } from "@/lib/session";
import { getOrCreateEveningReview } from "@/lib/forward";
import { json, unauthorized, serverError, startOfDay } from "@/lib/api";
import { prisma } from "@forward/database";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get("refresh") === "true";

    if (refresh) {
      const today = startOfDay();
      await prisma.eveningReview.deleteMany({
        where: { userId: session.id, date: { gte: today } },
      });
    }

    const review = await getOrCreateEveningReview(session.id, session.name);
    return json({ review });
  } catch (error) {
    console.error("[api/review]", error);
    return serverError("Could not load review. Run: npx pnpm@9.15.0 db:push");
  }
}
