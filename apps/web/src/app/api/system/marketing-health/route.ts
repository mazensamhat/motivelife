import { getPublisherStatus } from "@forward/marketing-agent";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MarketingChecks = {
  openai: boolean;
  replicate: boolean;
  blob: boolean;
  authSecret: boolean;
  serper: boolean;
  narratedMp4Mux: boolean;
};

/** Public readiness for marketing auto-post and narrated video generation. */
export async function GET() {
  const openai = Boolean(
    process.env.OPENAI_API_KEY?.trim() && process.env.ENABLE_OPENAI !== "false"
  );
  const replicate = Boolean(process.env.REPLICATE_API_TOKEN?.trim());
  const blob = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
  const authSecret = Boolean(process.env.AUTH_SECRET?.trim());
  const serper = Boolean(process.env.SERPER_API_KEY?.trim());

  const checks: MarketingChecks = {
    openai,
    replicate,
    blob,
    authSecret,
    serper,
    narratedMp4Mux: openai && replicate && blob && authSecret,
  };

  const publishers = getPublisherStatus();

  const blockers: string[] = [];
  if (!openai) blockers.push("Set OPENAI_API_KEY for drafts, images, and voiceover.");
  if (!replicate) blockers.push("Set REPLICATE_API_TOKEN for MP4 clips and server-side audio mux.");
  if (!blob) blockers.push("Set BLOB_READ_WRITE_TOKEN for large MP4 storage and mux temp files.");
  if (!publishers.facebook) {
    blockers.push(
      "Meta Facebook: set MARKETING_META_ACCESS_TOKEN + MARKETING_META_PAGE_ID (no LinkedIn-style app review required)."
    );
  }
  if (!publishers.instagram) {
    blockers.push(
      "Meta Instagram: set MARKETING_META_ACCESS_TOKEN + MARKETING_META_PAGE_ID, link IG Business to that Page, and grant instagram_content_publish on the System User."
    );
  }
  if (!publishers.linkedin) {
    blockers.push(
      "LinkedIn: waiting on Marketing Developer Platform approval + MARKETING_LINKEDIN_ACCESS_TOKEN + MARKETING_LINKEDIN_ORG_ID."
    );
  }
  const lifeYoutube = Boolean(publishers.brandPublishers?.motivelife?.youtube);
  const fxYoutube = Boolean(publishers.brandPublishers?.motivefx?.youtube);
  if (!lifeYoutube && !fxYoutube && !publishers.youtube) {
    blockers.push(
      "YouTube Shorts: set MARKETING_YOUTUBE_CLIENT_ID/SECRET (or GOOGLE_CLIENT_*), plus MARKETING_MOTIVELIFE_YOUTUBE_* and/or MARKETING_MOTIVEFX_YOUTUBE_* channel ID + refresh token, then redeploy."
    );
  } else if (!lifeYoutube) {
    blockers.push(
      "MotiveLife YouTube: set MARKETING_MOTIVELIFE_YOUTUBE_CHANNEL_ID=UCzjdFghiI1akeuVeSERu21A + MARKETING_MOTIVELIFE_YOUTUBE_REFRESH_TOKEN (OAuth as @MotiveLife-ai owner)."
    );
  }

  const ok =
    checks.openai &&
    checks.replicate &&
    checks.blob &&
    (publishers.facebook || publishers.instagram);

  return json({
    ok,
    checks,
    publishers,
    blockers,
    metaNote:
      "Meta (Facebook/Instagram) does not use LinkedIn's Community Management API. Create a Meta Business app, link IG Business to your Page, and add a long-lived Page token — then set the three MARKETING_META_* env vars.",
    linkedinNote:
      "LinkedIn auto-post requires Marketing Developer Platform product approval on your LinkedIn developer app.",
    playStoreNote:
      "Play Store production requires closed testing (12 testers × 14 days) after your developer account is authorized.",
    testMp4:
      "Admin → Marketing Agent → draft → 5s / 15s / 30s video. Narrated MP4 needs narratedMp4Mux: true.",
  });
}
