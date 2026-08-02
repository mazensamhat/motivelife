import { prisma } from "@forward/database";
import { FAMILY_MAX_MEMBERS } from "@forward/shared";
import { ensureFamilyMapSchema } from "./ensure-schema";
import { generateFamilyInviteCode } from "./invite-code";

const MEMBER_COLORS = ["#00c6ff", "#00ff87", "#ff8c00", "#ffcc33", "#7aa2ff", "#ff6b9d"];

export async function getHouseholdForUser(userId: string) {
  await ensureFamilyMapSchema();
  const membership = await prisma.familyMember.findFirst({
    where: { userId },
    include: { household: true },
  });
  if (membership) return membership.household;

  const owned = await prisma.familyHousehold.findUnique({
    where: { ownerUserId: userId },
  });
  return owned;
}

export async function ensureHouseholdForUser(userId: string, displayName?: string | null) {
  await ensureFamilyMapSchema();
  const existing = await getHouseholdForUser(userId);
  if (existing) {
    let me = await prisma.familyMember.findFirst({
      where: { householdId: existing.id, userId },
    });
    if (!me) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      const count = await prisma.familyMember.count({ where: { householdId: existing.id } });
      me = await prisma.familyMember.create({
        data: {
          householdId: existing.id,
          userId,
          displayName: displayName?.trim() || user?.name?.trim() || "Me",
          role: existing.ownerUserId === userId ? "OWNER" : "MEMBER",
          color: MEMBER_COLORS[count % MEMBER_COLORS.length]!,
          locationSharingLevel: "precise",
        },
      });
    }
    return { household: existing, member: me };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  let inviteCode = generateFamilyInviteCode();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.familyHousehold.findUnique({ where: { inviteCode } });
    if (!clash) break;
    inviteCode = generateFamilyInviteCode();
  }

  const household = await prisma.familyHousehold.create({
    data: {
      ownerUserId: userId,
      name: "My Family",
      inviteCode,
      members: {
        create: {
          userId,
          displayName: displayName?.trim() || user?.name?.trim() || "Me",
          role: "OWNER",
          color: MEMBER_COLORS[0]!,
          locationSharingLevel: "precise",
        },
      },
    },
    include: { members: true },
  });

  const member = household.members[0]!;
  return { household, member };
}

export async function joinHouseholdByInviteCode(
  userId: string,
  code: string,
  displayName?: string | null
) {
  const inviteCode = code.trim().toUpperCase();
  const household = await prisma.familyHousehold.findUnique({
    where: { inviteCode },
    include: { members: true },
  });
  if (!household) throw new Error("INVALID_CODE");

  const already = household.members.find((m) => m.userId === userId);
  if (already) return { household, member: already };

  const linkedCount = household.members.filter((m) => m.userId || m.isSimulated).length;
  if (linkedCount >= FAMILY_MAX_MEMBERS) throw new Error("HOUSEHOLD_FULL");

  // If user already owns another household with only themselves, leave it.
  const owned = await prisma.familyHousehold.findUnique({
    where: { ownerUserId: userId },
    include: { members: true },
  });
  if (owned && owned.id !== household.id) {
    const realOthers = owned.members.filter((m) => m.userId && m.userId !== userId);
    if (realOthers.length === 0) {
      await prisma.familyHousehold.delete({ where: { id: owned.id } });
    } else {
      throw new Error("ALREADY_IN_HOUSEHOLD");
    }
  } else if (await prisma.familyMember.findFirst({ where: { userId } })) {
    throw new Error("ALREADY_IN_HOUSEHOLD");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  const color = MEMBER_COLORS[household.members.length % MEMBER_COLORS.length]!;
  const member = await prisma.familyMember.create({
    data: {
      householdId: household.id,
      userId,
      displayName: displayName?.trim() || user?.name?.trim() || "Family member",
      role: "MEMBER",
      color,
      locationSharingLevel: "precise",
    },
  });

  return { household, member };
}

export async function getMemberForUser(userId: string) {
  return prisma.familyMember.findFirst({
    where: { userId },
    include: { household: true },
  });
}

export { FAMILY_MAX_MEMBERS, MEMBER_COLORS };
