import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized } from "@/lib/api";

const schema = z.object({
  id: z.string(),
  status: z.enum(["ACCEPTED", "DISMISSED", "COMPLETED"]),
});

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input");

  const { id, status } = parsed.data;

  const existing = await prisma.suggestedAction.findFirst({
    where: { id, userId: session.id },
  });
  if (!existing) return badRequest("Suggestion not found");

  const suggestion = await prisma.suggestedAction.update({
    where: { id },
    data: { status },
  });

  return json({ suggestion });
}
