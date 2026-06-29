import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized } from "@/lib/api";
import { prisma } from "@forward/database";
import { awardLifeXp } from "@/lib/life-xp";
import { completeCoachingDay } from "@/lib/adaptive-coaching";
import { recordLifeMoment } from "@/lib/life-moments";
import { z } from "zod";

const patchSchema = z.object({
  day: z.number().int().min(1).max(7),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input");

  const result = await completeCoachingDay(session.id, id, parsed.data.day);

  const loop = await prisma.coachingLoop.findFirst({ where: { id, userId: session.id } });
  const moduleDim =
    loop?.module === "money"
      ? "money"
      : loop?.module === "health"
        ? "health"
        : loop?.module === "learning"
          ? "learning"
          : loop?.module === "career"
            ? "career"
            : loop?.module === "relationships"
              ? "communication"
              : "confidence";

  await awardLifeXp(session.id, [
    {
      dimension: moduleDim as "money" | "health" | "learning" | "career" | "communication" | "confidence",
      amount: 12,
      reason: "Coaching challenge day completed",
      sourceType: "CHALLENGE",
      sourceId: id,
    },
    {
      dimension: "confidence",
      amount: 6,
      reason: "Follow-through on your improvement plan",
      sourceType: "CHALLENGE",
      sourceId: id,
    },
  ]);

  if (result.challengeComplete && loop) {
    await recordLifeMoment(session.id, {
      title: `Completed 7-day challenge: ${loop.title}`,
      domain:
        loop.module === "money"
          ? "MONEY"
          : loop.module === "health"
            ? "HEALTH"
            : loop.module === "learning"
              ? "LEARNING"
              : loop.module === "relationships"
                ? "RELATIONSHIPS"
                : "CAREER",
      scoreDelta: 12,
      sourceType: "CHALLENGE",
      sourceId: id,
    });
    await awardLifeXp(session.id, [
      {
        dimension: moduleDim as "money" | "health" | "learning" | "career" | "communication" | "confidence",
        amount: 40,
        reason: `7-day challenge complete — ${loop.title}`,
        sourceType: "CHALLENGE",
        sourceId: id,
      },
      {
        dimension: "confidence",
        amount: 25,
        reason: "Finished what you started",
        sourceType: "CHALLENGE",
        sourceId: id,
      },
    ]);
  }

  return json(result);
}
