import { getAppUrl } from "@/lib/stripe";
import { getAdminEmails } from "@/lib/admin";

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
  const adminEmails = getAdminEmails();
  const adminEmailsSet = adminEmails.length > 0;

  return {
    configured: apiKeySet && fromLooksValid && appUrlHttps,
    feedbackReady: apiKeySet && fromLooksValid && adminEmailsSet,
    from,
    fromAddress,
    adminEmailsCount: adminEmails.length,
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
      {
        ok: adminEmailsSet,
        label: "ADMIN_EMAILS is set (feedback alerts + admin login)",
      },
    ],
    setupNote:
      "Verify mymotivelife.com in Resend → add RESEND_API_KEY + EMAIL_FROM + ADMIN_EMAILS in Vercel Production → redeploy.",
    setupSteps: getResendSetupSteps(),
  };
}

export interface ResendSetupStep {
  step: number;
  title: string;
  detail: string;
  href: string;
}

export function getResendSetupSteps(): ResendSetupStep[] {
  return [
    {
      step: 1,
      title: "Sign up at Resend",
      detail: "Free tier covers password reset and feedback alerts.",
      href: "https://resend.com/signup",
    },
    {
      step: 2,
      title: "Add domain mymotivelife.com",
      detail: "Resend → Domains → Add domain.",
      href: "https://resend.com/domains",
    },
    {
      step: 3,
      title: "Add DNS records",
      detail: "Copy SPF/DKIM from Resend into Network Solutions (same DNS as Vercel). Wait for Verified.",
      href: "https://resend.com/domains",
    },
    {
      step: 4,
      title: "Create API key",
      detail: "Resend → API Keys → Create. Copy the full re_… key (no quotes).",
      href: "https://resend.com/api-keys",
    },
    {
      step: 5,
      title: "Add Vercel Production env vars",
      detail: "RESEND_API_KEY, EMAIL_FROM, ADMIN_EMAILS — then Redeploy.",
      href: "https://vercel.com/docs/projects/environment-variables",
    },
    {
      step: 6,
      title: "Send test email",
      detail: "Admin → User management → Send test email. Check your inbox.",
      href: "https://www.mymotivelife.com/admin",
    },
    {
      step: 7,
      title: "Test forgot password",
      detail: "Login → Forgot your password? — confirm reset link arrives.",
      href: "https://www.mymotivelife.com/login",
    },
  ];
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

export async function sendMorningBriefingEmail(
  email: string,
  name: string | null,
  mission: string | null,
  score: number
) {
  const first = name?.split(" ")[0] ?? "there";
  const appUrl = getAppUrl();
  const subject = mission
    ? `${first}, your priority today: ${mission.slice(0, 48)}${mission.length > 48 ? "…" : ""}`
    : `${first}, your MotiveLife briefing is ready`;
  const html = `
    <p>Good morning, ${first}.</p>
    <p>Your AI chief of staff reviewed your goals, calendar, and progress overnight.</p>
    ${mission ? `<p><strong>Today's priority:</strong> ${mission}</p>` : "<p>Open MotiveLife for today's one priority.</p>"}
    <p>Motive Life Score: <strong>${score}</strong></p>
    <p><a href="${appUrl}/dashboard">Open today's briefing →</a></p>
    <p style="color:#666;font-size:12px;margin-top:24px">Turn off retention emails in Settings → Beliefs & Preferences.</p>
    <p>— MotiveLife</p>
  `.trim();
  return sendViaResend(email, subject, html);
}

export async function sendStreakAtRiskEmail(
  email: string,
  name: string | null,
  streak: number
) {
  const first = name?.split(" ")[0] ?? "there";
  const appUrl = getAppUrl();
  const subject = `${first}, your ${streak}-day streak needs you tonight`;
  const html = `
    <p>Hi ${first},</p>
    <p>Your <strong>${streak}-day Momentum Engine streak</strong> is at risk — complete today's action before midnight to keep it alive.</p>
    <p><a href="${appUrl}/dashboard#life-engine">Save my streak →</a></p>
    <p>— MotiveLife</p>
  `.trim();
  return sendViaResend(email, subject, html);
}

export async function sendTrialEndingEmail(
  email: string,
  name: string | null,
  daysLeft: number
) {
  const first = name?.split(" ")[0] ?? "there";
  const appUrl = getAppUrl();
  const subject =
    daysLeft <= 1
      ? `${first}, your MyMotiveLife Pro trial ends tomorrow`
      : `${first}, ${daysLeft} days left on your Pro trial`;
  const html = `
    <p>Hi ${first},</p>
    <p>Your MyMotiveLife Pro trial ${daysLeft <= 1 ? "ends tomorrow" : `ends in ${daysLeft} days`}.</p>
    <p>Keep your chief of staff, weekly letters, voice coach, and Momentum Engine — <strong>$14.99/mo</strong> — or upgrade to <strong>KINZO AI at $19.99/mo</strong> for household Family Intelligence (includes Life Pro for you).</p>
    <p><a href="${appUrl}/settings">Upgrade in Settings →</a> · <a href="${appUrl}/family">KINZO AI →</a></p>
    <p>— MotiveLife</p>
  `.trim();
  return sendViaResend(email, subject, html);
}

export async function sendProductFeedbackEmail(input: {
  kind: string;
  message: string;
  pagePath: string | null;
  viewport: string | null;
  userEmail: string;
  userName: string | null;
}) {
  const admins = getAdminEmails();
  if (admins.length === 0) {
    console.warn("[email] Product feedback saved but ADMIN_EMAILS is empty — no notification sent.");
    return false;
  }

  const kindLabel =
    input.kind === "wish"
      ? "Feature wish"
      : input.kind === "change"
        ? "Change request"
        : input.kind === "praise"
          ? "Praise"
          : "Bug report";

  const subject = `[MotiveLife feedback] ${kindLabel} from ${input.userName ?? input.userEmail}`;
  const inboxUrl = `${getAppUrl()}/admin`;
  const html = `
    <p><strong>${kindLabel}</strong> from ${input.userName ?? "User"} (${input.userEmail})</p>
    <p><strong>Device:</strong> ${input.viewport ?? "unknown"} · <strong>Page:</strong> ${input.pagePath ?? "—"}</p>
    <blockquote style="margin:16px 0;padding:12px 16px;border-left:4px solid #0072ff;background:#f4f7fc;">
      ${input.message.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}
    </blockquote>
    <p><a href="${inboxUrl}">Open Feedback inbox in Admin →</a></p>
    <p>— MotiveLife</p>
  `.trim();

  let sent = false;
  for (const admin of admins) {
    const result = await sendViaResend(admin, subject, html);
    if (result.ok) sent = true;
  }
  return sent;
}
