/** Voice practice — career, relationships, leadership */

export type VoicePracticeDomain = "career" | "relationships" | "leadership";

export type CareerPracticeMode = "interview" | "negotiation" | "presentation" | "conversation";
export type RelationshipPracticeMode =
  | "date_intro"
  | "difficult_talk"
  | "reconnection"
  | "appreciation";
export type LeadershipPracticeMode =
  | "parenting_moment"
  | "team_feedback"
  | "hard_decision"
  | "motivate_team";

export type VoicePracticeMode =
  | CareerPracticeMode
  | RelationshipPracticeMode
  | LeadershipPracticeMode;

export interface VoicePracticeScores {
  overall: number;
  confidence: number;
  clarity: number;
  energy: number;
  fillerWords: number;
  wordsPerMinute: number;
  fillerRate: number;
}

export interface VoicePracticeTip {
  category: "confidence" | "clarity" | "energy" | "fillers" | "structure" | "warmth";
  text: string;
}

export interface VoicePracticePayload {
  id: string;
  domain: VoicePracticeDomain;
  mode: VoicePracticeMode;
  prompt: string;
  transcript: string;
  durationSeconds: number;
  scores: VoicePracticeScores;
  tips: VoicePracticeTip[];
  coachNote: string;
  createdAt: string;
}

export const VOICE_PRACTICE_MODE_LABELS: Record<VoicePracticeMode, string> = {
  interview: "Interview answer",
  negotiation: "Negotiation pitch",
  presentation: "Presentation opener",
  conversation: "Networking intro",
  date_intro: "Date intro",
  difficult_talk: "Difficult conversation",
  reconnection: "Reach out again",
  appreciation: "Say thank you",
  parenting_moment: "Parenting moment",
  team_feedback: "Team feedback",
  hard_decision: "Hard decision",
  motivate_team: "Motivate team",
};

export const VOICE_PRACTICE_MODES_BY_DOMAIN: Record<VoicePracticeDomain, VoicePracticeMode[]> = {
  career: ["interview", "negotiation", "presentation", "conversation"],
  relationships: ["date_intro", "difficult_talk", "reconnection", "appreciation"],
  leadership: ["parenting_moment", "team_feedback", "hard_decision", "motivate_team"],
};

export const VOICE_PRACTICE_DOMAIN_META: Record<
  VoicePracticeDomain,
  { title: string; description: string; defaultMode: VoicePracticeMode }
> = {
  career: {
    title: "Interview · Negotiation · Presentation",
    description:
      "Hold the mic, answer the prompt, release — scored on confidence, clarity, fillers, and energy.",
    defaultMode: "interview",
  },
  relationships: {
    title: "Dating · Hard talks · Reconnection",
    description:
      "Practice what you'll say out loud — scored on warmth, clarity, and authentic confidence.",
    defaultMode: "date_intro",
  },
  leadership: {
    title: "Parenting · Feedback · Decisions",
    description:
      "Lead with calm clarity — practice parenting redirects, team feedback, and hard calls before they matter.",
    defaultMode: "parenting_moment",
  },
};

export const VOICE_PRACTICE_PROMPTS: Record<VoicePracticeMode, string[]> = {
  interview: [
    "Tell me about a time you solved a difficult problem at work.",
    "Why do you want this role, and what would you bring in your first 90 days?",
    "Describe a failure and what you learned from it.",
  ],
  negotiation: [
    "Make the case for a 15% raise based on your recent impact.",
    "Push back on a low offer without damaging the relationship.",
    "Negotiate a flexible schedule while keeping your manager confident.",
  ],
  presentation: [
    "Explain your product vision in 60 seconds to a non-technical audience.",
    "Open a team meeting with energy and a clear agenda.",
    "Summarize last quarter's results and next quarter's priorities.",
  ],
  conversation: [
    "Introduce yourself at a networking event in under 45 seconds.",
    "Start a thoughtful conversation with someone you admire.",
    "Explain what you do in a way that sparks curiosity.",
  ],
  date_intro: [
    "Introduce yourself on a first date — who you are, what excites you, one genuine question for them.",
    "Share why you're interested in seeing someone again after a great first meeting.",
    "Answer: \"What are you looking for right now?\" with honesty and warmth.",
  ],
  difficult_talk: [
    "Tell your partner you need more quality time together without sounding accusatory.",
    "Address a friend who has been flaky — direct but kind.",
    "Set a boundary with a family member about a recurring issue.",
  ],
  reconnection: [
    "Reach out to a friend you haven't spoken to in six months.",
    "Check in on someone you know is going through a hard time.",
    "Reconnect with a former colleague you'd like back in your life.",
  ],
  appreciation: [
    "Thank your partner for something specific they did this week.",
    "Tell a parent or mentor what they've meant to your life.",
    "Express genuine appreciation to a teammate who carried extra load.",
  ],
  parenting_moment: [
    "Your child is melting down at bedtime — calm them without giving in to every demand.",
    "Redirect a sibling fight without taking sides or yelling.",
    "Explain a screen-time limit to a disappointed teenager.",
  ],
  team_feedback: [
    "Tell a direct report their work missed the mark — specific, kind, actionable.",
    "Give upward feedback to your manager about workload without sounding entitled.",
    "Address a teammate who keeps missing deadlines.",
  ],
  hard_decision: [
    "Tell your team you're deprioritizing a beloved project — honest and clear.",
    "Explain a layoff or scope cut to remaining team members.",
    "Tell your family a change of plans that will disappoint them.",
  ],
  motivate_team: [
    "Your team just lost a big deal — rally them for the next push.",
    "Kick off Monday after a rough week — energy without toxic positivity.",
    "Recognize the team publicly after a grueling sprint.",
  ],
};

const RELATIONSHIP_MODES = new Set<RelationshipPracticeMode>([
  "date_intro",
  "difficult_talk",
  "reconnection",
  "appreciation",
]);

const LEADERSHIP_MODES = new Set<LeadershipPracticeMode>([
  "parenting_moment",
  "team_feedback",
  "hard_decision",
  "motivate_team",
]);

export function practiceDomainForMode(mode: VoicePracticeMode): VoicePracticeDomain {
  if (RELATIONSHIP_MODES.has(mode as RelationshipPracticeMode)) return "relationships";
  if (LEADERSHIP_MODES.has(mode as LeadershipPracticeMode)) return "leadership";
  return "career";
}

export function pickPracticePrompt(mode: VoicePracticeMode, seed = Date.now()) {
  const prompts = VOICE_PRACTICE_PROMPTS[mode];
  return prompts[seed % prompts.length] ?? prompts[0];
}
