import { getAppUrl } from "@/lib/stripe";

export function getEmailFrom() {
  return process.env.EMAIL_FROM?.trim() || "MotiveLife <hello@mymotivelife.com>";
}

export function hasResendApiKey() {
  const key = process.env.RESEND_API_KEY?.trim();
  return Boolean(key && key.startsWith("re_"));
}

function parseEmailFrom(from: string) {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim().toLowerCase();
}

export function getEmailConfigStatus() {
  const from = getEmailFrom();
  const fromAddress = parseEmailFrom(from);
  const apiKeySet = hasResendApiKey();
  const fromSet = Boolean(process.env.EMAIL_FROM?.trim());
  const fromLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromAddress);
  const appUrlHttps = Boolean(process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://"));

  return {
    configured: apiKeySet && fromLooksValid && appUrlHttps,
    from,
    fromAddress,
    checklist: [
      { ok: apiKeySet, label: "RESEND_API_KEY is set (starts with re_)" },
      {
        ok: fromSet,
        label: "EMAIL_FROM is set (e.g. MotiveLife <hello@mymotivelife.com>)",
      },
      {
        ok: fromLooksValid,
        label: "EMAIL_FROM contains a valid sender address",
      },
      {
        ok: appUrlHttps,
        label: "NEXT_PUBLIC_APP_URL is HTTPS (reset links use this domain)",
      },
    ],
    setupNote:
      "Verify mymotivelife.com in Resend → Domains, then add RESEND_API_KEY and EMAIL_FROM in Vercel Production.",
  };
}

type SendResult = { ok: true } | { ok: false; error: string };

async function sendViaResend(to: string, subject: string, html: string): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not set" };
  }

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
    return { ok: false, error: body || `Resend HTTP ${res.status}` };
  }

  return { ok: true };
}

export async function sendTestEmail(to: string) {
  const subject = "MotiveLife email test";
  const html = `
    <p>This is a test email from MotiveLife production.</p>
    <p>If you received this, password reset emails should work.</p>
    <p>— MotiveLife</p>
  `.trim();
  return sendViaResend(to, subject, html);
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

  const result = await sendViaResend(email, subject, html);

  if (!result.ok && process.env.NODE_ENV === "development") {
    console.log(`[email] Password reset link for ${email}: ${resetUrl}`);
    return true;
  }

  return result.ok;
}
