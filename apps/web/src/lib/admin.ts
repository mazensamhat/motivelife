import { getSession } from "@/lib/session";

/**
 * Founder accounts always get full MyMotiveFamily + Pro (comp), even if
 * ADMIN_EMAILS / Stripe hasn’t been wired yet. Keeps the owner unblocked
 * while freemium gates everyone else.
 */
const FOUNDER_COMP_EMAILS = ["samhatmazen@gmail.com"];

/** Comma-separated admin emails in ADMIN_EMAILS (case-insensitive). */
export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Extra comp emails via COMP_FAMILY_EMAILS (comma-separated). */
export function getCompFamilyEmails(): string[] {
  const raw = process.env.COMP_FAMILY_EMAILS ?? "";
  const fromEnv = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...FOUNDER_COMP_EMAILS, ...fromEnv])];
}

export function isAdminEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (FOUNDER_COMP_EMAILS.includes(normalized)) return true;
  const admins = getAdminEmails();
  if (admins.length === 0) return false;
  return admins.includes(normalized);
}

/** Full Family + Pro unlock (founder / COMP_FAMILY_EMAILS / admin). */
export function hasCompFamilyAccess(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (getCompFamilyEmails().includes(normalized)) return true;
  return isAdminEmail(normalized);
}

/**
 * Post-login / post-register landing. Always Mode of Life home — not Ops.
 * Admins open the Ops Console from the dashboard shield link (`/admin`).
 */
export function adminRedirectPath(_email: string): "/admin" | "/dashboard" {
  return "/dashboard";
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session) return { ok: false as const, status: 401 as const, error: "Unauthorized" };
  if (!isAdminEmail(session.email)) {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }
  return { ok: true as const, session };
}
