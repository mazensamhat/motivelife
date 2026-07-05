import { z } from "zod";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { executeAutoPilotProposal } from "@/lib/voice-calendar-commands";
import type { AutoPilotProposal } from "@forward/shared";

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

    const ok = await executeAutoPilotProposal(session.id, proposal);
    if (!ok) return serverError("Could not update Google Calendar.");

    return json({ ok: true, proposalId: proposal.id });
  } catch (error) {
    console.error("[api/calendar/proposals/accept]", error);
    return serverError("Could not accept proposal.");
  }
}
