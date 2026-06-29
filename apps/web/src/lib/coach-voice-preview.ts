import type { LifeBelief, LifePreference } from "@forward/shared";

/** Live preview of how the Chief of Staff will sound — rule-based, $0 */
export function previewCoachVoice(
  preferences: LifePreference,
  beliefs: LifeBelief[] = [],
  firstName = "Alex"
): string {
  const name = firstName.trim() || "there";
  const belief = beliefs[0]?.label?.toLowerCase();
  const beliefBit = belief ? ` I know ${belief} matters to you.` : "";

  if (preferences.reminderStyle === "direct") {
    return `${name} — one thing today.${beliefBit} Pick it. Finish it.`;
  }

  if (preferences.reminderStyle === "statistics") {
    return `${name}, your career score is up 4 points this week.${beliefBit} A 17-minute task today keeps the trend going.`;
  }

  if (preferences.humor) {
    return `Hey ${name} — your future self left a note: "do one small thing today."${beliefBit} (They didn't say which thing. I did — check Life Engine.)`;
  }

  if (!preferences.encouragement) {
    return `${name}, here's today's priority.${beliefBit} One action on Life Engine moves everything forward.`;
  }

  return `${name}, I've looked at your day and your goals.${beliefBit} One meaningful win is enough — let's start there.`;
}
