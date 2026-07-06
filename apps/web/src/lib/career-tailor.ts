import { prisma } from "@forward/database";
import {
  generateTailoredCareerBriefingRules,
  generateTailoredCareerBriefingWithAI,
  parseTailoredCareerBriefing,
} from "@forward/ai";
import type { TailoredCareerBriefing } from "@forward/shared";

export { parseTailoredCareerBriefing };

export async function getCareerFocusApplication(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { careerFocusApplicationId: true, resumeText: true },
  });
  if (!user) return null;

  let applicationId = user.careerFocusApplicationId;

  if (!applicationId) {
    const auto = await prisma.jobApplication.findFirst({
      where: {
        userId,
        status: { in: ["INTERVIEW", "APPLIED", "SAVED"] },
        interviewAt: { not: null, gte: new Date() },
      },
      orderBy: { interviewAt: "asc" },
    });
    applicationId = auto?.id ?? null;
  }

  if (!applicationId) {
    const active = await prisma.jobApplication.findFirst({
      where: { userId, status: { in: ["INTERVIEW", "APPLIED", "SAVED"] } },
      orderBy: { updatedAt: "desc" },
    });
    applicationId = active?.id ?? null;
  }

  if (!applicationId) return null;

  const application = await prisma.jobApplication.findFirst({
    where: { id: applicationId, userId },
  });
  if (!application) return null;

  return { application, resumeText: user.resumeText };
}

export async function tailorApplicationBriefing(
  userId: string,
  applicationId: string
): Promise<{ briefing: TailoredCareerBriefing; applicationId: string }> {
  const [user, application] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, resumeText: true },
    }),
    prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
    }),
  ]);

  if (!application) throw new Error("Application not found.");
  if (!user?.resumeText?.trim()) {
    throw new Error("Upload your resume on the Career page first.");
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const input = {
    resumeText: user.resumeText,
    company: application.company,
    role: application.role,
    jobUrl: application.url,
    notes: application.notes,
    nextStep: application.nextStep,
    userName: user.name,
  };

  const briefing = apiKey
    ? await generateTailoredCareerBriefingWithAI(input, apiKey)
    : generateTailoredCareerBriefingRules(input);

  await prisma.$transaction([
    prisma.jobApplication.update({
      where: { id: application.id },
      data: { tailoredBriefing: JSON.stringify(briefing) },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { careerFocusApplicationId: application.id },
    }),
  ]);

  return { briefing, applicationId: application.id };
}

export function mergeTailoredHero<T extends {
  dynamicOpening: string;
  chiefOfStaffLine: string;
  challengeLine: string | null;
  startAction?: { label: string; href: string; taskId?: string };
}>(
  hero: T,
  tailored: TailoredCareerBriefing | null,
  focus: { id: string; company: string; role: string } | null
): T {
  if (!tailored || !focus) return hero;

  return {
    ...hero,
    dynamicOpening: tailored.dynamicOpening,
    chiefOfStaffLine: tailored.chiefOfStaffLine,
    challengeLine: tailored.challengeLine ?? hero.challengeLine,
    startAction: {
      label: `Career: ${focus.company}`,
      href: `/career?app=${focus.id}`,
    },
  };
}
