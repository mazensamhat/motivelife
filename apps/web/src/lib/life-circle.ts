import type { LifeCircleRelationship } from "@forward/shared";

export function userInviteCode(userId: string): string {
  return userId.slice(-10);
}

export function buildLifeCircleInviteUrl(
  userId: string,
  relationship: LifeCircleRelationship = "FRIEND",
  appOrigin?: string
): string {
  const base = appOrigin ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://motivelife.ai";
  const code = userInviteCode(userId);
  const tag = relationship.toLowerCase();
  return `${base.replace(/\/$/, "")}/register?ref=${encodeURIComponent(code)}&tag=${tag}`;
}

export function buildReferralInviteUrl(userId: string, appOrigin?: string): string {
  const base = appOrigin ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://motivelife.ai";
  const code = userInviteCode(userId);
  return `${base.replace(/\/$/, "")}/register?ref=${encodeURIComponent(code)}`;
}

export function formatLifeCircleInviteMessage(
  memberName: string,
  userName: string | null,
  inviteUrl: string,
  relationship: LifeCircleRelationship
): string {
  const who = userName?.split(" ")[0] ?? "I";
  const label = relationship === "FAMILY" ? "family" : "friend";
  return `Hey ${memberName} — ${who} invited you to their MotiveLife circle as ${label === "family" ? "family" : "a friend"}. Join free and move life forward together: ${inviteUrl}`;
}

export function formatCircleHelloMessage(
  memberFirstName: string,
  userName: string | null
): string {
  const who = userName?.split(" ")[0] ?? "I";
  return `Hey ${memberFirstName} — ${who} says hello from MotiveLife! 👋 Hope you're having a great day.`;
}

export function formatCircleCheerMessage(memberFirstName: string, userName: string | null): string {
  const who = userName?.split(" ")[0] ?? "I";
  return `Hey ${memberFirstName} — ${who} just finished Life Engine today. Your turn? 🔥 motivelife.ai`;
}

export function formatCircleNudgeMessage(memberFirstName: string, userName: string | null): string {
  const who = userName?.split(" ")[0] ?? "I";
  return `Hey ${memberFirstName} — ${who} is cheering you on for today's Life Engine streak. You've got this!`;
}

export function parseCircleTag(raw: string | null | undefined): LifeCircleRelationship {
  if (raw?.toLowerCase() === "family") return "FAMILY";
  return "FRIEND";
}

export function relationshipLabel(relationship: LifeCircleRelationship): string {
  return relationship === "FAMILY" ? "Family" : "Friend";
}
