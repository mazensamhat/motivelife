import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@forward/database";
import { badRequest, json, serverError } from "@/lib/api";
import { createSession } from "@/lib/session";
import { adminRedirectPath } from "@/lib/admin";
import {
  clearPasswordResetTokens,
  findValidPasswordResetUserId,
} from "@/lib/password-reset";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Password must be at least 8 characters.");

    const userId = await findValidPasswordResetUserId(parsed.data.token);
    if (!userId) {
      return badRequest("This reset link is invalid or has expired. Request a new one.");
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: { id: true, email: true, name: true },
    });

    await clearPasswordResetTokens(userId);
    await createSession(user);

    return json({
      message: "Password updated.",
      redirectTo: adminRedirectPath(user.email),
    });
  } catch (error) {
    console.error("[auth/reset-password]", error);
    return serverError("Could not reset password.");
  }
}
