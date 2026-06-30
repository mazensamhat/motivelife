import { z } from "zod";
import { prisma } from "@forward/database";
import { badRequest, json, serverError } from "@/lib/api";
import { sendPasswordResetEmail } from "@/lib/email";
import { issuePasswordResetToken } from "@/lib/password-reset";

const schema = z.object({
  email: z.string().email(),
});

const GENERIC_MESSAGE =
  "If an account exists for that email, we sent a password reset link.";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Enter a valid email address.");

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true },
    });

    if (user) {
      const token = await issuePasswordResetToken(user.id);
      const sent = await sendPasswordResetEmail(user.email, token);

      if (!sent) {
        console.error("[auth/forgot-password] Email not sent — configure RESEND_API_KEY");
        return serverError(
          "Password reset email is not configured yet. Contact support or try again later.",
        );
      }
    }

    return json({ message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("[auth/forgot-password]", error);
    return serverError("Could not process password reset request.");
  }
}
