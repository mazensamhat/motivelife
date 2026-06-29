import { LEGAL_CONTACT } from "@/lib/legal";
import { getAppUrl } from "@/lib/stripe";

function getEmailFrom() {
  return (
    process.env.EMAIL_FROM?.trim() ||
    `MotiveLife <${LEGAL_CONTACT.support}>`
  );
}

async function sendViaResend(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[email] Resend error:", res.status, body);
    return false;
  }

  return true;
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Reset your MotiveLife password";
  const html = `
    <p>We received a request to reset your MotiveLife password.</p>
    <p><a href="${resetUrl}">Reset your password</a></p>
    <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
    <p>— MotiveLife</p>
  `.trim();

  const sent = await sendViaResend(email, subject, html);

  if (!sent && process.env.NODE_ENV === "development") {
    console.log(`[email] Password reset link for ${email}: ${resetUrl}`);
    return true;
  }

  return sent;
}
