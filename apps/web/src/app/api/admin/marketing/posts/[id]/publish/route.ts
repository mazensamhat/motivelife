import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { forbidden, json, serverError, unauthorized } from "@/lib/api";
import { publishMarketingPostById } from "@/lib/marketing-agent-service";

/** Meta / YouTube may pull or upload large MP4s during publish. */
export const maxDuration = 180;

const bodySchema = z.object({
  scheduleDate: z.string().datetime().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(auth.error);
      return forbidden(auth.error);
    }

    const { id } = await params;
    let scheduleDate: string | undefined;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const raw = await request.json().catch(() => ({}));
      const parsed = bodySchema.safeParse(raw);
      if (!parsed.success) {
        return json({ error: "Invalid scheduleDate (use ISO datetime)." }, 400);
      }
      scheduleDate = parsed.data.scheduleDate;
    }

    const result = await publishMarketingPostById(id, { scheduleDate });
    if (!result.ok && result.error === "Post not found") {
      return json({ error: result.error }, 404);
    }
    return json(result);
  } catch (error) {
    console.error("[admin/marketing/publish]", error);
    return serverError("Could not publish post.");
  }
}
