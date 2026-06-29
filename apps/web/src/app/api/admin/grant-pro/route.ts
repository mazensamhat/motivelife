import { z } from "zod";
import { prisma } from "@forward/database";
import { requireAdmin } from "@/lib/admin";
import { badRequest, json, serverError } from "@/lib/api";

const schema = z.object({
  email: z.string().email(),
});

/** Admin-only: grant MotiveLife Pro without Stripe (launch / support tool). */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Valid email required.");

    const user = await prisma.user.update({
      where: { email: parsed.data.email.toLowerCase() },
      data: {
        subscriptionPlan: "plus",
        subscriptionStatus: "active",
      },
      select: { email: true, name: true, subscriptionPlan: true, subscriptionStatus: true },
    });

    return json({ ok: true, user });
  } catch {
    return serverError("User not found or could not update.");
  }
}
