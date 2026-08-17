import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { ensureVitaluSchema } from "@/lib/vitalu/ensure-schema";
import { getOrCreateHealthProfile, loadVitaluToday } from "@/lib/vitalu/load";
import { kgFromLb } from "@/lib/vitalu/plan-targets";

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

    const kg = parsed.data.unit === "LB" ? kgFromLb(parsed.data.value) : parsed.data.value;
    await getOrCreateHealthProfile(session.id);
    await prisma.vitaluWeightLog.create({
      data: { userId: session.id, kg, source: "MANUAL" },
    });
    await prisma.healthProfile.update({
      where: { userId: session.id },
      data: { currentWeightKg: kg },
    });
    return json(await loadVitaluToday(session.id), 201);
  } catch (error) {
    console.error("[api/vitalu/weight]", error);
    return serverError("Could not log weight.");
  }
}
