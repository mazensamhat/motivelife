import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@forward/database";
import { createSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { adminRedirectPath } from "@/lib/admin";
import { defaultTrialEndsAt } from "@/lib/subscription";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return unauthorized("Invalid email or password.");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return unauthorized("Invalid email or password.");

    if (!user.trialEndsAt && user.subscriptionPlan === "trial") {
      await prisma.user.update({
        where: { id: user.id },
        data: { trialEndsAt: defaultTrialEndsAt(), lastSeenAt: new Date() },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastSeenAt: new Date() },
      });
    }

    await createSession({ id: user.id, email: user.email, name: user.name });
    return json({
      user: { id: user.id, email: user.email, name: user.name },
      redirectTo: adminRedirectPath(user.email),
    });
  } catch (error) {
    console.error("[auth/login]", error);
    return serverError("Could not sign in. Check that the database is set up.");
  }
}
