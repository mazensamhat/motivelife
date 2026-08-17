/**
 * Life Impact Engine™ — Family Map movement → personal Digital Twin / Money / Travel.
 * Only feeds the member's OWN Life OS when they have Pro and consented.
 */

import { prisma } from "@forward/database";
import {
  DIGITAL_TWIN_STORAGE_VERSION,
  emptyDigitalTwin,
  twinFromPreferencesJson,
  type DigitalTwinProfile,
  type TwinTimelineEvent,
} from "@forward/shared";
import { isPremiumUser } from "@/lib/subscription";
import { createNotification } from "@/lib/notifications";

const FUEL_MONEY_TITLE = "Driving fuel (Family Map)";
const IMPACT_COOLDOWN_MS = 45 * 60_000;
const lastImpactAt = new Map<string, number>();

export type LifeImpactTripInput = {
  memberId: string;
  userId: string | null | undefined;
  displayName: string;
  shareDigitalTwinIntegration: boolean;
  shareDrivingData: boolean;
  toLabel: string | null;
  distanceKm: number;
  durationMinutes: number;
  driveScore: number | null;
  estimatedFuelCostCad: number | null;
  endedAt: Date;
};

function parsePrefs(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Append a short movement signal to the member's private Twin + money + notify. */
export async function applyLifeImpactFromTrip(input: LifeImpactTripInput): Promise<void> {
  if (!input.userId) return;
  if (!input.shareDigitalTwinIntegration) return;
  if (input.distanceKm < 0.4 || input.durationMinutes < 2) return;

  const cooldownKey = input.userId;
  const last = lastImpactAt.get(cooldownKey) ?? 0;
  if (Date.now() - last < IMPACT_COOLDOWN_MS) return;

  const premium = await isPremiumUser(input.userId);
  if (!premium) return;

  lastImpactAt.set(cooldownKey, Date.now());

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { preferences: true },
  });
  if (!user) return;

  const prefs = parsePrefs(user.preferences);
  const twin: DigitalTwinProfile =
    twinFromPreferencesJson(user.preferences) ?? emptyDigitalTwin();

  const dest = (input.toLabel ?? "a stop").trim() || "a stop";
  const km = Math.round(input.distanceKm * 10) / 10;
  const fuel =
    input.estimatedFuelCostCad != null && input.estimatedFuelCostCad > 0
      ? Math.round(input.estimatedFuelCostCad * 100) / 100
      : null;

  // Twin timeline — personal movement memory (not shared with household)
  const timeline: TwinTimelineEvent[] = Array.isArray(twin.timeline) ? [...twin.timeline] : [];
  const eventId = `family-trip-${monthKey(input.endedAt)}-${Math.round(input.endedAt.getTime() / 60000)}`;
  if (!timeline.some((e) => e.id === eventId)) {
    timeline.unshift({
      id: eventId,
      year: input.endedAt.getFullYear(),
      label: `Drove ${km} km to ${dest}${fuel != null ? ` · ~$${fuel.toFixed(2)} fuel` : ""}`,
    });
  }
  twin.timeline = timeline.slice(0, 40);
  twin.updatedAt = new Date().toISOString();
  twin.version = DIGITAL_TWIN_STORAGE_VERSION;

  // Commute / lifestyle signal from longer trips
  if (input.shareDrivingData && input.durationMinutes >= 8 && input.durationMinutes <= 120) {
    twin.career = {
      ...twin.career,
      commuteMinutes: Math.round(input.durationMinutes),
    };
  }

  if (fuel != null) {
    twin.finance = {
      ...twin.finance,
      hasBudget: twin.finance?.hasBudget ?? true,
      notes: [
        twin.finance?.notes?.trim(),
        `Family Map fuel signal (${monthKey(input.endedAt)}): recent trip ~$${fuel.toFixed(2)}.`,
      ]
        .filter(Boolean)
        .join(" ")
        .slice(0, 500),
    };
  }

  prefs.digitalTwin = twin;
  await prisma.user.update({
    where: { id: input.userId },
    data: { preferences: JSON.stringify(prefs) },
  });

  // Money — rolling monthly fuel expense from Family Map trips
  if (fuel != null && fuel > 0) {
    const monthStart = new Date(
      Date.UTC(input.endedAt.getUTCFullYear(), input.endedAt.getUTCMonth(), 1)
    );
    const existing = await prisma.moneyItem.findFirst({
      where: {
        userId: input.userId,
        type: "LIVING_EXPENSE",
        title: FUEL_MONEY_TITLE,
        createdAt: { gte: monthStart },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      await prisma.moneyItem.update({
        where: { id: existing.id },
        data: {
          currentAmount: Math.round((existing.currentAmount + fuel) * 100) / 100,
          notes: `Auto from Family Map · last to ${dest} · Drive Score ${input.driveScore ?? "—"}`,
        },
      });
    } else {
      await prisma.moneyItem.create({
        data: {
          userId: input.userId,
          type: "LIVING_EXPENSE",
          title: FUEL_MONEY_TITLE,
          currentAmount: fuel,
          notes: `Auto from Family Map · ${monthKey(input.endedAt)} · last to ${dest}`,
        },
      });
    }
  }

  // Travel goals — nudge progress when meaningful distance was covered
  if (input.distanceKm >= 5) {
    const travelGoals = await prisma.goal.findMany({
      where: {
        userId: input.userId,
        domain: "TRAVEL",
        status: "ACTIVE",
      },
      take: 3,
      select: { id: true, title: true, progress: true },
    });
    for (const g of travelGoals) {
      const next = Math.min(100, Math.round((g.progress ?? 0) + Math.min(4, input.distanceKm / 10)));
      if (next > (g.progress ?? 0)) {
        await prisma.goal.update({
          where: { id: g.id },
          data: { progress: next },
        }).catch(() => undefined);
      }
    }
  }

  const fuelBit = fuel != null ? ` · ~$${fuel.toFixed(2)} fuel logged to Money` : "";
  await createNotification({
    userId: input.userId,
    type: "life_impact_trip",
    title: "Life Impact · trip synced",
    body: `Your Twin learned a ${km} km drive to ${dest}${fuelBit}.`,
    href: "/dashboard",
  });

  await import("@/lib/vitalu/life-os")
    .then(({ noteKinzoPlaceForVitalu }) =>
      noteKinzoPlaceForVitalu(input.userId!, input.toLabel, input.durationMinutes)
    )
    .catch(() => undefined);
}
