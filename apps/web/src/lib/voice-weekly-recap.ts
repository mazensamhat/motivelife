import { prisma } from "@forward/database";
import type { VoiceWeeklyRecap } from "@forward/shared";
import { VOICE_PRACTICE_MODE_LABELS } from "@forward/shared";

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function buildVoiceWeeklyRecap(
  userId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<VoiceWeeklyRecap> {
  const captures = await prisma.voiceCapture.findMany({
    where: {
      userId,
      createdAt: { gte: weekStart, lt: weekEnd },
    },
    orderBy: { createdAt: "desc" },
  });

  const practiceRows = captures.filter((c) => c.source === "voice_practice");
  const contentRows = captures.filter((c) => c.source !== "voice_practice");
  const nightRows = captures.filter((c) => c.source === "night_reflection");

  const moodCounts = new Map<string, number>();
  const signalCounts = new Map<string, number>();
  const voiceHighlights: string[] = [];
  const practiceHighlights: string[] = [];
  let scoreSum = 0;
  let scoreCount = 0;

  for (const row of contentRows) {
    if (row.mood) moodCounts.set(row.mood, (moodCounts.get(row.mood) ?? 0) + 1);
    for (const signal of parseJsonArray(row.signals)) {
      signalCounts.set(signal, (signalCounts.get(signal) ?? 0) + 1);
    }
    if (row.summary && voiceHighlights.length < 3) {
      voiceHighlights.push(row.summary.slice(0, 140));
    }
  }

  for (const row of practiceRows) {
    try {
      const parsed = JSON.parse(row.actions) as {
        practice?: { mode?: string; scores?: { overall?: number }; coachNote?: string };
      };
      const overall = parsed.practice?.scores?.overall;
      if (typeof overall === "number") {
        scoreSum += overall;
        scoreCount += 1;
      }
      if (parsed.practice?.mode && practiceHighlights.length < 2) {
        const label = VOICE_PRACTICE_MODE_LABELS[parsed.practice.mode as keyof typeof VOICE_PRACTICE_MODE_LABELS];
        practiceHighlights.push(
          `${label ?? "Practice"}: ${overall ?? "—"}/100 — ${parsed.practice.coachNote?.slice(0, 80) ?? row.summary ?? ""}`
        );
      }
    } catch {
      /* ignore */
    }
  }

  const topMoods = [...moodCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m)
    .slice(0, 3);

  const topSignals = [...signalCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s.replace(/_/g, " "))
    .slice(0, 4);

  const avgPracticeScore = scoreCount > 0 ? scoreSum / scoreCount : null;
  const captureCount = contentRows.length;
  const practiceCount = practiceRows.length;

  const paragraphs: string[] = [];

  if (captureCount === 0 && practiceCount === 0) {
    paragraphs.push("No voice captures this week — hold the mic once a day and MotiveLife will remember for you.");
    return {
      captureCount: 0,
      practiceCount: 0,
      nightReflectionCount: nightRows.length,
      avgPracticeScore: null,
      topMoods,
      topSignals,
      voiceHighlights,
      practiceHighlights,
      paragraphs,
    };
  }

  paragraphs.push(
    `This week you spoke ${captureCount + practiceCount} time${captureCount + practiceCount === 1 ? "" : "s"} to MotiveLife — ${captureCount} capture${captureCount === 1 ? "" : "s"}, ${practiceCount} practice rep${practiceCount === 1 ? "" : "s"}.`
  );

  if (nightRows.length > 0) {
    paragraphs.push(
      `${nightRows.length} evening reflection${nightRows.length === 1 ? "" : "s"} — your days are being captured without journaling.`
    );
  }

  if (avgPracticeScore !== null) {
    paragraphs.push(
      `Voice practice average: ${Math.round(avgPracticeScore)}/100.${avgPracticeScore >= 75 ? " Strong delivery week." : " One more rep on fillers and structure will compound."}`
    );
  }

  if (topMoods.length > 0) {
    paragraphs.push(`Emotional thread: ${topMoods.join(", ")}.`);
  }

  if (topSignals.length > 0) {
    paragraphs.push(`Signals that surfaced: ${topSignals.join(", ")}.`);
  }

  for (const h of voiceHighlights.slice(0, 2)) {
    paragraphs.push(h);
  }

  return {
    captureCount,
    practiceCount,
    nightReflectionCount: nightRows.length,
    avgPracticeScore,
    topMoods,
    topSignals,
    voiceHighlights,
    practiceHighlights,
    paragraphs,
  };
}

export function voiceRecapForWeeklyReview(recap: VoiceWeeklyRecap) {
  return {
    captureCount: recap.captureCount + recap.practiceCount,
    practiceCount: recap.practiceCount,
    avgPracticeScore: recap.avgPracticeScore,
    voiceHighlights: recap.voiceHighlights,
    practiceHighlights: recap.practiceHighlights,
    topMoods: recap.topMoods,
  };
}
