import type { LifeReplayPayload } from "@forward/shared";

const DOMAIN_LABEL: Record<string, string> = {
  career: "Career",
  money: "Money",
  health: "Health",
  learning: "Learning",
  relationships: "Relationships",
  mindset: "Mindset",
};

/** Client-safe share formatter */
export function formatLifeReplayShareText(
  replay: LifeReplayPayload,
  userName?: string | null
): string {
  const who = userName?.split(" ")[0] ?? "My";
  const lines = [
    `${who}'s ${replay.year} Life Replay — motivelife.ai`,
    "",
    `${replay.stats.lifeMoments} life moments · ${replay.stats.goalsCompleted} goals done · ${replay.stats.tasksCompleted} tasks finished`,
    `Motive Life Score: ${replay.stats.scoreStart} → ${replay.stats.scoreNow} (${replay.stats.scoreDelta >= 0 ? "+" : ""}${replay.stats.scoreDelta})`,
    `Strongest area: ${DOMAIN_LABEL[replay.stats.topDomain] ?? replay.stats.topDomain}`,
  ];

  if (replay.highlights.length > 0) {
    lines.push("", "Biggest wins:");
    for (const h of replay.highlights.slice(0, 4)) {
      lines.push(`${h.emoji} ${h.title}`);
    }
  }

  if (replay.lessons[0]) {
    lines.push("", replay.lessons[0]);
  }

  lines.push("", "Build your life story → motivelife.ai");
  return lines.join("\n");
}
