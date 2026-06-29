import { getSession } from "@/lib/session";
import { getOrCreateMonthlyReview } from "@/lib/forward";
import { json, unauthorized, serverError, startOfMonth } from "@/lib/api";
import { prisma } from "@forward/database";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get("refresh") === "true";

    if (refresh) {
      const monthStart = startOfMonth();
      await prisma.monthlyReview.deleteMany({
        where: { userId: session.id, monthStart: { gte: monthStart } },
      });
    }

    const review = await getOrCreateMonthlyReview(session.id, session.name);
    return json({ review });
  } catch (error) {
    console.error("[api/monthly-review]", error);
    return serverError("Could not load monthly review. Run: npx pnpm@9.15.0 db:push");
  }
}
