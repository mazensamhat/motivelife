/** Open the native composer / upload page for manual posting on each platform. */

export type ManualShareChannel = "facebook" | "instagram" | "linkedin" | "tiktok";

const PLATFORM_LABEL: Record<ManualShareChannel, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

/** Best-effort composer URLs (page admins upload manually from here). */
const COMPOSER_URLS: Record<ManualShareChannel, string> = {
  facebook:
    process.env.NEXT_PUBLIC_MARKETING_FACEBOOK_COMPOSER_URL?.trim() ||
    "https://www.facebook.com/profile.php?id=1195433160324440",
  instagram:
    process.env.NEXT_PUBLIC_MARKETING_INSTAGRAM_CREATE_URL?.trim() ||
    "https://www.instagram.com/create/select/",
  linkedin:
    process.env.NEXT_PUBLIC_MARKETING_LINKEDIN_COMPOSER_URL?.trim() ||
    "https://www.linkedin.com/company/motivelife-ai/admin/page-posts/published/",
  tiktok:
    process.env.NEXT_PUBLIC_MARKETING_TIKTOK_UPLOAD_URL?.trim() ||
    "https://www.tiktok.com/upload",
};

export type ManualSharePost = {
  id: string;
  channel: string | null;
  body: string;
  hashtags: string[];
  ctaUrl: string | null;
  mediaUrl: string | null;
  mediaPreviewUrl: string | null;
};

export function formatManualShareCaption(post: ManualSharePost): string {
  const tags = post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
  const parts = [post.body.trim()];
  if (tags) parts.push(tags);
  if (post.ctaUrl?.trim()) parts.push(post.ctaUrl.trim());
  return parts.join("\n\n");
}

function resolveMediaUrl(post: ManualSharePost, origin: string): string | null {
  if (post.mediaUrl?.startsWith("http")) return post.mediaUrl;
  if (post.mediaPreviewUrl) {
    return post.mediaPreviewUrl.startsWith("http")
      ? post.mediaPreviewUrl
      : `${origin}${post.mediaPreviewUrl}`;
  }
  return `${origin}/api/marketing/media/${post.id}`;
}

function isManualShareChannel(channel: string | null): channel is ManualShareChannel {
  return (
    channel === "facebook" ||
    channel === "instagram" ||
    channel === "linkedin" ||
    channel === "tiktok"
  );
}

export type ManualShareResult = {
  platform: string;
  captionCopied: boolean;
  mediaOpened: boolean;
  message: string;
};

/** Copy caption, open platform composer, and open media in a second tab when available. */
export async function sharePostManually(
  post: ManualSharePost,
  origin: string
): Promise<ManualShareResult> {
  const caption = formatManualShareCaption(post);
  const channel = post.channel;

  if (!isManualShareChannel(channel)) {
    await navigator.clipboard.writeText(caption);
    return {
      platform: "clipboard",
      captionCopied: true,
      mediaOpened: false,
      message: "Caption copied to clipboard.",
    };
  }

  const platform = PLATFORM_LABEL[channel];
  await navigator.clipboard.writeText(caption);

  window.open(COMPOSER_URLS[channel], "_blank", "noopener,noreferrer");

  const mediaUrl = resolveMediaUrl(post, origin);
  let mediaOpened = false;
  if (mediaUrl) {
    window.open(mediaUrl, "_blank", "noopener,noreferrer");
    mediaOpened = true;
  }

  const message = mediaOpened
    ? `Caption copied. Opened ${platform} composer and your media — paste caption, attach the file, and post.`
    : `Caption copied. Opened ${platform} — paste your caption and add media if needed.`;

  return { platform, captionCopied: true, mediaOpened, message };
}
