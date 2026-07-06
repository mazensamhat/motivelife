import { prisma } from "@forward/database";

export type AutoPilotSuppression = {
  proposalIds: Set<string>;
  missionIds: Set<string>;
  titlesOnCalendar: Set<string>;
};

function normalizeTitle(title: string) {
  return title.trim().toLowerCase();
}

function missionIdFromProposalId(proposalId: string): string | null {
  const match = proposalId.match(/^mission-(.+)-(\d{4}-\d{2}-\d{2}T.+)$/);
  return match?.[1] ?? null;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getAutoPilotSuppression(
  userId: string,
  calendarTitles: string[] = []
): Promise<AutoPilotSuppression> {
  const since = startOfToday();

  const accepted = await prisma.autoPilotAction.findMany({
    where: {
      userId,
      status: "accepted",
      createdAt: { gte: since },
    },
    select: { proposalId: true, title: true },
  });

  const proposalIds = new Set<string>();
  const missionIds = new Set<string>();
  const titlesOnCalendar = new Set(calendarTitles.map(normalizeTitle));

  for (const row of accepted) {
    proposalIds.add(row.proposalId);
    const missionId = missionIdFromProposalId(row.proposalId);
    if (missionId) missionIds.add(missionId);
    titlesOnCalendar.add(normalizeTitle(row.title));
  }

  return { proposalIds, missionIds, titlesOnCalendar };
}

export function isMissionAlreadyScheduled(
  missionId: string,
  missionTitle: string,
  suppression: AutoPilotSuppression
) {
  if (suppression.missionIds.has(missionId)) return true;
  return suppression.titlesOnCalendar.has(normalizeTitle(missionTitle));
}
