import { z } from "zod";
import { prisma } from "@forward/database";
import { getSessionFromRequest } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import { getMemberForUser } from "@/lib/family-map/household";
import { upsertPlace } from "@/lib/family-map/location-engine";
import { getFamilyMapState } from "@/lib/family-map/map-state";
import { ensureFamilyMapSchema } from "@/lib/family-map/ensure-schema";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().min(10).max(2000).optional(),
  category: z.enum(["home", "work", "school", "shop", "sports", "other"]).optional(),
  shape: z.enum(["circle", "square"]).optional(),
  rotationDeg: z.number().min(0).max(360).optional(),
  aspectRatio: z.number().min(0.25).max(4).optional(),
  notifyOnEnter: z.boolean().optional(),
  notifyOnLeave: z.boolean().optional(),
});

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  radiusM: z.number().min(10).max(2000).optional(),
  category: z.enum(["home", "work", "school", "shop", "sports", "other"]).optional(),
  shape: z.enum(["circle", "square"]).optional(),
  rotationDeg: z.number().min(0).max(360).optional(),
  aspectRatio: z.number().min(0.25).max(4).optional(),
  notifyOnEnter: z.boolean().optional(),
  notifyOnLeave: z.boolean().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return unauthorized();
    await ensureFamilyMapSchema();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid place.");

    const member = await getMemberForUser(session.id);
    if (!member) return badRequest("Join a family first.");

    const place = await upsertPlace({
      householdId: member.householdId,
      name: parsed.data.name,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      radiusM: parsed.data.radiusM,
      category: parsed.data.category,
      shape: parsed.data.shape,
      rotationDeg: parsed.data.rotationDeg,
      aspectRatio: parsed.data.aspectRatio,
    });

    if (
      parsed.data.notifyOnEnter != null ||
      parsed.data.notifyOnLeave != null ||
      parsed.data.shape != null ||
      parsed.data.rotationDeg != null ||
      parsed.data.aspectRatio != null
    ) {
      await prisma.familyPlace.update({
        where: { id: place.id },
        data: {
          notifyOnEnter: parsed.data.notifyOnEnter,
          notifyOnLeave: parsed.data.notifyOnLeave,
          shape: parsed.data.shape,
          rotationDeg: parsed.data.rotationDeg,
          aspectRatio: parsed.data.aspectRatio,
        },
      });
    }

    const state = await getFamilyMapState(session.id);
    return json(state);
  } catch (error) {
    console.error("[api/family/places POST]", error);
    return serverError("Could not save place.");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return unauthorized();
    await ensureFamilyMapSchema();

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid place update.");

    const member = await getMemberForUser(session.id);
    if (!member) return badRequest("Join a family first.");

    const existing = await prisma.familyPlace.findFirst({
      where: { id: parsed.data.id, householdId: member.householdId },
    });
    if (!existing) return badRequest("Place not found.");

    const nextName = parsed.data.name?.trim();
    if (nextName && nextName !== existing.name) {
      const clash = await prisma.familyPlace.findFirst({
        where: {
          householdId: member.householdId,
          name: nextName,
          NOT: { id: existing.id },
        },
        select: { id: true },
      });
      if (clash) return badRequest("A place with that name already exists.");
    }

    await prisma.familyPlace.update({
      where: { id: existing.id },
      data: {
        name: nextName,
        radiusM: parsed.data.radiusM,
        category: parsed.data.category,
        shape: parsed.data.shape,
        rotationDeg: parsed.data.rotationDeg,
        aspectRatio: parsed.data.aspectRatio,
        notifyOnEnter: parsed.data.notifyOnEnter,
        notifyOnLeave: parsed.data.notifyOnLeave,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
      },
    });

    const state = await getFamilyMapState(session.id);
    return json(state);
  } catch (error) {
    console.error("[api/family/places PATCH]", error);
    return serverError("Could not update place.");
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid place id.");

    const member = await getMemberForUser(session.id);
    if (!member) return badRequest("Join a family first.");

    const place = await prisma.familyPlace.findFirst({
      where: { id: parsed.data.id, householdId: member.householdId },
    });
    if (!place) return badRequest("Place not found.");

    await prisma.familyMember.updateMany({
      where: { householdId: member.householdId, currentPlaceId: place.id },
      data: { currentPlaceId: null },
    });
    await prisma.familyPlace.delete({ where: { id: place.id } });

    const state = await getFamilyMapState(session.id);
    return json(state);
  } catch (error) {
    console.error("[api/family/places DELETE]", error);
    return serverError("Could not remove place.");
  }
}
