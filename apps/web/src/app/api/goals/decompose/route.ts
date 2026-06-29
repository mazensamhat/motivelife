import { z } from "zod";
import { prisma } from "@forward/database";
import { decomposeGoal } from "@forward/ai";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { linkGraphEdge } from "@/lib/life-graph";
const schema = z.object({ goalId: z.string() });

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");

    const goal = await prisma.goal.findFirst({
      where: { id: parsed.data.goalId, userId: session.id, status: "ACTIVE" },
    });
    if (!goal) return badRequest("Goal not found");

    const existingCount = await prisma.task.count({ where: { goalId: goal.id } });
    if (existingCount > 0) {
      return badRequest("This goal already has tasks. Remove them first to re-decompose.");
    }

    const steps = decomposeGoal({
      title: goal.title,
      domain: goal.domain,
      description: goal.description,
    });

    const tasks = await prisma.$transaction(
      steps.map((title, index) =>
        prisma.task.create({
          data: {
            userId: session.id,
            goalId: goal.id,
            title,
            priority: index === 0 ? "HIGH" : "MEDIUM",
          },
          include: { goal: { select: { id: true, title: true, domain: true } } },
        })
      )
    );

    for (const task of tasks) {
      await linkGraphEdge(
        session.id,
        { type: "TASK", id: task.id },
        { type: "GOAL", id: goal.id },
        "ENABLES",
        goal.title
      );
    }

    return json({ tasks }, 201);  } catch (error) {
    console.error("[api/goals/decompose]", error);
    return serverError("Could not decompose goal.");
  }
}
