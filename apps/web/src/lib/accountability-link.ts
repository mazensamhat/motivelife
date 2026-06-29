import { prisma } from "@forward/database";
import { parseAccountabilityPartner } from "./accountability-partner";

export async function linkAccountabilityFromInvite(
  newUserId: string,
  newUserName: string | null | undefined,
  inviteCode: string
): Promise<boolean> {
  const code = inviteCode.trim();
  if (!code) return false;

  const inviter = await prisma.user.findFirst({
    where: { id: { endsWith: code } },
    select: { id: true, name: true, accountabilityPartner: true },
  });

  if (!inviter || inviter.id === newUserId) return false;

  const inviterPartner = parseAccountabilityPartner(inviter.accountabilityPartner);
  const joinerFirst = newUserName?.split(" ")[0] ?? "Partner";
  const inviterFirst = inviter.name?.split(" ")[0] ?? "Partner";

  await prisma.user.update({
    where: { id: inviter.id },
    data: {
      accountabilityPartner: JSON.stringify({
        name: inviterPartner?.name ?? joinerFirst,
        linkedUserId: newUserId,
      }),
    },
  });

  await prisma.user.update({
    where: { id: newUserId },
    data: {
      accountabilityPartner: JSON.stringify({
        name: inviterFirst,
        linkedUserId: inviter.id,
      }),
    },
  });

  return true;
}
