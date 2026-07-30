import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized } from "@/lib/api";
import {
  DEFAULT_LIFE_PREFERENCES,
  computeTwinCompleteness,
  emptyDigitalTwin,
  type DigitalTwinProfile,
  type LifePreference,
} from "@forward/shared";
import { z } from "zod";

function readPrefs(raw: string | null | undefined): LifePreference & { digitalTwin?: DigitalTwinProfile } {
  if (!raw) return { ...DEFAULT_LIFE_PREFERENCES };
  try {
    return { ...DEFAULT_LIFE_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_LIFE_PREFERENCES };
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { preferences: true, lifeFocuses: true },
  });
  if (!user) return unauthorized();

  const prefs = readPrefs(user.preferences);
  const twin = prefs.digitalTwin ?? emptyDigitalTwin();
  const completeness = computeTwinCompleteness(prefs.digitalTwin ?? null);

  return json({
    twin,
    completeness,
    hasLifeFocus: Boolean(user.lifeFocuses && user.lifeFocuses !== "[]"),
  });
}

const twinSchema = z.object({
  twin: z.record(z.unknown()),
  complete: z.boolean().optional(),
});

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = twinSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid Digital Twin payload");

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { preferences: true },
  });
  if (!user) return unauthorized();

  const prefs = readPrefs(user.preferences);
  const incoming = parsed.data.twin as Partial<DigitalTwinProfile>;
  const merged: DigitalTwinProfile = {
    ...emptyDigitalTwin(),
    ...prefs.digitalTwin,
    ...incoming,
    version: 1,
    updatedAt: new Date().toISOString(),
    onboardingCompletedAt:
      parsed.data.complete || incoming.onboardingCompletedAt
        ? incoming.onboardingCompletedAt ??
          prefs.digitalTwin?.onboardingCompletedAt ??
          new Date().toISOString()
        : prefs.digitalTwin?.onboardingCompletedAt,
  };

  const nextPrefs: LifePreference = {
    ...prefs,
    digitalTwin: merged,
  };

  await prisma.user.update({
    where: { id: session.id },
    data: { preferences: JSON.stringify(nextPrefs) },
  });

  return json({
    twin: merged,
    completeness: computeTwinCompleteness(merged),
  });
}
