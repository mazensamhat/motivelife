import type { AccountabilityPartner } from "@forward/shared";

export function parseAccountabilityPartner(raw: string | null | undefined): AccountabilityPartner | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AccountabilityPartner;
    if (parsed?.name?.trim()) {
      return {
        name: parsed.name.trim(),
        linkedUserId: parsed.linkedUserId,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function formatStreakShareMessage(
  partnerName: string,
  streak: number,
  userName: string | null
): string {
  const who = userName?.split(" ")[0] ?? "I";
  return `Hey ${partnerName} — ${who} just hit a ${streak}-day Life Engine streak on motivelife.ai. Hold me accountable tomorrow too? 🔥`;
}

export function buildPartnerInviteUrl(userId: string, appOrigin?: string): string {
  const base = appOrigin ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://motivelife.ai";
  return `${base.replace(/\/$/, "")}/register?partner=${encodeURIComponent(userId.slice(-10))}`;
}

export function formatWeeklyLetterShareMessage(
  partnerName: string,
  userName: string | null,
  wins: string[],
  focusAreas: string[]
): string {
  const who = userName?.split(" ")[0] ?? "I";
  const winLine = wins[0] ? ` This week: ${wins[0]}` : "";
  const focusLine = focusAreas[0] ? ` Next week I'm focusing on: ${focusAreas[0]}.` : "";
  return `Hey ${partnerName} — ${who}'s MotiveLife weekly letter.${winLine}${focusLine} Hold me accountable?`;
}

export function formatPartnerInviteMessage(
  partnerName: string,
  userName: string | null,
  inviteUrl: string
): string {
  const who = userName?.split(" ")[0] ?? "I";
  return `Hey ${partnerName} — ${who} wants you as their accountability partner on MotiveLife. Hold me to my daily Life Engine streak: ${inviteUrl}`;
}

export function formatPartnerCheerMessage(partnerFirstName: string, userName: string | null): string {
  const who = userName?.split(" ")[0] ?? "I";
  return `Hey ${partnerFirstName} — ${who} just finished Life Engine today. Your turn? 🔥 motivelife.ai`;
}

export function formatPartnerNudgeMessage(partnerFirstName: string, userName: string | null): string {
  const who = userName?.split(" ")[0] ?? "I";
  return `Hey ${partnerFirstName} — ${who} is waiting on you for today's Life Engine streak. You've got this.`;
}
