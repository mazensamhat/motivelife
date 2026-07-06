import { z } from "zod";
import { prisma } from "@forward/database";
import { PRODUCT_FEEDBACK_KINDS } from "@forward/shared";
import { getSession } from "@/lib/session";
import { badRequest, json, unauthorized, serverError } from "@/lib/api";
import { sendProductFeedbackEmail } from "@/lib/email";

const postSchema = z.object({
  kind: z.enum(PRODUCT_FEEDBACK_KINDS),
  message: z.string().min(8).max(4000),
  pagePath: z.string().max(500).optional(),
  viewport: z.enum(["mobile", "tablet", "desktop"]).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Please write at least a few words so we understand your request.");
    }

    const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

    const row = await prisma.productFeedback.create({
      data: {
        userId: session.id,
        kind: parsed.data.kind,
        message: parsed.data.message.trim(),
        pagePath: parsed.data.pagePath ?? null,
        viewport: parsed.data.viewport ?? null,
        userAgent,
      },
      include: {
        user: { select: { email: true, name: true } },
      },
    });

    void sendProductFeedbackEmail({
      kind: row.kind,
      message: row.message,
      pagePath: row.pagePath,
      viewport: row.viewport,
      userEmail: row.user.email,
      userName: row.user.name,
    }).catch((err) => console.error("[api/feedback] email failed", err));

    return json({ ok: true, id: row.id }, 201);
  } catch (error) {
    console.error("[api/feedback]", error);
    return serverError("Could not save feedback.");
  }
}
