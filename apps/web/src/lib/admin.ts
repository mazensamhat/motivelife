import { getSession } from "@/lib/session";

/** Comma-separated admin emails in ADMIN_EMAILS (case-insensitive). */
export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  const admins = getAdminEmails();
  if (admins.length === 0) return false;
  return admins.includes(email.trim().toLowerCase());
}

export function adminRedirectPath(email: string): "/admin" | "/dashboard" {
  return isAdminEmail(email) ? "/admin" : "/dashboard";
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session) return { ok: false as const, status: 401 as const, error: "Unauthorized" };
  if (!isAdminEmail(session.email)) {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }
  return { ok: true as const, session };
}
