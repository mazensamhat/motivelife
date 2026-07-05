/** Life areas for timeline coloring — where your day is going, not meeting types. */
export type CalendarEventSource = "google" | "apple";

export interface CalendarWorkloadDay {
  percent: number;
  label: string;
  recommendation?: string;
}

export interface CalendarConnectionStatus {
  google: {
    configured: boolean;
    connected: boolean;
    accountEmail: string | null;
  };
  apple: {
    connected: boolean;
    accountEmail: string | null;
  };
  anyConnected: boolean;
}

export type LifeArea =
  | "career"
  | "health"
  | "money"
  | "relationships"
  | "learning"
  | "home"
  | "business"
  | "mindset";

export type TimelineBlockKind =
  | "brief"
  | "calendar"
  | "mission"
  | "free"
  | "reflection"
  | "suggested";

export type TimelineEventType =
  | "interview"
  | "gym"
  | "doctor"
  | "meeting"
  | "travel"
  | "birthday"
  | "lunch"
  | "generic";

export interface TimelinePrepItem {
  label: string;
  done: boolean;
}

export interface TimelineIntelligenceSection {
  title: string;
  items: string[];
}

export interface TimelineBlockIntelligence {
  prepPercent?: number;
  confidenceLabel?: string;
  sections?: TimelineIntelligenceSection[];
}

export interface TimelineBlockCoaching {
  headline: string;
  subline?: string;
  prepItems?: TimelinePrepItem[];
  aiBriefReady?: boolean;
  scoreImpact?: number;
  eventType?: TimelineEventType;
  intelligence?: TimelineBlockIntelligence;
}

export interface CommandCenterTimelineBlock {
  id: string;
  kind: TimelineBlockKind;
  timeLabel: string;
  startIso: string;
  endIso?: string;
  title: string;
  subtitle?: string;
  emoji?: string;
  lifeArea: LifeArea;
  coaching?: TimelineBlockCoaching;
  missionId?: string;
  missionKind?: "task" | "habit";
  done?: boolean;
}

export interface CommandCenterTimelinePayload {
  calendarConnected: boolean;
  calendarConfigured: boolean;
  calendarSources: { google: boolean; apple: boolean };
  todayFocus: string;
  successProbability: number;
  workload: {
    today: CalendarWorkloadDay;
    tomorrow: CalendarWorkloadDay;
  };
  blocks: CommandCenterTimelineBlock[];
  tomorrowHighlight?: {
    title: string;
    prepPercent: number;
    lifeArea: LifeArea;
    eventType?: TimelineEventType;
  };
}
