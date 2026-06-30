import { getAppUrl } from "@/lib/stripe";

function readEnvString(name: string): string {
  const raw = process.env[name]?.trim() ?? "";
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

export function getResendApiKey() {
  return readEnvString("RESEND_API_KEY");
}

export function getEmailFrom() {
  return readEnvString("EMAIL_FROM") || "MotiveLife <hello@mymotivelife.com>";
}

export function hasResendApiKey() {
  const key = getResendApiKey();
  return Boolean(key && key.startsWith("re_"));
}

function parseEmailFrom(from: string) {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim().toLowerCase();
}

function getKeyDiagnostic(): string {
  const raw = process.env.RESEND_API_KEY?.trim() ?? "";
  if (!raw) {
    return "RESEND_API_KEY is not on this deployment. Add it in Vercel → Production (not Preview only), then redeploy.";
  }
  if (raw.startsWith('"') || raw.startsWith("'")) {
    return "RESEND_API_KEY has quote characters — paste the key only, no \" around it.";
  }
  const key = getResendApiKey();
  if (!key.startsWith("re_")) {
    return "RESEND_API_KEY must start with re_ — copy the full API key from Resend → API Keys.";
  }
  return "";
}

export function getEmailConfigStatus() {
  const from = getEmailFrom();
  const fromAddress = parseEmailFrom(from);
  const apiKeySet = hasResendApiKey();
  const fromExplicit = Boolean(readEnvString("EMAIL_FROM"));
  const fromLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromAddress);
  const appUrl = readEnvString("NEXT_PUBLIC_APP_URL");
  const appUrlHttps = appUrl.startsWith("https://");

  return {
    configured: apiKeySet && fromLooksValid && appUrlHttps,
    from,
    fromAddress,
    diagnostic: getKeyDiagnostic() || (!appUrlHttps ? "NEXT_PUBLIC_APP_URL must be https://www.mymotivelife.com" : ""),
    keyConfigured: apiKeySet,
    checklist: [
      { ok: apiKeySet, label: "RESEND_API_KEY is set (starts with re_)" },
      {
        ok: fromExplicit || fromLooksValid,
        label: "EMAIL_FROM is set (or using hello@mymotivelife.com default)",
      },
      {
        ok: fromLooksValid,
        label: "Sender address is valid",
      },
      {
        ok: appUrlHttps,
        label: "NEXT_PUBLIC_APP_URL is HTTPS production URL",
      },
    ],
    setupNote:
      "Resend domain verified → add RESEND_API_KEY + EMAIL_FROM in Vercel Production → redeploy.",
  };
}

type SendResult = { ok: true } | { ok: false; error: string };

async function sendViaResend(to: string, subject: string, html: string): Promise<SendResult> {
  const apiKey = getResendApiKey();
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
