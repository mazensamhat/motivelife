import { z } from "zod";
import { prisma } from "@forward/database";
import { HABIT_FREQUENCIES } from "@forward/shared";
import { computeHabitCheckIn, habitDoneToday } from "@forward/ai";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { recordProgressMoment } from "@/lib/forward";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  frequency: z.enum(HABIT_FREQUENCIES).optional(),
  goalId: z.string().optional(),
});

const updateSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  frequency: z.enum(HABIT_FREQUENCIES).optional(),
  goalId: z.string().nullable().optional(),
  active: z.boolean().optional(),
  checkIn: z.boolean().optional(),
});

const deleteSchema = z.object({ id: z.string() });

const STREAK_MILESTONES = [7, 30, 100];

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const habits = await prisma.habit.findMany({
      where: { userId: session.id },
      include: { goal: { select: { id: true, title: true } } },
      orderBy: [{ active: "desc" }, { streak: "desc" }],
    });

    return json({
      habits: habits.map((h) => ({
        ...h,
        doneToday: habitDoneToday(h.lastDoneAt),
      })),
    });
  } catch (error) {
    console.error("[api/habits]", error);
    return serverError("Habits unavailable. Run: npx pnpm@9.15.0 db:push");
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const habit = await prisma.habit.create({
      data: {
        userId: session.id,
        title: parsed.data.title,
        frequency: parsed.data.frequency ?? "DAILY",
        goalId: parsed.data.goalId,
      },
      include: { goal: { select: { id: true, title: true } } },
    });

    return json({ habit: { ...habit, doneToday: false } }, 201);
  } catch (error) {
    console.error("[api/habits]", error);
    return serverError("Could not create habit.");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const { id, checkIn, ...rest } = parsed.data;

    const existing = await prisma.habit.findFirst({
      where: { id, userId: session.id },
    });
    if (!existing) return badRequest("Habit not found");

    let data: Record<string, unknown> = { ...rest };

    if (checkIn) {
      const result = computeHabitCheckIn(
        existing.lastDoneAt,
        existing.frequency,
        existing.streak,
        existing.bestStreak
      );
      if (!result.alreadyDone) {
        data = {
          ...data,
          streak: result.streak,
          bestStreak: result.bestStreak,
          lastDoneAt: result.lastDoneAt,
        };
        if (STREAK_MILESTONES.includes(result.streak)) {
          await recordProgressMoment(
            session.id,
            `${result.streak}-day streak: ${existing.title}`,
            "MILESTONE",
            "HABITS"
          );
        }
      }
    }

    const habit = await prisma.habit.update({
      where: { id },
      data,
      include: { goal: { select: { id: true, title: true } } },
    });

    return json({ habit: { ...habit, doneToday: habitDoneToday(habit.lastDoneAt) } });
  } catch (error) {
    console.error("[api/habits]", error);
    return serverError("Could not update habit.");
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const existing = await prisma.habit.findFirst({
      where: { id: parsed.data.id, userId: session.id },
    });
    if (!existing) return badRequest("Habit not found");

    await prisma.habit.delete({ where: { id: parsed.data.id } });
    return json({ ok: true });
  } catch (error) {
    console.error("[api/habits]", error);
    return serverError("Could not delete habit.");
  }
}
