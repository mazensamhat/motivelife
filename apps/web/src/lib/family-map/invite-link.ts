/** Client-safe family invite link helpers */

export function normalizeFamilyInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function familyInvitePath(code: string): string {
  return `/family/join/${encodeURIComponent(normalizeFamilyInviteCode(code))}`;
}

export function familyInviteUrl(code: string, origin?: string): string {
  const base =
    origin?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "https://www.mymotivelife.com");
  return `${base}${familyInvitePath(code)}`;
}

export function familyInviteShareText(code: string, origin?: string): string {
  const url = familyInviteUrl(code, origin);
  return `Join my family on MyMotiveFamily — tap this link:\n${url}`;
}

export function familyInviteRegisterHref(code: string): string {
  const c = normalizeFamilyInviteCode(code);
  return `/register?plan=family&family=${encodeURIComponent(c)}`;
}

export function familyInviteLoginHref(code: string): string {
  const c = normalizeFamilyInviteCode(code);
  return `/login?family=${encodeURIComponent(c)}`;
}
