import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@forward/database";
import { destroySession, getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { clearPasswordResetTokens } from "@/lib/password-reset";

const schema = z.object({
  password: z.string().min(1),
  confirmation: z.literal("DELETE"),
});

/** Permanently delete the signed-in account and related data (App Store 5.1.1). */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Type DELETE and enter your password to permanently delete your account.');
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, passwordHash: true, disabledAt: true },
    });
    if (!user || user.disabledAt) return unauthorized();

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) return badRequest("Password is incorrect.");

    await clearPasswordResetTokens(user.id);

    // Cascades cover most related rows; delete user last.
    await prisma.user.delete({ where: { id: user.id } });
    await destroySession();

    return json({ ok: true, message: "Your MotiveLife account has been permanently deleted." });
  } catch (error) {
    console.error("[api/account/delete]", error);
    return serverError("Could not delete your account. Try again or email support.");
  }
}
