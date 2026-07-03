import { prisma } from "@forward/database";
import type { LifeMemoryHighlight } from "@forward/shared";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function buildLifeMemoryHighlights(userId: string): Promise<LifeMemoryHighlight[]> {
  const since = new Date(Date.now() - WEEK_MS);

  const [memories, captures] = await Promise.all([
    prisma.memory.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.voiceCapture.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, summary: true, transcript: true, createdAt: true },
    }),
  ]);

  const merged: { at: Date; item: LifeMemoryHighlight }[] = [
    ...captures.map((c) => ({
      at: c.createdAt,
      item: {
        id: `voice-${c.id}`,
        text: (c.summary ?? c.transcript).trim().slice(0, 140),
        source: "voice" as const,
        href: "/memory",
      },
    })),
    ...memories.map((m) => ({
      at: m.createdAt,
      item: {
        id: `mem-${m.id}`,
        text: m.content.trim().slice(0, 140),
        source: "memory" as const,
        href: "/memory",
      },
    })),
  ];

  merged.sort((a, b) => b.at.getTime() - a.at.getTime());
  return merged.slice(0, 3).map((m) => m.item);
}
