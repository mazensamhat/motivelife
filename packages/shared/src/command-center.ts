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
    writeEnabled: boolean;
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
  /** Linked job application for interview events */
  careerApplicationId?: string;
  careerHref?: string;
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

export interface CommandCenterAgendaEvent {
  id: string;
  title: string;
  startIso: string;
  endIso: string;
  lifeArea: LifeArea;
  note?: string;
  prepPercent?: number;
}

export interface CommandCenterAgendaDay {
  dateIso: string;
  dayLabel: string;
  isToday: boolean;
  events: CommandCenterAgendaEvent[];
}

export interface CommandCenterTimelinePayload {
  calendarConnected: boolean;
  calendarConfigured: boolean;
  calendarSources: { google: boolean; apple: boolean };
  todayFocus: string;
  successProbability: number;
  /** Average prep % across today's calendar events (0–100). */
  prepReadiness?: number;
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
  autoPilot?: {
    enabled: boolean;
    writeEnabled: boolean;
    proposals: AutoPilotProposal[];
  };
  energyCurve?: EnergyCurvePoint[];
  weeklyHeatMap?: WeeklyHeatMapDay[];
  /** Week view for calendar sidebar — events with AI coaching notes. */
  calendarAgenda?: CommandCenterAgendaDay[];
}

export type AutoPilotProposalKind = "block_mission" | "prep_block" | "reschedule";

export interface AutoPilotProposal {
  id: string;
  kind: AutoPilotProposalKind;
  title: string;
  reason: string;
  startIso: string;
  endIso: string;
  lifeArea: LifeArea;
  missionId?: string;
  googleEventId?: string;
  canAccept: boolean;
  /** Higher = more urgent (prep before interviews, overload relief, etc.) */
  priority?: number;
  priorityLabel?: string;
  careerApplicationId?: string;
  careerHref?: string;
}

export interface EnergyCurvePoint {
  hour: number;
  label: string;
  level: number;
}

export interface WeeklyHeatMapDay {
  dateIso: string;
  dayLabel: string;
  percent: number;
  isToday: boolean;
  isTomorrow: boolean;
}
