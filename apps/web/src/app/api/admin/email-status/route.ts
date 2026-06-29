import { requireAdmin } from "@/lib/admin";
import { getEmailConfigStatus } from "@/lib/email";
import { json, serverError, unauthorized, forbidden } from "@/lib/api";
import { getAppUrl } from "@/lib/stripe";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) return unauthorized(auth.error);
    return forbidden(auth.error);
  }

  try {
    const status = getEmailConfigStatus();
    return json({
      ...status,
      resetUrlExample: `${getAppUrl()}/reset-password?token=…`,
    });
  } catch (error) {
    console.error("[admin/email-status]", error);
    return serverError("Could not check email status.");
  }
}
