import { z } from "zod";
import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, startOfDay } from "@/lib/api";
import { recordProgressMoment } from "@/lib/forward";
const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  goalId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().datetime().optional(),
  isMission: z.boolean().optional(),
});

const updateSchema = z.object({
  id: z.string(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "SKIPPED"]).optional(),
  isMission: z.boolean().optional(),
  title: z.string().min(1).max(200).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const tasks = await prisma.task.findMany({
    where: { userId: session.id },
    include: { goal: { select: { id: true, title: true, domain: true } } },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
  });

  return json({ tasks });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input");

  const { title, description, goalId, priority, dueDate, isMission } = parsed.data;

  if (isMission) {
    await prisma.task.updateMany({
      where: { userId: session.id, isMission: true },
      data: { isMission: false },
    });
  }

  const task = await prisma.task.create({
    data: {
      userId: session.id,
      title,
      description,
      goalId,
      priority: priority ?? "MEDIUM",
      dueDate: dueDate ? new Date(dueDate) : undefined,
      isMission: isMission ?? false,
    },
    include: { goal: { select: { id: true, title: true, domain: true } } },
  });

  return json({ task }, 201);
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input");

  const { id, status, isMission, title } = parsed.data;

  const existing = await prisma.task.findFirst({ where: { id, userId: session.id } });
  if (!existing) return badRequest("Task not found");

  if (isMission) {
    await prisma.task.updateMany({
      where: { userId: session.id, isMission: true },
      data: { isMission: false },
    });
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(status && {
        status,
        completedAt: status === "DONE" ? new Date() : null,
      }),
      ...(isMission !== undefined && { isMission }),
    },
    include: { goal: { select: { id: true, title: true, domain: true } } },
  });

  if (status === "DONE" && existing.status !== "DONE") {
    await recordProgressMoment(
      session.id,
      task.title,
      "TASK_COMPLETED",
      task.goal?.domain ?? null
    );

    const today = startOfDay();
    await prisma.eveningReview.deleteMany({
      where: { userId: session.id, date: { gte: today } },
    });
  }

  if (status === "DONE" && task.goalId) {
    const goalTasks = await prisma.task.findMany({ where: { goalId: task.goalId } });
    const done = goalTasks.filter((t) => t.id === task.id ? true : t.status === "DONE").length;
    const progress = Math.round((done / goalTasks.length) * 100);
    await prisma.goal.update({ where: { id: task.goalId }, data: { progress } });
  }

  return json({ task });
}
