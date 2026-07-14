import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { badRequest, forbidden, json, serverError, unauthorized } from "@/lib/api";
import { generateAndSaveMarketingPosts } from "@/lib/marketing-agent-service";
import { databaseErrorMessage } from "@/lib/db-error";

/** Text drafts + hashtag research; optional still/GIF on first post only. */
export const maxDuration = 300;

const schema = z.object({
  brandId: z.enum(["motivelife", "motivefx", "motiveiq", "motivepulse"]),
  brief: z.string().min(10).max(2000),
  channels: z
    .array(
      z.enum([
        "linkedin",
        "instagram",
        "facebook",
        "tiktok",
        "reddit",
        "x",
        "threads",
        "youtube",
        "google_search",
        "google_ads",
      ])
    )
    .min(1),
  includeSeo: z.boolean().optional(),
  includeAds: z.boolean().optional(),
  generateMedia: z.boolean().optional(),
  mediaKind: z.enum(["image", "video_5", "video_15", "video_30", "animation"]).optional(),
  referenceImage: z
    .object({
      base64: z.string().min(100).max(5_000_000),
      mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
    })
    .optional(),
  referenceImageMode: z.enum(["reimagine", "polish"]).optional(),
  imageProvider: z
    .enum(["auto", "gemini", "openai", "browser", "pollinations", "cloudflare", "puter"])
    .optional(),
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
        referenceImage: parsed.data.referenceImage,
        referenceImageMode: parsed.data.referenceImageMode,
        imageProvider: parsed.data.imageProvider,
      },
      auth.session.email
    );

    return json(result);
  } catch (error) {
    console.error("[admin/marketing/generate]", error);
    return serverError(
      databaseErrorMessage(error, "Could not generate marketing content. Try again in a moment.")
    );
  }
}
