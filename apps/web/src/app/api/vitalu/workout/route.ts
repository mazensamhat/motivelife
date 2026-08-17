import { z } from "zod";
import { prisma } from "@forward/database";
import { VITALU_EQUIPMENT, VITALU_WORKOUT_FEEDBACK } from "@forward/shared";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { ensureVitaluSchema } from "@/lib/vitalu/ensure-schema";
import { getOrCreateHealthProfile, loadVitaluToday } from "@/lib/vitalu/load";
import { assembleVitaluWorkout } from "@/lib/vitalu/workout-engine";

const postSchema = z.object({
  minutes: z.number().int().min(5).max(60).optional(),
  equipment: z.enum(VITALU_EQUIPMENT).optional(),
  yoga: z.boolean().optional(),
});

const patchSchema = z.object({
  id: z.string(),
  complete: z.boolean().optional(),
  feedback: z.enum(VITALU_WORKOUT_FEEDBACK).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await ensureVitaluSchema();
    const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return badRequest("Invalid workout request.");

    const today = await loadVitaluToday(session.id);
    const sessionPlan = assembleVitaluWorkout({
      minutes: parsed.data.minutes ?? 20,
      equipment: parsed.data.equipment ?? "NONE",
      lastFeedback: today.profile.lastWorkoutFeedback ?? null,
      sleepHours: today.sleepHoursLastNight,
      yoga: parsed.data.yoga,
    });

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    await prisma.vitaluWorkout.deleteMany({
      where: { userId: session.id, plannedFor: { gte: start }, completedAt: null },
    });
    await prisma.vitaluWorkout.create({
      data: {
        userId: session.id,
        title: sessionPlan.title,
        minutes: sessionPlan.minutes,
        equipment: sessionPlan.equipment,
        sessionJson: JSON.stringify(sessionPlan),
      },
    });
    return json(await loadVitaluToday(session.id), 201);
  } catch (error) {
    console.error("[api/vitalu/workout]", error);
    return serverError("Could not assemble workout.");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await ensureVitaluSchema();
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest("Invalid workout update.");

    await prisma.vitaluWorkout.updateMany({
      where: { id: parsed.data.id, userId: session.id },
      data: {
        ...(parsed.data.complete ? { completedAt: new Date() } : {}),
        ...(parsed.data.feedback ? { feedback: parsed.data.feedback } : {}),
      },
    });
    if (parsed.data.feedback) {
      await getOrCreateHealthProfile(session.id);
      await prisma.healthProfile.update({
        where: { userId: session.id },
        data: { lastWorkoutFeedback: parsed.data.feedback },
      });
    }
    return json(await loadVitaluToday(session.id));
  } catch (error) {
    console.error("[api/vitalu/workout]", error);
    return serverError("Could not update workout.");
  }
}
