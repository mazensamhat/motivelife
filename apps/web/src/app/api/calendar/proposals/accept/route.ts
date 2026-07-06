import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { executeAutoPilotProposal } from "@/lib/voice-calendar-commands";
import { getCalendarConnectionStatus } from "@/lib/calendar-connection";
import type { AutoPilotProposal } from "@forward/shared";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const proposalSchema = z.object({
  id: z.string(),
  kind: z.enum(["block_mission", "prep_block", "reschedule"]),
  title: z.string().min(1),
  reason: z.string(),
  startIso: z.string(),
  endIso: z.string(),
  lifeArea: z.string(),
  missionId: z.string().optional(),
  googleEventId: z.string().optional(),
  canAccept: z.boolean(),
  priority: z.number().optional(),
  priorityLabel: z.string().optional(),
  careerApplicationId: z.string().optional(),
  careerHref: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = proposalSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid proposal payload.");

    const proposal = parsed.data as AutoPilotProposal;
    if (!proposal.canAccept) {
      return badRequest("Reconnect Google Calendar with write access to accept proposals.");
    }

    const status = await getCalendarConnectionStatus(session.id);
    if (!status.google.writeEnabled) {
      return badRequest("Reconnect Google Calendar at /integrations and enable scheduling permission.");
    }

    const since = startOfToday();
    const existing = await prisma.autoPilotAction.findFirst({
      where: {
        userId: session.id,
        status: "accepted",
        createdAt: { gte: since },
        OR: [
          { proposalId: proposal.id },
          ...(proposal.missionId
            ? [{ proposalId: { startsWith: `mission-${proposal.missionId}-` } }]
            : []),
          ...(proposal.title === "Protected focus block"
            ? [{ proposalId: { startsWith: "focus-" } }]
            : []),
          ...(proposal.careerApplicationId
            ? [{ proposalId: { startsWith: `career-prep-${proposal.careerApplicationId}` } }]
            : []),
        ],
      },
    });
    if (existing) {
      return json({ ok: true, proposalId: proposal.id, alreadyAccepted: true });
    }

    const result = await executeAutoPilotProposal(session.id, proposal);
    if (!result.ok) return serverError(result.error);

    try {
      await prisma.autoPilotAction.create({
        data: {
          userId: session.id,
          proposalId: proposal.id,
          kind: proposal.kind,
          title: proposal.title,
          startIso: proposal.startIso,
          endIso: proposal.endIso,
          status: "accepted",
        },
      });
    } catch (historyError) {
      console.error("[api/calendar/proposals/accept] history log failed", historyError);
    }

    return json({ ok: true, proposalId: proposal.id, eventId: result.eventId });
  } catch (error) {
    console.error("[api/calendar/proposals/accept]", error);
    return serverError("Could not accept proposal.");
  }
}
