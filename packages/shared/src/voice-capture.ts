/** Voice Capture — speak life, MotiveLife organizes */

export type VoiceCaptureSource =
  | "capture"
  | "brain_dump"
  | "ambient_capture"
  | "night_reflection"
  | "morning_reflection"
  | "voice_practice";

export type VoiceCaptureActionType =
  | "memory"
  | "goal"
  | "task"
  | "health"
  | "money"
  | "relationship"
  | "insight"
  | "signal"
  | "coaching";

export interface VoiceCaptureAppliedAction {
  type: VoiceCaptureActionType;
  label: string;
  entityId?: string;
  href?: string;
}

export interface VoiceCapturePlan {
  summary: string;
  mood?: string | null;
  signals: string[];
  coachNote?: string | null;
  memories: Array<{
    content: string;
    type?: "FACT" | "PREFERENCE" | "COMMITMENT" | "ACHIEVEMENT";
    domain?: string | null;
  }>;
  goals: Array<{ title: string; domain: string; description?: string | null }>;
  tasks: Array<{ title: string; priority?: string; dueHint?: string | null }>;
  healthNotes: Array<{ title: string; notes?: string; unit?: string; value?: number }>;
  moneyNotes: Array<{ title: string; amount?: number; notes?: string }>;
  relationshipNotes: Array<{ title: string; notes?: string }>;
  insights: Array<{ text: string; category?: string }>;
  /** Night / morning reflection extractions */
  wins?: string[];
  problems?: string[];
  ideas?: string[];
  tomorrowPriorities?: string[];
  habits?: string[];
}

export interface ReflectionExtraction {
  wins: string[];
  problems: string[];
  ideas: string[];
  tomorrowPriorities: string[];
  habits: string[];
}

export interface MorningReflectionContext {
  hasYesterdayReflection: boolean;
  morningDoneToday: boolean;
  yesterdaySummary: string | null;
  yesterdayMood: string | null;
  yesterdaySignals: string[];
  prompt: string;
}

export interface VoiceCapturePayload {
  id: string;
  transcript: string;
  summary: string | null;
  mood: string | null;
  signals: string[];
  coachNote: string | null;
  applied: VoiceCaptureAppliedAction[];
  reflection?: ReflectionExtraction | null;
  source: VoiceCaptureSource;
  createdAt: string;
}
