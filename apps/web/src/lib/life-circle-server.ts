import { prisma } from "@forward/database";
import {
  MAX_LIFE_CIRCLE_MEMBERS,
  REFERRAL_BONUS_VOICE_UNITS,
  type LifeCircleMemberPayload,
  type LifeCircleRelationship,
  type LifeCircleSummary,
  type PartnerActivityPayload,
} from "@forward/shared";
import { parseAccountabilityPartner } from "./accountability-partner";
import { getPartnerActivity } from "./accountability-partner-server";
import { parseCircleTag, userInviteCode } from "./life-circle";

export async function findUserByInviteCode(code: string) {
  const trimmed = code.trim();
  if (!trimmed) return null;
  return prisma.user.findFirst({
    where: { id: { endsWith: trimmed } },
    select: { id: true, name: true },
  });
}

async function migrateLegacyPartner(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountabilityPartner: true },
  });
  const legacy = parseAccountabilityPartner(user?.accountabilityPartner);
  if (!legacy?.name) return;

  const existing = await prisma.lifeCircleMember.count({ where: { ownerUserId: userId } });
  if (existing > 0) return;

  await prisma.lifeCircleMember.create({
    data: {
      ownerUserId: userId,
      displayName: legacy.name,
      relationship: "FRIEND",
      linkedUserId: legacy.linkedUserId ?? null,
    },
  });
}

export async function getLifeCircleMembers(userId: string): Promise<LifeCircleMemberPayload[]> {
  await migrateLegacyPartner(userId);

  const members = await prisma.lifeCircleMember.findMany({
    where: { ownerUserId: userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      displayName: true,
      relationship: true,
      linkedUserId: true,
    },
  });

  const withActivity = await Promise.all(
    members.map(async (member) => {
      const activity = member.linkedUserId
        ? await getPartnerActivity(member.linkedUserId)
        : null;
      return {
        id: member.id,
        displayName: member.displayName,
        relationship: member.relationship as LifeCircleRelationship,
        linkedUserId: member.linkedUserId,
        activity,
      } satisfies LifeCircleMemberPayload;
    })
  );

  return withActivity;
}

export async function getLifeCircleSummary(userId: string): Promise<LifeCircleSummary> {
  const [members, referralCount] = await Promise.all([
    getLifeCircleMembers(userId),
    prisma.referral.count({ where: { inviterId: userId } }),
  ]);

  return {
    members,
    referralCount,
    inviteCode: userInviteCode(userId),
  };
}

export async function getLinkedCircleActivities(
  userId: string
): Promise<Array<LifeCircleMemberPayload & { activity: PartnerActivityPayload }>> {
  const members = await getLifeCircleMembers(userId);
  return members.filter(
    (m): m is LifeCircleMemberPayload & { activity: PartnerActivityPayload } =>
      Boolean(m.linkedUserId && m.activity)
  );
}

export async function addLifeCircleMember(
  ownerUserId: string,
  displayName: string,
  relationship: LifeCircleRelationship
) {
  const count = await prisma.lifeCircleMember.count({ where: { ownerUserId } });
  if (count >= MAX_LIFE_CIRCLE_MEMBERS) {
    throw new Error("CIRCLE_FULL");
  }

  return prisma.lifeCircleMember.create({
    data: {
      ownerUserId,
      displayName: displayName.trim(),
      relationship,
    },
  });
}

export async function updateLifeCircleMember(
  ownerUserId: string,
  memberId: string,
  data: { displayName?: string; relationship?: LifeCircleRelationship }
) {
  const member = await prisma.lifeCircleMember.findFirst({
    where: { id: memberId, ownerUserId },
  });
  if (!member) throw new Error("NOT_FOUND");

  return prisma.lifeCircleMember.update({
    where: { id: memberId },
    data: {
      ...(data.displayName !== undefined ? { displayName: data.displayName.trim() } : {}),
      ...(data.relationship !== undefined ? { relationship: data.relationship } : {}),
    },
  });
}

export async function removeLifeCircleMember(ownerUserId: string, memberId: string) {
  const member = await prisma.lifeCircleMember.findFirst({
    where: { id: memberId, ownerUserId },
  });
  if (!member) throw new Error("NOT_FOUND");
  await prisma.lifeCircleMember.delete({ where: { id: memberId } });
}

async function upsertCircleLink(
  ownerUserId: string,
  linkedUserId: string,
  displayName: string,
  relationship: LifeCircleRelationship
) {
  const count = await prisma.lifeCircleMember.count({ where: { ownerUserId } });
  const existing = await prisma.lifeCircleMember.findFirst({
    where: { ownerUserId, linkedUserId },
  });
  if (existing) {
    return prisma.lifeCircleMember.update({
      where: { id: existing.id },
      data: { displayName, relationship },
    });
  }

  const nameSlot = await prisma.lifeCircleMember.findFirst({
    where: { ownerUserId, linkedUserId: null, displayName: { equals: displayName, mode: "insensitive" } },
  });
  if (nameSlot) {
    return prisma.lifeCircleMember.update({
      where: { id: nameSlot.id },
      data: { linkedUserId, relationship },
    });
  }

  if (count >= MAX_LIFE_CIRCLE_MEMBERS) return null;

  return prisma.lifeCircleMember.create({
    data: { ownerUserId, linkedUserId, displayName, relationship },
  });
}

export async function linkLifeCircleFromInvite(
  newUserId: string,
  newUserName: string | null | undefined,
  inviteCode: string,
  tag?: string | null
): Promise<boolean> {
  const inviter = await findUserByInviteCode(inviteCode);
  if (!inviter || inviter.id === newUserId) return false;

  const joinerFirst = newUserName?.split(" ")[0] ?? "Friend";
  const inviterFirst = inviter.name?.split(" ")[0] ?? "Friend";
  const relationship = parseCircleTag(tag);

  await upsertCircleLink(inviter.id, newUserId, joinerFirst, relationship);
  await upsertCircleLink(newUserId, inviter.id, inviterFirst, "FRIEND");

  return true;
}

export async function grantReferralReward(inviteCode: string, inviteeId: string): Promise<boolean> {
  const inviter = await findUserByInviteCode(inviteCode);
  if (!inviter || inviter.id === inviteeId) return false;

  const existing = await prisma.referral.findUnique({ where: { inviteeId } });
  if (existing) return false;

  await prisma.$transaction([
    prisma.referral.create({
      data: {
        inviterId: inviter.id,
        inviteeId,
        bonusUnits: REFERRAL_BONUS_VOICE_UNITS,
      },
    }),
    prisma.user.update({
      where: { id: inviter.id },
      data: { voiceOrganizeBonus: { increment: REFERRAL_BONUS_VOICE_UNITS } },
    }),
  ]);

  return true;
}
