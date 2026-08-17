import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { ensureVitaluSchema } from "@/lib/vitalu/ensure-schema";
import { loadVitaluToday } from "@/lib/vitalu/load";
import { answerVitalu } from "@/lib/vitalu/ask";

const schema = z.object({
  message: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await ensureVitaluSchema();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return badRequest("Ask Vitalu a health question.");
    const today = await loadVitaluToday(session.id);
    const result = answerVitalu({
      message: parsed.data.message,
      profile: today.profile,
      score: today.score,
      nutrition: today.nutrition,
      sleepHours: today.sleepHoursLastNight,
      stepsToday: today.stepsToday,
      recoveryRecommended: today.recoveryRecommended,
      healthTrend: today.healthTrend,
      calendarPacked: today.calendarPacked,
    });
    return json({ ...result, disclaimer: true });
  } catch (error) {
    console.error("[api/vitalu/ask]", error);
    return serverError("Ask Vitalu unavailable.");
  }
}
