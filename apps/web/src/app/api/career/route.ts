import { z } from "zod";
import { prisma } from "@forward/database";
import { APPLICATION_STATUSES } from "@forward/shared";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError, startOfDay } from "@/lib/api";
import { recordProgressMoment } from "@/lib/forward";
import { defaultInterviewPrep, parsePrepChecklist } from "@forward/ai";
import { ensureCareerInterviewLoop } from "@/lib/adaptive-coaching";

const createSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  goalId: z.string().optional(),
  status: z.enum(APPLICATION_STATUSES).optional(),
  url: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
  nextStep: z.string().max(500).optional(),
  interviewAt: z.string().datetime().optional(),
});

const updateSchema = z.object({
  id: z.string(),
  company: z.string().min(1).max(200).optional(),
  role: z.string().min(1).max(200).optional(),
  goalId: z.string().nullable().optional(),
  status: z.enum(APPLICATION_STATUSES).optional(),
  url: z.string().url().optional().or(z.literal("")).nullable(),
  notes: z.string().max(2000).optional().nullable(),
  nextStep: z.string().max(500).optional().nullable(),
  interviewAt: z.string().datetime().optional().nullable(),
  prepChecklist: z.array(z.object({ id: z.string(), label: z.string(), done: z.boolean() })).optional(),
  prepNotes: z.string().max(2000).optional().nullable(),
});

const deleteSchema = z.object({ id: z.string() });

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const applications = await prisma.jobApplication.findMany({
      where: { userId: session.id },
      include: { goal: { select: { id: true, title: true } } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });

    await Promise.all(
      applications
        .filter((a) => a.status === "INTERVIEW")
        .map((app) => {
          const checklist = parsePrepChecklist(app.prepChecklist, app.company, app.role);
          return ensureCareerInterviewLoop(
            session.id,
            app.id,
            app.company,
            app.role,
            checklist
          );
        })
    );

    return json({ applications });
  } catch (error) {
    console.error("[api/career]", error);
    return serverError("Career data unavailable. Run: npx pnpm@9.15.0 db:push");
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input");

  const { company, role, goalId, status, url, notes, nextStep, interviewAt } = parsed.data;
  const appStatus = status ?? "SAVED";

  const application = await prisma.jobApplication.create({
    data: {
      userId: session.id,
      company,
      role,
      goalId,
      status: appStatus,
      url: url || undefined,
      notes,
      nextStep,
      appliedAt: appStatus === "APPLIED" ? new Date() : undefined,
      interviewAt: interviewAt ? new Date(interviewAt) : undefined,
    },
    include: { goal: { select: { id: true, title: true } } },
  });

  return json({ application }, 201);
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input");

  const { id, status, interviewAt, prepChecklist, prepNotes, ...rest } = parsed.data;

  const existing = await prisma.jobApplication.findFirst({
    where: { id, userId: session.id },
  });
  if (!existing) return badRequest("Application not found");

  let prepChecklistJson: string | undefined;
  if (prepChecklist) {
    prepChecklistJson = JSON.stringify(prepChecklist);
  } else if (status === "INTERVIEW" && existing.status !== "INTERVIEW" && !existing.prepChecklist) {
    prepChecklistJson = JSON.stringify(defaultInterviewPrep(existing.company, existing.role));
  }

  const application = await prisma.jobApplication.update({
    where: { id },
    data: {
      ...rest,
      ...(status && {
        status,
        appliedAt:
          status === "APPLIED" && !existing.appliedAt ? new Date() : existing.appliedAt,
      }),
      ...(interviewAt !== undefined && {
        interviewAt: interviewAt ? new Date(interviewAt) : null,
      }),
      ...(prepNotes !== undefined && { prepNotes }),
      ...(prepChecklistJson && { prepChecklist: prepChecklistJson }),
      ...(rest.url !== undefined && { url: rest.url || null }),
    },
    include: { goal: { select: { id: true, title: true } } },
  });

  if (status === "OFFER" && existing.status !== "OFFER") {
    await recordProgressMoment(
      session.id,
      `Received offer from ${application.company}`,
      "MILESTONE",
      "CAREER"
    );
    await prisma.eveningReview.deleteMany({
      where: { userId: session.id, date: { gte: startOfDay() } },
    });
  }

  return json({ application });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input");

  const existing = await prisma.jobApplication.findFirst({
    where: { id: parsed.data.id, userId: session.id },
  });
  if (!existing) return badRequest("Application not found");

  await prisma.jobApplication.delete({ where: { id: parsed.data.id } });
  return json({ ok: true });
}
