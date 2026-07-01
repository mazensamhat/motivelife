import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { badRequest, forbidden, json, serverError, unauthorized } from "@/lib/api";
import { generateAndSaveMarketingPosts } from "@/lib/marketing-agent-service";

const schema = z.object({
  brandId: z.enum(["motivelife", "motivefx", "motiveiq"]),
  brief: z.string().min(10).max(2000),
  channels: z
    .array(
      z.enum(["linkedin", "instagram", "facebook", "tiktok", "google_search", "google_ads"])
    )
    .min(1),
  includeSeo: z.boolean().optional(),
  includeAds: z.boolean().optional(),
  generateMedia: z.boolean().optional(),
  mediaKind: z.enum(["image", "animation"]).optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      if (auth.status === 401) return unauthorized(auth.error);
      return forbidden(auth.error);
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid generate request.");

    const result = await generateAndSaveMarketingPosts(
      {
        brandId: parsed.data.brandId,
        brief: parsed.data.brief,
        channels: parsed.data.channels,
        includeSeo: parsed.data.includeSeo ?? true,
        includeAds: parsed.data.includeAds ?? false,
        generateMedia: parsed.data.generateMedia ?? false,
        mediaKind: parsed.data.mediaKind,
      },
      auth.session.email
    );

    return json(result);
  } catch (error) {
    console.error("[admin/marketing/generate]", error);
    return serverError("Could not generate marketing content.");
  }
}
