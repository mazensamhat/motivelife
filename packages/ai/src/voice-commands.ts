import type { VoiceCoachingCommand } from "@forward/shared";

const CAREER_PATTERNS = [
  /\bstart (?:a |the |my )?(?:career|resume|job search|interview|linkedin) challenge\b/,
  /\bhelp me (?:with )?(?:my )?resume\b/,
  /\bfix my resume\b/,
  /\bstart interview prep\b/,
  /\bresume challenge\b/,
  /\bjob search challenge\b/,
];

const MONEY_PATTERNS = [
  /\bstart (?:a |the |my )?(?:money|savings|budget) challenge\b/,
  /\bsavings challenge\b/,
  /\bhelp me save\b/,
  /\bmoney challenge\b/,
];

const HEALTH_PATTERNS = [
  /\bstart (?:a |the |my )?(?:health|fitness|workout|sleep) challenge\b/,
  /\bhealth challenge\b/,
  /\bhabit challenge\b/,
];

const LEARNING_PATTERNS = [
  /\bstart (?:a |the |my )?(?:learning|study|school) challenge\b/,
  /\bstudy challenge\b/,
  /\blearning sprint\b/,
  /\bschool challenge\b/,
];

const RELATIONSHIPS_PATTERNS = [
  /\bstart (?:a |the |my )?(?:relationship|connection|social) challenge\b/,
  /\bconnection challenge\b/,
  /\bhelp me (?:stay )?connected\b/,
  /\breach out challenge\b/,
];

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((p) => p.test(text));
}

export function detectVoiceCoachingCommands(transcript: string): VoiceCoachingCommand[] {
  const lower = transcript.toLowerCase().replace(/\s+/g, " ").trim();
  const commands: VoiceCoachingCommand[] = [];

  if (matchesAny(lower, CAREER_PATTERNS)) commands.push("start_career_challenge");
  if (matchesAny(lower, MONEY_PATTERNS)) commands.push("start_money_challenge");
  if (matchesAny(lower, HEALTH_PATTERNS)) commands.push("start_health_challenge");
  if (matchesAny(lower, LEARNING_PATTERNS)) commands.push("start_learning_challenge");
  if (matchesAny(lower, RELATIONSHIPS_PATTERNS)) commands.push("start_relationships_challenge");

  return [...new Set(commands)];
}

export const VOICE_COMMAND_EXAMPLES = [
  "Start resume challenge",
  "Start savings challenge",
  "Start connection challenge",
  "Help me with my resume",
];
