import type { VoiceCaptureAppliedAction } from "@forward/shared";
import { getCalendarEvents } from "@/lib/calendar-events";
import { getCalendarConnectionStatus } from "@/lib/calendar-connection";
import { buildRescheduleProposal } from "@/lib/auto-pilot-proposals";
import {
  createGoogleCalendarEvent,
  getGoogleCalendarEvents,
  isGoogleCalendarWriteEnabled,
  updateGoogleCalendarEvent,
  type GoogleCalendarWriteResult,
} from "@/lib/google-calendar";
import type { AutoPilotProposal } from "@forward/shared";

function parseVoiceTime(text: string, reference = new Date()): Date | null {
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) return null;

  let hour = parseInt(match[1]!, 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3]?.toLowerCase();

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (!meridiem && hour <= 7) hour += 12;

  const result = new Date(reference);
  result.setHours(hour, minute, 0, 0);
  if (result.getTime() < reference.getTime()) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

function parseRescheduleIntent(transcript: string): { keyword: string; timeText: string } | null {
  const patterns = [
    /\bmove(?:\s+my)?\s+(.+?)\s+to\s+(.+)/i,
    /\breschedule(?:\s+my)?\s+(.+?)\s+to\s+(.+)/i,
    /\bpush(?:\s+my)?\s+(.+?)\s+(?:to|until)\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match?.[1] && match[2]) {
      return { keyword: match[1].trim(), timeText: match[2].trim() };
    }
  }
  return null;
}

export async function applyVoiceCalendarCommands(
  userId: string,
  transcript: string
): Promise<VoiceCaptureAppliedAction[]> {
  const intent = parseRescheduleIntent(transcript);
  if (!intent) return [];

  const targetStart = parseVoiceTime(intent.timeText);
  if (!targetStart) {
    return [
      {
        type: "calendar",
        label: "Could not parse time — try “move my gym to 6pm”",
        href: "/dashboard",
      },
    ];
  }

  const [status, googleEvents, calendarEvents] = await Promise.all([
    getCalendarConnectionStatus(userId),
    getGoogleCalendarEvents(userId, 3).catch(() => []),
    getCalendarEvents(userId, 3).catch(() => []),
  ]);

  const googleIntegration = status.google.connected;
  const writeEnabled = status.google.writeEnabled;

  if (!googleIntegration) {
    return [
      {
        type: "calendar",
        label: "Connect Google Calendar to reschedule by voice",
        href: "/integrations",
      },
    ];
  }

  const proposal = buildRescheduleProposal({
    keyword: intent.keyword,
    targetStart,
    durationMs: 60 * 60 * 1000,
    googleEvents,
    calendarEvents,
    googleWriteEnabled: writeEnabled,
  });

  if (!proposal) {
    return [
      {
        type: "calendar",
        label: `No matching event for “${intent.keyword}” — check your calendar title`,
        href: "/dashboard",
      },
    ];
  }

  if (!writeEnabled) {
    return [
      {
        type: "calendar",
        label: "Reconnect Google Calendar to enable write access, then try again",
        href: "/integrations",
      },
    ];
  }

  const result = await executeAutoPilotProposal(userId, proposal);
  if (!result.ok) {
    return [
      {
        type: "calendar",
        label: result.error || "Could not update calendar — accept the proposal on Today instead",
        href: "/dashboard",
      },
    ];
  }

  return [
    {
      type: "calendar",
      label: `Rescheduled “${proposal.title}” to ${targetStart.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`,
      href: "/dashboard",
    },
  ];
}

export async function executeAutoPilotProposal(
  userId: string,
  proposal: AutoPilotProposal
): Promise<GoogleCalendarWriteResult> {
  if (!proposal.canAccept) {
    return { ok: false, error: "Reconnect Google Calendar with write access to accept proposals." };
  }

  if (proposal.kind === "reschedule" && proposal.googleEventId) {
    return updateGoogleCalendarEvent(userId, proposal.googleEventId, {
      start: new Date(proposal.startIso),
      end: new Date(proposal.endIso),
      title: proposal.title,
    });
  }

  const proposalStart = new Date(proposal.startIso);
  const dayStart = new Date(proposalStart);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const normalizedTitle = proposal.title.trim().toLowerCase();

  const googleEvents = await getGoogleCalendarEvents(userId, 2).catch(() => []);
  const existing = googleEvents.find(
    (event) =>
      event.title.trim().toLowerCase() === normalizedTitle &&
      event.start >= dayStart &&
      event.start < dayEnd
  );
  if (existing?.id) {
    return { ok: true, eventId: existing.id };
  }

  return createGoogleCalendarEvent(userId, {
    title: proposal.title,
    start: new Date(proposal.startIso),
    end: new Date(proposal.endIso),
    description:
      proposal.kind === "prep_block"
        ? "Prep block suggested by MotiveLife Auto-Pilot"
        : "Focus block suggested by MotiveLife Auto-Pilot",
  });
}

export function isGoogleWriteEnabledForUser(scope: string | null | undefined) {
  return isGoogleCalendarWriteEnabled(scope);
}
