import { prisma } from "@forward/database";
import { FAMILY_MAX_MEMBERS } from "@forward/shared";
import { ensureFamilyMapSchema } from "./ensure-schema";
import { generateFamilyInviteCode } from "./invite-code";

const MEMBER_COLORS = ["#00c6ff", "#00ff87", "#ff8c00", "#ffcc33", "#7aa2ff", "#ff6b9d"];

type MemberWithHousehold = Awaited<
  ReturnType<
    typeof prisma.familyMember.findFirst<{
      include: { household: true };
    }>
  >
>;

/** Invitees often land as "Me" when Apple/Google name is empty — replace placeholders. */
function isPlaceholderDisplayName(name: string | null | undefined): boolean {
  const n = name?.trim().toLowerCase();
  return !n || n === "me" || n === "user" || n === "family member";
}

async function resolveMemberDisplayName(
  userId: string,
  preferred?: string | null
): Promise<string> {
  if (preferred?.trim() && !isPlaceholderDisplayName(preferred)) {
    return preferred.trim();
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (user?.name?.trim() && !isPlaceholderDisplayName(user.name)) {
    return user.name.trim();
  }
  const local = user?.email?.split("@")[0]?.trim();
  if (local) {
    const cleaned = local.replace(/[._+]+/g, " ").trim();
    if (cleaned) {
      return cleaned
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }
  }
  return "Family member";
}

/** Heal existing "Me" rows when the member next touches the household. */
async function healPlaceholderDisplayName(
  member: { id: string; displayName: string; userId: string | null }
): Promise<string> {
  if (!member.userId || !isPlaceholderDisplayName(member.displayName)) {
    return member.displayName;
  }
  const next = await resolveMemberDisplayName(member.userId);
  if (next === member.displayName) return member.displayName;
  await prisma.familyMember.update({
    where: { id: member.id },
    data: { displayName: next },
  });
  return next;
}

/**
 * Prefer the membership in a real multi-person household.
 * Fixes invite races that left a user in both a solo household and a family.
 */
export async function repairUserMemberships(userId: string): Promise<MemberWithHousehold> {
  const memberships = await prisma.familyMember.findMany({
    where: { userId },
    include: {
      household: {
        include: {
          members: {
            where: { isSimulated: false, NOT: { userId: null } },
            select: { id: true, userId: true },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (memberships.length === 0) return null;
  if (memberships.length === 1) {
    return {
      ...memberships[0]!,
      household: memberships[0]!.household,
    };
  }

  const scored = memberships.map((m) => {
    const others = m.household.members.filter((x) => x.userId && x.userId !== userId).length;
    return { m, others };
  });
  scored.sort((a, b) => {
    if (b.others !== a.others) return b.others - a.others;
    return b.m.updatedAt.getTime() - a.m.updatedAt.getTime();
  });

  const keep = scored[0]!.m;
  const dropIds = memberships.filter((m) => m.id !== keep.id).map((m) => m.id);
  if (dropIds.length) {
    await prisma.familyMember.deleteMany({ where: { id: { in: dropIds } } });
  }

  // Remove orphan solo households still owned by this user
  const owned = await prisma.familyHousehold.findMany({
    where: { ownerUserId: userId },
    include: {
      members: {
        where: { isSimulated: false, NOT: { userId: null } },
        select: { userId: true },
      },
    },
  });
  for (const h of owned) {
    if (h.id === keep.householdId) continue;
    const realOthers = h.members.filter((m) => m.userId && m.userId !== userId);
    if (realOthers.length === 0) {
      await prisma.familyHousehold.delete({ where: { id: h.id } }).catch(() => null);
    }
  }

  return prisma.familyMember.findFirst({
    where: { id: keep.id },
    include: { household: true },
  });
}

export async function getHouseholdForUser(userId: string) {
  await ensureFamilyMapSchema();
  const membership = await repairUserMemberships(userId);
  if (membership) return membership.household;

  const owned = await prisma.familyHousehold.findUnique({
    where: { ownerUserId: userId },
  });
  return owned;
}

export async function ensureHouseholdForUser(userId: string, displayName?: string | null) {
  await ensureFamilyMapSchema();
  const repaired = await repairUserMemberships(userId);
  if (repaired) {
    return { household: repaired.household, member: repaired };
  }

  const existing = await getHouseholdForUser(userId);
  if (existing) {
    let me = await prisma.familyMember.findFirst({
      where: { householdId: existing.id, userId },
    });
    if (!me) {
      const resolvedName = await resolveMemberDisplayName(userId, displayName);
      const count = await prisma.familyMember.count({ where: { householdId: existing.id } });
      me = await prisma.familyMember.create({
        data: {
          householdId: existing.id,
          userId,
          displayName: resolvedName,
          role: existing.ownerUserId === userId ? "OWNER" : "MEMBER",
          color: MEMBER_COLORS[count % MEMBER_COLORS.length]!,
          locationSharingLevel: "precise",
        },
      });
    } else {
      const healed = await healPlaceholderDisplayName(me);
      if (healed !== me.displayName) {
        me = { ...me, displayName: healed };
      }
    }
    return { household: existing, member: me };
  }

  const resolvedName = await resolveMemberDisplayName(userId, displayName);

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
          displayName: resolvedName,
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

function isSoloSelfHousehold(
  household: {
    ownerUserId: string;
    members: Array<{ userId: string | null; isSimulated: boolean }>;
  },
  userId: string
) {
  if (household.ownerUserId !== userId) return false;
  const real = household.members.filter((m) => m.userId && !m.isSimulated);
  return real.every((m) => m.userId === userId);
}

/**
 * Join a household by invite code.
 * Moves an existing solo membership (preserving GPS) instead of delete+create,
 * which raced with ensureHouseholdForUser and left invitees invisible.
 */
export async function joinHouseholdByInviteCode(
  userId: string,
  code: string,
  displayName?: string | null
) {
  await ensureFamilyMapSchema();
  const inviteCode = code.trim().toUpperCase();

  return prisma.$transaction(async (tx) => {
    const household = await tx.familyHousehold.findUnique({
      where: { inviteCode },
      include: { members: true },
    });
    if (!household) throw new Error("INVALID_CODE");

    const already = household.members.find((m) => m.userId === userId);
    if (already) return { household, member: already };

    const linkedCount = household.members.filter((m) => m.userId && !m.isSimulated).length;
    if (linkedCount >= FAMILY_MAX_MEMBERS) throw new Error("HOUSEHOLD_FULL");

    // Real joiners replace sample household actors
    await tx.familyMember.deleteMany({
      where: { householdId: household.id, isSimulated: true },
    });

    const myMemberships = await tx.familyMember.findMany({
      where: { userId },
      include: {
        household: {
          include: { members: true },
        },
      },
    });

    const solo = myMemberships.find((m) => isSoloSelfHousehold(m.household, userId));
    const nonSoloOther = myMemberships.find(
      (m) => m.householdId !== household.id && !isSoloSelfHousehold(m.household, userId)
    );
    if (nonSoloOther) throw new Error("ALREADY_IN_HOUSEHOLD");

    // Prefer explicit join name → account name/email → non-placeholder solo name.
    const preferred =
      displayName?.trim() ||
      (!isPlaceholderDisplayName(solo?.displayName) ? solo?.displayName : null);
    const resolvedName = await resolveMemberDisplayName(userId, preferred);

    if (solo) {
      const color =
        solo.color ||
        MEMBER_COLORS[household.members.length % MEMBER_COLORS.length]!;

      const member = await tx.familyMember.update({
        where: { id: solo.id },
        data: {
          householdId: household.id,
          role: "MEMBER",
          displayName: resolvedName,
          color,
          locationSharingLevel: solo.locationSharingLevel || "precise",
          // Keep lastLat/lastLng/battery/etc. — do not wipe GPS
        },
      });

      // Drop any stray duplicate memberships
      await tx.familyMember.deleteMany({
        where: { userId, id: { not: member.id } },
      });

      // Delete the now-empty solo household (cascade is fine — member already moved)
      const leftover = await tx.familyMember.count({ where: { householdId: solo.householdId } });
      if (leftover === 0) {
        await tx.familyHousehold.delete({ where: { id: solo.householdId } }).catch(() => null);
      } else if (solo.household.ownerUserId === userId) {
        // Still owned by joiner but empty of this user — remove if no other real people
        const others = await tx.familyMember.count({
          where: {
            householdId: solo.householdId,
            isSimulated: false,
            NOT: { userId: null },
          },
        });
        if (others === 0) {
          await tx.familyHousehold.delete({ where: { id: solo.householdId } }).catch(() => null);
        }
      }

      const fresh = await tx.familyHousehold.findUniqueOrThrow({
        where: { id: household.id },
      });
      return { household: fresh, member };
    }

    // No prior membership — create fresh (still no GPS until they share live)
    if (myMemberships.length > 0) {
      // Unexpected leftover rows — clean then create
      await tx.familyMember.deleteMany({ where: { userId } });
      for (const m of myMemberships) {
        if (m.household.ownerUserId === userId) {
          const others = m.household.members.filter(
            (x) => x.userId && x.userId !== userId && !x.isSimulated
          );
          if (others.length === 0) {
            await tx.familyHousehold.delete({ where: { id: m.householdId } }).catch(() => null);
          }
        }
      }
    }

    const color = MEMBER_COLORS[household.members.length % MEMBER_COLORS.length]!;
    const member = await tx.familyMember.create({
      data: {
        householdId: household.id,
        userId,
        displayName: resolvedName,
        role: "MEMBER",
        color,
        locationSharingLevel: "precise",
      },
    });

    return { household, member };
  });
}

export async function getMemberForUser(userId: string) {
  await ensureFamilyMapSchema();
  return repairUserMemberships(userId);
}

export { FAMILY_MAX_MEMBERS, MEMBER_COLORS };
