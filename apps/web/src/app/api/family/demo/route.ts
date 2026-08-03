import { NextResponse } from "next/server";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { ensureHouseholdForUser } from "@/lib/family-map/household";
import { getFamilyMapState } from "@/lib/family-map/map-state";

/** Sample household seeding is retired — real families only. */
export async function POST() {
  return NextResponse.json(
    { error: "Sample household preview has been removed." },
    { status: 410 }
  );
}

/** Clear any leftover simulated members from older builds. */
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { household } = await ensureHouseholdForUser(session.id, session.name);
    if (household.ownerUserId !== session.id) {
      return badRequest("Only the family owner can clear leftover sample members.");
    }

    await prisma.familyMember.deleteMany({
      where: { householdId: household.id, isSimulated: true },
    });

    const state = await getFamilyMapState(session.id);
    return json(state);
  } catch (error) {
    console.error("[api/family/demo DELETE]", error);
    return serverError("Could not clear sample members.");
  }
}
