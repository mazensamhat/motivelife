import { prisma } from "@forward/database";
import { getSession } from "@/lib/session";
import { json, unauthorized, serverError, badRequest } from "@/lib/api";
import { resumeExcerpt, storeResumeUpload } from "@/lib/career-resume";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        resumeText: true,
        resumeFileName: true,
        resumeUploadedAt: true,
        careerFocusApplicationId: true,
      },
    });

    return json({
      resume: {
        hasResume: Boolean(user?.resumeText?.trim()),
        fileName: user?.resumeFileName ?? null,
        uploadedAt: user?.resumeUploadedAt?.toISOString() ?? null,
        excerpt: resumeExcerpt(user?.resumeText),
      },
      focusApplicationId: user?.careerFocusApplicationId ?? null,
    });
  } catch (error) {
    console.error("[api/career/resume GET]", error);
    return serverError("Could not load resume.");
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { text?: string; fileName?: string };
      if (!body.text?.trim()) return badRequest("Paste resume text or upload a file.");
      const resumeText = body.text.trim().slice(0, 50_000);
      await prisma.user.update({
        where: { id: session.id },
        data: {
          resumeText,
          resumeFileName: body.fileName?.trim() || "pasted-resume.txt",
          resumeUploadedAt: new Date(),
          resumeBlobPath: null,
        },
      });
      return json({
        ok: true,
        resume: {
          hasResume: true,
          fileName: body.fileName?.trim() || "pasted-resume.txt",
          uploadedAt: new Date().toISOString(),
          excerpt: resumeExcerpt(resumeText),
        },
      });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("Choose a PDF, TXT, or MD file.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeResumeUpload({
      userId: session.id,
      buffer,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
    });

    await prisma.user.update({
      where: { id: session.id },
      data: {
        resumeText: stored.resumeText,
        resumeFileName: stored.resumeFileName,
        resumeBlobPath: stored.resumeBlobPath ?? null,
        resumeUploadedAt: new Date(),
      },
    });

    return json({
      ok: true,
      resume: {
        hasResume: true,
        fileName: stored.resumeFileName,
        uploadedAt: new Date().toISOString(),
        excerpt: resumeExcerpt(stored.resumeText),
      },
    });
  } catch (error) {
    console.error("[api/career/resume POST]", error);
    const message = error instanceof Error ? error.message : "Could not save resume.";
    return badRequest(message);
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    await prisma.user.update({
      where: { id: session.id },
      data: {
        resumeText: null,
        resumeFileName: null,
        resumeBlobPath: null,
        resumeUploadedAt: null,
      },
    });

    return json({ ok: true });
  } catch (error) {
    console.error("[api/career/resume DELETE]", error);
    return serverError("Could not remove resume.");
  }
}
