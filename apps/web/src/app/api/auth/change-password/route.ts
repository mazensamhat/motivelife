import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { clearPasswordResetTokens } from "@/lib/password-reset";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("New password must be at least 8 characters.");

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { passwordHash: true, disabledAt: true },
    });
    if (!user || user.disabledAt) return unauthorized();

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) return badRequest("Current password is incorrect.");

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { id: session.id },
      data: { passwordHash },
    });
    await clearPasswordResetTokens(session.id);

    return json({ ok: true, message: "Password updated." });
  } catch (error) {
    console.error("[auth/change-password]", error);
    return serverError("Could not change password.");
  }
}
