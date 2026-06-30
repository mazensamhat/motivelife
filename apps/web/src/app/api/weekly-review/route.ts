import { getSession } from "@/lib/session";
import { getOrCreateWeeklyReview } from "@/lib/forward";
import { parseAccountabilityPartner } from "@/lib/accountability-partner";
import { getLifeCircleMembers } from "@/lib/life-circle-server";
import { buildVoiceWeeklyRecap } from "@/lib/voice-weekly-recap";
import { json, unauthorized, serverError, startOfWeek, endOfWeek } from "@/lib/api";
import { prisma } from "@forward/database";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get("refresh") === "true";

    if (refresh) {
      const weekStart = startOfWeek();
      await prisma.weeklyReview.deleteMany({
        where: { userId: session.id, weekStart: { gte: weekStart } },
      });
    }

    const review = await getOrCreateWeeklyReview(session.id, session.name);
    const voiceRecap = await buildVoiceWeeklyRecap(session.id, startOfWeek(), endOfWeek());
    const [circle, user] = await Promise.all([
      getLifeCircleMembers(session.id),
      prisma.user.findUnique({
        where: { id: session.id },
        select: { accountabilityPartner: true },
      }),
    ]);
    const firstLinked = circle.find((m) => m.linkedUserId);
    const accountabilityPartner = firstLinked
      ? { name: firstLinked.displayName, linkedUserId: firstLinked.linkedUserId ?? undefined }
      : parseAccountabilityPartner(user?.accountabilityPartner);
    return json({ review, voiceRecap, accountabilityPartner });
  } catch (error) {
    console.error("[api/weekly-review]", error);
    return serverError("Could not load weekly review. Run: npx pnpm@9.15.0 db:push");
  }
}
