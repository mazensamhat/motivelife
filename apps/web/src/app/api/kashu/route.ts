import { z } from "zod";
import { prisma } from "@forward/database";
import { KASHU_INCOME_KINDS, KASHU_INCOME_SCENARIOS, KASHU_PAY_FREQUENCIES } from "@forward/shared";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { getOrCreateFinancialProfile } from "@/lib/life-finance-engine";
import { loadKashuForecast, toKashuProfileFields } from "@/lib/kashu/load";
import { ensureKashuSchema } from "@/lib/kashu/ensure-schema";

const patchSchema = z.object({
  liquidBalance: z.number().optional().nullable(),
  safetyFloor: z.number().min(0).optional().nullable(),
  emergencyReserve: z.number().min(0).optional().nullable(),
  payFrequency: z.enum(KASHU_PAY_FREQUENCIES).optional().nullable(),
  nextPayday: z.string().datetime().optional().nullable(),
  paydayAnchorDay: z.number().int().min(1).max(31).optional().nullable(),
  lifestyleBurnDaily: z.number().min(0).optional().nullable(),
  monthlyTakeHome: z.number().positive().optional().nullable(),
  incomeKind: z.enum(KASHU_INCOME_KINDS).optional().nullable(),
  incomeConservative: z.number().min(0).optional().nullable(),
  incomeHigh: z.number().min(0).optional().nullable(),
  transitionJson: z.string().max(20_000).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureKashuSchema();
    const url = new URL(request.url);
    const rawHorizon = Number(url.searchParams.get("horizonDays") ?? "");
    const horizonDays =
      rawHorizon === 14 || rawHorizon === 30 || rawHorizon === 60 || rawHorizon === 90
        ? rawHorizon
        : undefined;
    const scenarioRaw = url.searchParams.get("scenario") ?? "";
    const incomeScenario = (KASHU_INCOME_SCENARIOS as readonly string[]).includes(scenarioRaw)
      ? (scenarioRaw as (typeof KASHU_INCOME_SCENARIOS)[number])
      : undefined;
    const data = await loadKashuForecast(session.id, {
      ...(horizonDays ? { horizonDays } : {}),
      ...(incomeScenario ? { incomeScenario } : {}),
    });
    return json(data);
  } catch (error) {
    console.error("[api/kashu]", error);
    return serverError("Kashu unavailable. Run: pnpm db:push");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await ensureKashuSchema();
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid Kashu profile input.");

    await getOrCreateFinancialProfile(session.id);

    const { nextPayday, ...rest } = parsed.data;
    const profile = await prisma.financialProfile.update({
      where: { userId: session.id },
      data: {
        ...rest,
        ...(nextPayday !== undefined
          ? { nextPayday: nextPayday ? new Date(nextPayday) : null }
          : {}),
      },
    });

    if (parsed.data.liquidBalance != null) {
      const { recordKashuObservation } = await import("@/lib/kashu/learning-store");
      await recordKashuObservation(session.id, parsed.data.liquidBalance, "balance");
    }

    const data = await loadKashuForecast(session.id);
    return json({ ...data, profile: toKashuProfileFields(profile) });
  } catch (error) {
    console.error("[api/kashu PATCH]", error);
    return serverError("Could not update Kashu settings.");
  }
}
