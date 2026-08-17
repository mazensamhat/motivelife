import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { ensureVitaluSchema } from "@/lib/vitalu/ensure-schema";
import { getOrCreateHealthProfile, loadVitaluToday } from "@/lib/vitalu/load";
import { kgFromLb, parseWeightToKg, proposeVitaluTargets } from "@/lib/vitalu/plan-targets";

const schema = z.object({
  value: z.number().min(30).max(900),
  unit: z.enum(["KG", "LB"]).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await ensureVitaluSchema();
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid weight.");

    const kg =
      parseWeightToKg(parsed.data.value, parsed.data.unit === "LB" ? "IMPERIAL" : "METRIC") ??
      (parsed.data.unit === "LB" ? kgFromLb(parsed.data.value) : parsed.data.value);
    if (kg < 30 || kg > 400) return badRequest("Weight should be kg (94) or lb (207).");
    await getOrCreateHealthProfile(session.id);
    await prisma.vitaluWeightLog.create({
      data: { userId: session.id, kg, source: "MANUAL" },
    });
    const profile = await prisma.healthProfile.findUnique({ where: { userId: session.id } });
    let targets: ReturnType<typeof proposeVitaluTargets> | null = null;
    if (profile?.planIntent && profile.activityLevel && profile.heightCm) {
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { birthYear: true },
      });
      targets = proposeVitaluTargets({
        weightKg: kg,
        heightCm: profile.heightCm,
        birthYear: user?.birthYear,
        sex: (profile.biologicalSex as "FEMALE" | "MALE" | "UNSPECIFIED" | null) ?? "UNSPECIFIED",
        activityLevel: profile.activityLevel as "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "VERY_ACTIVE",
        planIntent: profile.planIntent as
          | "LOSE_WEIGHT"
          | "BUILD_MUSCLE"
          | "IMPROVE_FITNESS"
          | "MAINTAIN_WEIGHT"
          | "GET_MORE_ACTIVE"
          | "IMPROVE_FLEXIBILITY"
          | "BUILD_HEALTHY_HABITS",
      });
    }
    await prisma.healthProfile.update({
      where: { userId: session.id },
      data: {
        currentWeightKg: kg,
        ...(targets
          ? {
              calorieTarget: targets.calorieTarget,
              proteinTargetG: targets.proteinTargetG,
              carbsTargetG: targets.carbsTargetG,
              fatTargetG: targets.fatTargetG,
              waterTargetMl: targets.waterTargetMl,
              stepsTarget: targets.stepsTarget,
              workoutsPerWeek: targets.workoutsPerWeek,
            }
          : {}),
      },
    });
    return json(await loadVitaluToday(session.id), 201);
  } catch (error) {
    console.error("[api/vitalu/weight]", error);
    return serverError("Could not log weight.");
  }
}
