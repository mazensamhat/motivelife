import { prisma } from "@forward/database";
import type { PartnerActivityPayload } from "@forward/shared";
import { getLifeEngineStreak } from "./life-engine-streak";

const MOOD_STATUS: Record<string, string> = {
  energized: "Feeling energized",
  grateful: "Feeling grateful",
  stressed: "Feeling stressed",
  tired: "Feeling tired",
  anxious: "Feeling anxious",
  neutral: "Steady today",
};

function buildStatusLabel(params: {
  completedToday: boolean;
  atRisk: boolean;
  mood: string | null;
  lastSeenAt: Date | null;
}): string {
  if (params.completedToday) return "Moved life forward today";
  if (params.atRisk) return "Streak needs you today";
  if (params.mood && MOOD_STATUS[params.mood]) return MOOD_STATUS[params.mood];
  if (params.mood) return `Feeling ${params.mood}`;

  if (params.lastSeenAt) {
    const hours = (Date.now() - params.lastSeenAt.getTime()) / (1000 * 60 * 60);
    if (hours < 24) return "Checked in recently";
    if (hours < 72) return "Quiet the last few days";
  }

  return "Hasn't checked in yet today";
}

function recentMood(mood: string | null, capturedAt: Date | null): string | null {
  if (!mood || !capturedAt) return null;
  const hours = (Date.now() - capturedAt.getTime()) / (1000 * 60 * 60);
  return hours <= 48 ? mood : null;
}

export async function getPartnerActivity(linkedUserId: string): Promise<PartnerActivityPayload | null> {
  const user = await prisma.user.findUnique({
    where: { id: linkedUserId },
    select: { name: true, lastSeenAt: true },
  });
  if (!user) return null;

  const [streak, latestCapture] = await Promise.all([
    getLifeEngineStreak(linkedUserId),
    prisma.voiceCapture.findFirst({
      where: { userId: linkedUserId },
      orderBy: { createdAt: "desc" },
      select: { mood: true, createdAt: true },
    }),
  ]);

  const mood = recentMood(latestCapture?.mood ?? null, latestCapture?.createdAt ?? null);
  const statusLabel = buildStatusLabel({
    completedToday: streak.completedToday,
    atRisk: streak.atRisk,
    mood,
    lastSeenAt: user.lastSeenAt,
  });

  return {
    name: user.name?.split(" ")[0] ?? "Friend",
    currentStreak: streak.currentStreak,
    bestStreak: streak.bestStreak,
    completedToday: streak.completedToday,
    atRisk: streak.atRisk,
    mood,
    statusLabel,
  };
}
