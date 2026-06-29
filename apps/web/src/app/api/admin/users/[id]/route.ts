import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@forward/database";
import { requireAdmin, isAdminEmail } from "@/lib/admin";
import { badRequest, json, serverError, unauthorized, forbidden } from "@/lib/api";
import { clearPasswordResetTokens } from "@/lib/password-reset";

const schema = z.object({
  disabled: z.boolean().optional(),
  password: z.string().min(8).optional(),
  subscriptionPlan: z.enum(["trial", "plus"]).optional(),
  subscriptionStatus: z.enum(["active", "cancelled", "paused", "past_due", "trial"]).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) return unauthorized(auth.error);
    return forbidden(auth.error);
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input.");

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!target) return badRequest("User not found.");

    if (parsed.data.disabled === true && isAdminEmail(target.email)) {
      return badRequest("Cannot disable an admin account.");
    }

    const data: {
      disabledAt?: Date | null;
      passwordHash?: string;
      subscriptionPlan?: string;
      subscriptionStatus?: string;
    } = {};

    if (parsed.data.disabled === true) data.disabledAt = new Date();
    if (parsed.data.disabled === false) data.disabledAt = null;

    if (parsed.data.password) {
      data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
      await clearPasswordResetTokens(id);
    }

    if (parsed.data.subscriptionPlan) data.subscriptionPlan = parsed.data.subscriptionPlan;
    if (parsed.data.subscriptionStatus) data.subscriptionStatus = parsed.data.subscriptionStatus;

    if (Object.keys(data).length === 0) {
      return badRequest("No changes requested.");
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        disabledAt: true,
      },
    });

    return json({
      ok: true,
      user: {
        ...user,
        disabled: Boolean(user.disabledAt),
        disabledAt: user.disabledAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[admin/users/patch]", error);
    return serverError("Could not update user.");
  }
}
