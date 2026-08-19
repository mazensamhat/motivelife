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
import { requestTimeZone } from "@/lib/health-day";
import { syncUpliftHealthGoals, syncVitaluLifeOsQuietly } from "@/lib/vitalu/life-os";
import {
  parseHeightToCm,
  parseWeightToKg,
  proposeVitaluTargets,
  VITALU_DEFAULT_HEIGHT_CM,
  VITALU_DEFAULT_WEIGHT_KG,
} from "@/lib/vitalu/plan-targets";

const looseNum = z.preprocess((v) => {
  if (v === undefined) return undefined;
  if (v === "" || v === null) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}, z.number().nullable().optional());

const looseHeight = z.preprocess((v) => {
  if (v === undefined) return undefined;
  if (v === "" || v === null) return null;
  if (typeof v === "number" && Number.isFinite(v) && v !== 0) return v;
  const s = String(v).trim();
  return s || null;
}, z.union([z.string(), z.number()]).nullable().optional());

const patchSchema = z.object({
  biologicalSex: z.enum(VITALU_SEXES).optional().nullable(),
  activityLevel: z.enum(VITALU_ACTIVITY_LEVELS).optional().nullable(),
  planIntent: z.enum(VITALU_PLAN_INTENTS).optional().nullable(),
  units: z.enum(VITALU_UNITS).optional(),
  /** Display-unit height (cm, inches, or 5.10 feet). Keep as string so 5.10 ≠ 5.1. */
  height: looseHeight,
  /** Display-unit weight (kg or lb). */
  weight: looseNum,
  goal: looseNum,
  /** Already-normalized cm from older clients. */
  heightCm: looseNum,
  currentWeightKg: looseNum,
  goalWeightKg: looseNum,
  vaultShareLifeGraph: z.boolean().optional(),
  vaultShareVyra: z.boolean().optional(),
  applyProposedTargets: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await ensureVitaluSchema();
    void syncVitaluLifeOsQuietly(session.id).catch(() => undefined);
    const data = await loadVitaluToday(session.id, { timeZone: requestTimeZone(request) });
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
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.[0] ? String(issue.path[0]) : "profile";
      return badRequest(`Could not save ${field}. Check the plan fields and try again.`);
    }

    await getOrCreateHealthProfile(session.id);
    const current = await prisma.healthProfile.findUnique({ where: { userId: session.id } });
    const { applyProposedTargets, height, weight, goal, heightCm, currentWeightKg, goalWeightKg, ...rest } =
      parsed.data;
    const units = rest.units ?? (current?.units as "METRIC" | "IMPERIAL" | undefined) ?? "METRIC";

    const nextHeightCm =
      parseHeightToCm(height, units) ??
      parseHeightToCm(heightCm, units) ??
      (heightCm != null && heightCm >= 100 && heightCm <= 250 ? heightCm : null);
    const nextWeightKg =
      parseWeightToKg(weight, units) ??
      (currentWeightKg != null && currentWeightKg >= 30 && currentWeightKg <= 400 ? currentWeightKg : null) ??
      parseWeightToKg(currentWeightKg, units);
    const nextGoalKg =
      goal === undefined && goalWeightKg === undefined
        ? undefined
        : parseWeightToKg(goal, units) ??
          (goalWeightKg != null && goalWeightKg >= 30 && goalWeightKg <= 400 ? goalWeightKg : null);

    if (height != null && nextHeightCm == null) {
      return badRequest("Height should be cm (178), inches (70), or feet.inches (5.10).");
    }
    if (weight != null && nextWeightKg == null) {
      return badRequest("Weight should be kg (94) or lb (207).");
    }

    let targets: ReturnType<typeof proposeVitaluTargets> | null = null;
    let usedBodyDefaults = false;
    if (applyProposedTargets) {
      const activityLevel = rest.activityLevel ?? (current?.activityLevel as typeof rest.activityLevel);
      const planIntent = rest.planIntent ?? (current?.planIntent as typeof rest.planIntent);
      const sex = rest.biologicalSex ?? (current?.biologicalSex as typeof rest.biologicalSex);
      const weightKg = nextWeightKg ?? current?.currentWeightKg ?? VITALU_DEFAULT_WEIGHT_KG;
      const heightForPlan = nextHeightCm ?? current?.heightCm ?? VITALU_DEFAULT_HEIGHT_CM;
      usedBodyDefaults =
        (nextWeightKg == null && !current?.currentWeightKg) || (nextHeightCm == null && !current?.heightCm);
      if (activityLevel && planIntent) {
        const user = await prisma.user.findUnique({
          where: { id: session.id },
          select: { birthYear: true },
        });
        targets = proposeVitaluTargets({
          weightKg,
          heightCm: heightForPlan,
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
        ...(nextHeightCm != null ? { heightCm: nextHeightCm } : {}),
        ...(nextWeightKg != null ? { currentWeightKg: nextWeightKg } : {}),
        ...(nextGoalKg !== undefined ? { goalWeightKg: nextGoalKg } : {}),
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

    await syncUpliftHealthGoals(session.id).catch(() => undefined);
    const data = await loadVitaluToday(session.id);
    return json({ ...data, proposed: targets, usedBodyDefaults });
  } catch (error) {
    console.error("[api/vitalu]", error);
    return serverError("Could not update Vitalu.");
  }
}
