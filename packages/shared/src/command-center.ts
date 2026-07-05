/** Life areas for timeline coloring — where your day is going, not meeting types. */
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

export interface TimelineBlockCoaching {
  headline: string;
  subline?: string;
  prepItems?: TimelinePrepItem[];
  aiBriefReady?: boolean;
  scoreImpact?: number;
  eventType?: TimelineEventType;
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
  todayFocus: string;
  successProbability: number;
  blocks: CommandCenterTimelineBlock[];
  tomorrowHighlight?: {
    title: string;
    prepPercent: number;
    lifeArea: LifeArea;
    eventType?: TimelineEventType;
  };
}
