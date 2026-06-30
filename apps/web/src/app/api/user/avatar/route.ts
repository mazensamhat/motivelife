import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { isValidAvatarDataUrl } from "@/lib/avatar";

const schema = z.object({
  avatarDataUrl: z.string().min(32).max(150_000),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success || !isValidAvatarDataUrl(parsed.data.avatarDataUrl)) {
      return badRequest("Upload a JPG or PNG photo under 100 KB.");
    }

    await prisma.user.update({
      where: { id: session.id },
      data: { avatarUrl: parsed.data.avatarDataUrl },
    });

    return json({ ok: true, avatarUrl: parsed.data.avatarDataUrl });
  } catch (error) {
    console.error("[api/user/avatar]", error);
    return serverError("Could not save profile photo.");
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await prisma.user.update({
      where: { id: session.id },
      data: { avatarUrl: null },
    });

    return json({ ok: true });
  } catch (error) {
    console.error("[api/user/avatar DELETE]", error);
    return serverError("Could not remove profile photo.");
  }
}
