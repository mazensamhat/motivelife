import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { json, unauthorized } from "@/lib/api";

export async function POST() {
  const session = await getSession();
  if (!session) return unauthorized();

  await prisma.userIntegration.deleteMany({
    where: { userId: session.id, provider: "FITBIT" },
  });

  return json({ ok: true });
}
