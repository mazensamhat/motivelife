import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@forward/database";
import { createSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { adminRedirectPath } from "@/lib/admin";
import { defaultTrialEndsAt } from "@/lib/subscription";
import { databaseErrorMessage } from "@/lib/db-error";

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

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        disabledAt: true,
        trialEndsAt: true,
        subscriptionPlan: true,
        googleSub: true,
        appleSub: true,
      },
    });
    if (!user) return unauthorized("Invalid email or password.");
    if (user.disabledAt) return unauthorized("This account has been disabled. Contact support.");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      if (user.googleSub || user.appleSub) {
        return unauthorized(
          "This account uses Google or Apple sign-in. Use the button below, or reset your password after linking email login.",
        );
      }
      return unauthorized("Invalid email or password.");
    }

    if (!user.trialEndsAt && user.subscriptionPlan === "trial") {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { trialEndsAt: defaultTrialEndsAt(), lastSeenAt: new Date() },
        });
      } catch (updateError) {
        console.warn("[auth/login] trial/lastSeen update failed", updateError);
      }
    } else {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastSeenAt: new Date() },
        });
      } catch (updateError) {
        console.warn("[auth/login] lastSeen update failed", updateError);
      }
    }

    await createSession({ id: user.id, email: user.email, name: user.name });
    return json({
      user: { id: user.id, email: user.email, name: user.name },
      redirectTo: adminRedirectPath(user.email),
    });
  } catch (error) {
    console.error("[auth/login]", error);
    return serverError(
      databaseErrorMessage(error, "Could not sign in. Check that the database is set up."),
    );
  }
}
