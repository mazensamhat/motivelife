import { z } from "zod";
import { prisma } from "@forward/database";
import { badRequest, json, serverError } from "@/lib/api";
import { adminRedirectPath } from "@/lib/admin";
import { createSession } from "@/lib/session";
import { verifyPhoneCode } from "@/lib/phone-verification";
import { issuePasswordResetToken } from "@/lib/password-reset";

const schema = z.object({
  challengeId: z.string().min(1),
  code: z.string().length(6),
  purpose: z.enum(["signup", "login", "reset"]).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Enter the 6-digit code.");

    const record = await verifyPhoneCode(parsed.data.challengeId, parsed.data.code);
    if (!record) return badRequest("Invalid or expired code.");

    if (record.purpose === "signup" || record.purpose === "login") {
      if (!record.userId) return badRequest("Verification session invalid.");

      const user = await prisma.user.update({
        where: { id: record.userId },
        data: {
          lastSeenAt: new Date(),
          ...(record.purpose === "signup" ? { phoneVerifiedAt: new Date() } : {}),
        },
        select: { id: true, email: true, name: true },
      });

      await createSession(user);
      return json({
        ok: true,
        redirectTo: adminRedirectPath(user.email),
      });
    }

    if (record.purpose === "reset") {
      if (!record.userId) return badRequest("Verification session invalid.");

      const token = await issuePasswordResetToken(record.userId);
      return json({
        ok: true,
        redirectTo: `/reset-password?token=${encodeURIComponent(token)}`,
      });
    }

    return badRequest("Unknown verification purpose.");
  } catch (error) {
    console.error("[auth/phone/verify]", error);
    return serverError("Could not verify code.");
  }
}
