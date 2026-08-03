import { z } from "zod";
import { prisma } from "@forward/database";
import { requireAdmin } from "@/lib/admin";
import { badRequest, json, serverError } from "@/lib/api";
import { computeProExpiresAt } from "@/lib/comp-access";

const schema = z.object({
  email: z.string().email().optional(),
  duration: z.enum(["month", "year", "forever"]).optional(),
  /** When true, grant to the signed-in admin (founder self-unlock). */
  self: z.boolean().optional(),
});

/**
 * Admin-only: grant MyMotiveFamily (full Family Map intelligence + Pro).
 * POST { self: true } unlocks the current admin without looking up an email.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input.");

    const duration = parsed.data.duration ?? "forever";
    const email = (
      parsed.data.self ? auth.session.email : parsed.data.email
    )?.trim().toLowerCase();

    if (!email) return badRequest("Email required (or pass self: true).");

    const user = await prisma.user.update({
      where: { email },
      data: {
        subscriptionPlan: "family",
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
