import { z } from "zod";
import { prisma } from "@forward/database";
import {
  VITALU_ACTIVITY_LEVELS,
  VITALU_PLAN_INTENTS,
  VITALU_SEXES,
  VITALU_UNITS,
} from "@forward/shared";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { ensureVitaluSchema } from "@/lib/vitalu/ensure-schema";
import { getOrCreateHealthProfile, loadVitaluToday } from "@/lib/vitalu/load";
import { proposeVitaluTargets } from "@/lib/vitalu/plan-targets";

const patchSchema = z.object({
  biologicalSex: z.enum(VITALU_SEXES).optional().nullable(),
  heightCm: z.number().min(100).max(250).optional().nullable(),
  currentWeightKg: z.number().min(30).max(400).optional().nullable(),
  goalWeightKg: z.number().min(30).max(400).optional().nullable(),
  activityLevel: z.enum(VITALU_ACTIVITY_LEVELS).optional().nullable(),
  planIntent: z.enum(VITALU_PLAN_INTENTS).optional().nullable(),
  units: z.enum(VITALU_UNITS).optional(),
  vaultShareLifeGraph: z.boolean().optional(),
  vaultShareVyra: z.boolean().optional(),
  applyProposedTargets: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await ensureVitaluSchema();
    const data = await loadVitaluToday(session.id);
    return json(data);
  } catch (error) {
    console.error("[api/vitalu]", error);
    return serverError("Vitalu unavailable. Run: pnpm db:push");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await ensureVitaluSchema();
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid Vitalu profile input.");

    await getOrCreateHealthProfile(session.id);
    const { applyProposedTargets, ...rest } = parsed.data;

    let targets: ReturnType<typeof proposeVitaluTargets> | null = null;
    if (applyProposedTargets) {
      const current = await prisma.healthProfile.findUnique({ where: { userId: session.id } });
      const weightKg = rest.currentWeightKg ?? current?.currentWeightKg;
      const heightCm = rest.heightCm ?? current?.heightCm;
      const activityLevel = rest.activityLevel ?? (current?.activityLevel as typeof rest.activityLevel);
      const planIntent = rest.planIntent ?? (current?.planIntent as typeof rest.planIntent);
      const sex = rest.biologicalSex ?? (current?.biologicalSex as typeof rest.biologicalSex);
      if (weightKg && heightCm && activityLevel && planIntent) {
        const user = await prisma.user.findUnique({
          where: { id: session.id },
          select: { birthYear: true },
        });
        targets = proposeVitaluTargets({
          weightKg,
          heightCm,
          birthYear: user?.birthYear,
          sex: sex ?? "UNSPECIFIED",
          activityLevel,
          planIntent,
        });
      }
    }

    await prisma.healthProfile.update({
      where: { userId: session.id },
      data: {
        ...rest,
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

    const data = await loadVitaluToday(session.id);
    return json({ ...data, proposed: targets });
  } catch (error) {
    console.error("[api/vitalu]", error);
    return serverError("Could not update Vitalu.");
  }
}
