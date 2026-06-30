import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized } from "@/lib/api";
import { setLifeContext } from "@/lib/life-intelligence-layer";
import { parseAccountabilityPartner } from "@/lib/accountability-partner";
import {
  DEFAULT_LIFE_PREFERENCES,
  type LifeBelief,
  type LifeContextId,
  type LifePreference,
} from "@forward/shared";
import { z } from "zod";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      name: true,
      birthYear: true,
      lifeFocuses: true,
      activeModules: true,
      moduleOrder: true,
      lifeDestination: true,
      lifeDestinationGoalId: true,
      beliefs: true,
      preferences: true,
      activeContext: true,
      accountabilityPartner: true,
      avatarUrl: true,
      dashboardTourSeenAt: true,
    },
  });

  if (!user) return unauthorized();
  return json({ user });
}

const preferenceSchema = z.object({
  reminderStyle: z.enum(["gentle", "direct", "statistics"]).optional(),
  taskLength: z.enum(["short", "medium", "long"]).optional(),
  peakHours: z.enum(["morning", "afternoon", "evening", "night"]).optional(),
  encouragement: z.boolean().optional(),
  humor: z.boolean().optional(),
  notifications: z.enum(["minimal", "normal", "off"]).optional(),
});

const patchSchema = z.object({
  birthYear: z.number().int().min(1940).max(new Date().getFullYear() - 13).optional(),
  name: z.string().min(1).max(100).optional(),
  lifeFocuses: z.array(z.string()).max(20).optional(),
  activeModules: z.array(z.string()).max(20).optional(),
  moduleOrder: z.array(z.string()).max(20).optional(),
  lifeDestination: z.string().max(200).nullable().optional(),
  lifeDestinationGoalId: z.string().nullable().optional(),
  beliefs: z.array(z.object({ id: z.string(), label: z.string(), custom: z.boolean().optional() })).max(30).optional(),
  preferences: preferenceSchema.optional(),
  activeContextId: z.string().nullable().optional(),
  accountabilityPartner: z
    .object({
      name: z.string().min(1).max(80),
      linkedUserId: z.string().optional(),
    })
    .nullable()
    .optional(),
  dashboardTourSeen: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input");

  const {
    name,
    birthYear,
    lifeFocuses,
    activeModules,
    moduleOrder,
    lifeDestination,
    lifeDestinationGoalId,
    beliefs,
    preferences,
    activeContextId,
    accountabilityPartner,
    dashboardTourSeen,
  } = parsed.data;

  if (activeContextId !== undefined) {
    await setLifeContext(session.id, activeContextId as LifeContextId | null);
  }

  let beliefsJson: string | undefined;
  if (beliefs != null) {
    beliefsJson = JSON.stringify(beliefs satisfies LifeBelief[]);
  }

  let preferencesJson: string | undefined;
  if (preferences != null) {
    const merged: LifePreference = { ...DEFAULT_LIFE_PREFERENCES, ...preferences };
    preferencesJson = JSON.stringify(merged);
  }

  let accountabilityPartnerJson: string | null | undefined;
  if (accountabilityPartner !== undefined) {
    if (!accountabilityPartner) {
      accountabilityPartnerJson = null;
    } else {
      const existing = await prisma.user.findUnique({
        where: { id: session.id },
        select: { accountabilityPartner: true },
      });
      const prev = parseAccountabilityPartner(existing?.accountabilityPartner);
      accountabilityPartnerJson = JSON.stringify({
        name: accountabilityPartner.name,
        linkedUserId: accountabilityPartner.linkedUserId ?? prev?.linkedUserId,
      });
    }
  }

  const user = await prisma.user.update({
    where: { id: session.id },
    data: {
      ...(name != null ? { name } : {}),
      ...(birthYear != null ? { birthYear } : {}),
      ...(lifeFocuses != null ? { lifeFocuses: JSON.stringify(lifeFocuses) } : {}),
      ...(activeModules != null ? { activeModules: JSON.stringify(activeModules) } : {}),
      ...(moduleOrder != null ? { moduleOrder: JSON.stringify(moduleOrder) } : {}),
      ...(lifeDestination !== undefined ? { lifeDestination } : {}),
      ...(lifeDestinationGoalId !== undefined ? { lifeDestinationGoalId } : {}),
      ...(beliefsJson != null ? { beliefs: beliefsJson } : {}),
      ...(preferencesJson != null ? { preferences: preferencesJson } : {}),
      ...(accountabilityPartnerJson !== undefined
        ? { accountabilityPartner: accountabilityPartnerJson }
        : {}),
      ...(dashboardTourSeen === true ? { dashboardTourSeenAt: new Date() } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      birthYear: true,
      lifeFocuses: true,
      activeModules: true,
      moduleOrder: true,
      lifeDestination: true,
      lifeDestinationGoalId: true,
      beliefs: true,
      preferences: true,
      activeContext: true,
      accountabilityPartner: true,
      avatarUrl: true,
      dashboardTourSeenAt: true,
    },
  });

  return json({ user });
}
