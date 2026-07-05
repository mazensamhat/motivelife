import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import {
  buildLifeFinanceSnapshot,
  getOrCreateFinancialProfile,
  profileToPayload,
} from "@/lib/life-finance-engine";

const patchSchema = z.object({
  grossAnnualIncome: z.number().positive().optional().nullable(),
  monthlyTakeHome: z.number().positive().optional().nullable(),
  monthlyInvestments: z.number().min(0).optional().nullable(),
  retirementTargetAge: z.number().int().min(45).max(80).optional().nullable(),
  emergencyFundMonths: z.number().min(1).max(24).optional().nullable(),
  householdSize: z.number().int().min(1).max(12).optional().nullable(),
  setupComplete: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const [profile, snapshot] = await Promise.all([
      getOrCreateFinancialProfile(session.id),
      buildLifeFinanceSnapshot(session.id),
    ]);

    return json({ profile: profileToPayload(profile), snapshot });
  } catch (error) {
    console.error("[api/financial-profile]", error);
    return serverError("Financial profile unavailable. Run: npx pnpm@9.15.0 db:push");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid financial profile input.");

    await getOrCreateFinancialProfile(session.id);

    const profile = await prisma.financialProfile.update({
      where: { userId: session.id },
      data: parsed.data,
    });

    const snapshot = await buildLifeFinanceSnapshot(session.id);
    return json({ profile: profileToPayload(profile), snapshot });
  } catch (error) {
    console.error("[api/financial-profile]", error);
    return serverError("Could not update financial profile.");
  }
}
