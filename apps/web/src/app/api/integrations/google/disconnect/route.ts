import { getSession } from "@/lib/session";
import { json, unauthorized } from "@/lib/api";
import { prisma } from "@forward/database";

export async function POST() {
  const session = await getSession();
  if (!session) return unauthorized();

  await prisma.userIntegration.deleteMany({
    where: { userId: session.id, provider: "GOOGLE" },
  });

  return json({ ok: true });
}
