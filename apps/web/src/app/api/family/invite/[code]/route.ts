import { NextResponse } from "next/server";
import { prisma } from "@forward/database";
import { ensureFamilyMapSchema } from "@/lib/family-map/ensure-schema";
import { normalizeFamilyInviteCode } from "@/lib/family-map/invite-link";

/** Public peek — household display name only (no member locations). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    await ensureFamilyMapSchema();
    const { code: raw } = await context.params;
    const code = normalizeFamilyInviteCode(raw);
    if (code.length < 4) {
      return NextResponse.json({ valid: false }, { status: 404 });
    }

    const household = await prisma.familyHousehold.findUnique({
      where: { inviteCode: code },
      select: {
        name: true,
        members: {
          where: { isSimulated: false, NOT: { userId: null } },
          select: { id: true },
        },
      },
    });

    if (!household) {
      return NextResponse.json({ valid: false }, { status: 404 });
    }

    return NextResponse.json({
      valid: true,
      name: household.name,
      memberCount: household.members.length,
      code,
    });
  } catch (error) {
    console.error("[api/family/invite]", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
