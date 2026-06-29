import { requireAdmin } from "@/lib/admin";
import { getEmailConfigStatus, sendTestEmail } from "@/lib/email";
import { badRequest, json, serverError, unauthorized, forbidden } from "@/lib/api";

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) return unauthorized(auth.error);
    return forbidden(auth.error);
  }

  const status = getEmailConfigStatus();
  if (!status.checklist[0]?.ok) {
    return badRequest("RESEND_API_KEY is not set in Vercel Production.");
  }

  try {
    const result = await sendTestEmail(auth.session.email);
    if (!result.ok) {
      return badRequest(`Resend rejected the email: ${result.error}`);
    }
    return json({ ok: true, message: `Test email sent to ${auth.session.email}.` });
  } catch (error) {
    console.error("[admin/email-test]", error);
    return serverError("Could not send test email.");
  }
}
