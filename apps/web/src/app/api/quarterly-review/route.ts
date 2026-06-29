import { getSession } from "@/lib/session";
import { getOrCreateQuarterlyReview } from "@/lib/forward";
import { json, unauthorized, serverError, startOfQuarter } from "@/lib/api";
import { prisma } from "@forward/database";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get("refresh") === "true";

    if (refresh) {
      const quarterStart = startOfQuarter();
      await prisma.quarterlyReview.deleteMany({
        where: { userId: session.id, quarterStart: { gte: quarterStart } },
      });
    }

    const review = await getOrCreateQuarterlyReview(session.id, session.name);
    return json({ review });
  } catch (error) {
    console.error("[api/quarterly-review]", error);
    return serverError("Could not load quarterly review. Run: npx pnpm@9.15.0 db:push");
  }
}
