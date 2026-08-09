import { badRequest } from "@/lib/api";

/**
 * Household crowdsourced police / event reporting is disabled.
 * Road orbs come from Ontario 511 + optional Ticketmaster only.
 */
export async function POST() {
  return badRequest("Road reporting is disabled.");
}
