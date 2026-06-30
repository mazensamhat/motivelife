import { z } from "zod";
import { prisma } from "@forward/database";
import { json, badRequest, serverError } from "@/lib/api";
import { normalizeTrafficSource } from "@/lib/marketing-channels";

const schema = z.object({
  path: z.string().max(512),
  referrer: z.string().max(2048).optional(),
  utmSource: z.string().max(64).optional(),
  utmMedium: z.string().max(64).optional(),
  utmCampaign: z.string().max(128).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid page view payload.");

    const path = parsed.data.path.startsWith("/") ? parsed.data.path : `/${parsed.data.path}`;
    const source = normalizeTrafficSource(
      parsed.data.referrer ?? null,
      parsed.data.utmSource ?? null
    );

    await prisma.pageView.create({
      data: {
        path: path.slice(0, 512),
        referrer: parsed.data.referrer?.slice(0, 2048) ?? null,
        source,
        medium: parsed.data.utmMedium ?? null,
        campaign: parsed.data.utmCampaign ?? null,
      },
    });

    return json({ ok: true });
  } catch (error) {
    console.error("[analytics/pageview]", error);
    return serverError("Could not record page view.");
  }
}
