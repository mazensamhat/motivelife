import { z } from "zod";
import { prisma } from "@forward/database";
import { requireAdmin } from "@/lib/admin";
import { badRequest, json, serverError } from "@/lib/api";
import { computeProExpiresAt } from "@/lib/comp-access";

const schema = z.object({
  email: z.string().email(),
  duration: z.enum(["month", "year", "forever"]).optional(),
});

/** Admin-only: grant free MotiveLife Pro without Stripe. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Valid email required.");

    const duration = parsed.data.duration ?? "forever";

    const user = await prisma.user.update({
      where: { email: parsed.data.email.toLowerCase() },
      data: {
        subscriptionPlan: "plus",
        subscriptionStatus: "active",
        proExpiresAt: computeProExpiresAt(duration),
      },
      select: {
        email: true,
        name: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        proExpiresAt: true,
      },
    });

    return json({
      ok: true,
      user: { ...user, proExpiresAt: user.proExpiresAt?.toISOString() ?? null },
    });
  } catch {
    return serverError("User not found or could not update.");
  }
}