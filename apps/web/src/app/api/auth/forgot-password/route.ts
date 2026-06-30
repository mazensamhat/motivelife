import { z } from "zod";
import { prisma } from "@forward/database";
import { badRequest, json, serverError } from "@/lib/api";
import { sendPasswordResetEmail } from "@/lib/email";
import { issuePasswordResetToken } from "@/lib/password-reset";
import { normalizePhoneNumber, maskPhoneNumber } from "@/lib/phone";
import { issuePhoneVerification } from "@/lib/phone-verification";
import { sendVerificationCodeSms } from "@/lib/sms";

const schema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(7).max(24).optional(),
    phoneCountry: z.enum(["CA", "US", "GB", "AU", "OTHER"]).optional().default("US"),
  })
  .refine((data) => data.email || data.phone, {
    message: "Enter an email or phone number.",
  });

const GENERIC_EMAIL_MESSAGE =
  "If an account exists for that email, we sent a password reset link.";

const GENERIC_PHONE_MESSAGE =
  "If an account exists for that phone number, we sent a verification code.";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Enter a valid email or phone number.");

    if (parsed.data.phone) {
      const phoneNumber = normalizePhoneNumber(parsed.data.phoneCountry, parsed.data.phone);
      if (!phoneNumber) return badRequest("Enter a valid phone number.");

      const user = await prisma.user.findFirst({
        where: { phoneNumber, phoneVerifiedAt: { not: null } },
        select: { id: true, phoneNumber: true },
      });

      if (user?.phoneNumber) {
        const { challengeId, code } = await issuePhoneVerification({
          userId: user.id,
          phoneNumber: user.phoneNumber,
          purpose: "reset",
        });

        const sms = await sendVerificationCodeSms(user.phoneNumber, code, "reset");
        if (!sms.ok && process.env.NODE_ENV === "production") {
          console.error("[auth/forgot-password] SMS failed:", sms.error);
          return serverError("Could not send verification code. Try again in a moment.");
        }

        const masked = maskPhoneNumber(user.phoneNumber);
        const redirectTo = `/verify-phone?challenge=${encodeURIComponent(challengeId)}&purpose=reset&masked=${encodeURIComponent(masked)}`;

        return json({
          message: GENERIC_PHONE_MESSAGE,
          requiresPhoneVerification: true,
          redirectTo,
        });
      }

      return json({ message: GENERIC_PHONE_MESSAGE });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email! },
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

    return json({ message: GENERIC_EMAIL_MESSAGE });
  } catch (error) {
    console.error("[auth/forgot-password]", error);
    return serverError("Could not process password reset request.");
  }
}
