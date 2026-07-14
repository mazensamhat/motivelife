/** Open the native composer / upload page for manual posting on each platform. */

export type ManualShareChannel =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | "reddit";

const PLATFORM_LABEL: Record<ManualShareChannel, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  reddit: "Reddit",
};

/**
 * Best-effort composer URLs.
 * Instagram has no reliable web deep-link to the upload UI — /create/select/ wrongly
 * resolves to @create. Use Meta Business Suite (IG linked to your Page) or instagram.com home.
 */
const COMPOSER_URLS: Record<ManualShareChannel, string> = {
  facebook:
    process.env.NEXT_PUBLIC_MARKETING_FACEBOOK_COMPOSER_URL?.trim() ||
    "https://www.facebook.com/profile.php?id=1195433160324440",
  instagram:
    process.env.NEXT_PUBLIC_MARKETING_INSTAGRAM_CREATE_URL?.trim() ||
    "https://business.facebook.com/latest/composer",
  linkedin:
    process.env.NEXT_PUBLIC_MARKETING_LINKEDIN_COMPOSER_URL?.trim() ||
    "https://www.linkedin.com/company/motivelife-ai/admin/page-posts/published/",
  tiktok:
    process.env.NEXT_PUBLIC_MARKETING_TIKTOK_UPLOAD_URL?.trim() ||
    "https://www.tiktok.com/upload",
  reddit:
    process.env.NEXT_PUBLIC_MARKETING_REDDIT_SUBMIT_URL?.trim() ||
    "https://www.reddit.com/submit",
};

export type ManualSharePost = {
  id: string;
  channel: string | null;
  body: string;
  title?: string | null;
  hashtags: string[];
  ctaUrl: string | null;
  mediaUrl: string | null;
  mediaPreviewUrl: string | null;
  mediaType?: string | null;
};

export function formatManualShareCaption(post: ManualSharePost): string {
  const tags = post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
  const parts: string[] = [];
  if (post.channel === "reddit" && post.title?.trim()) {
    parts.push(post.title.trim());
  }
  parts.push(post.body.trim());
  if (tags) parts.push(tags);
  if (post.ctaUrl?.trim()) parts.push(post.ctaUrl.trim());
  return parts.join("\n\n");
}

function resolveMediaUrl(post: ManualSharePost, origin: string): string | null {
  if (post.mediaPreviewUrl) {
    return post.mediaPreviewUrl.startsWith("http")
      ? post.mediaPreviewUrl
      : `${origin}${post.mediaPreviewUrl}`;
  }
  if (post.mediaUrl?.startsWith("http")) return post.mediaUrl;
  return `${origin}/api/marketing/media/${post.id}`;
}

function mediaExtension(mediaType?: string | null): string {
  if (mediaType === "video") return "mp4";
  if (mediaType === "gif") return "gif";
  return "jpg";
}

async function downloadMediaFile(
  url: string,
  postId: string,
  mediaType?: string | null
): Promise<boolean> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return false;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `motivelife-${postId.slice(0, 8)}.${mediaExtension(mediaType)}`;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    return true;
  } catch {
    return false;
  }
}

function isManualShareChannel(channel: string | null): channel is ManualShareChannel {
  return (
    channel === "facebook" ||
    channel === "instagram" ||
    channel === "linkedin" ||
    channel === "tiktok" ||
    channel === "reddit"
  );
}

function shareMessage(
  channel: ManualShareChannel,
  mediaDownloaded: boolean,
  mediaOpened: boolean
): string {
  switch (channel) {
    case "instagram":
      if (mediaDownloaded) {
        return "Caption copied. Media downloaded. Meta Business Suite opened — choose Instagram, upload the file from Downloads, paste caption.";
      }
      return "Caption copied. Meta Business Suite opened — choose Instagram, paste caption, and upload your creative.";
    case "facebook":
      if (mediaDownloaded) {
        return "Caption copied. Media downloaded. Facebook Page opened — create post, upload file, paste caption.";
      }
      return "Caption copied. Facebook Page opened — paste caption and add media.";
    case "linkedin":
      if (mediaDownloaded) {
        return "Caption copied. Media downloaded. LinkedIn company admin opened — create post, attach file, paste caption.";
      }
      return "Caption copied. LinkedIn opened — paste caption and add media.";
    case "tiktok":
      if (mediaDownloaded) {
        return "Caption copied. Media downloaded. TikTok upload opened — select the file from Downloads, paste caption.";
      }
      return "Caption copied. TikTok upload opened — paste caption and add video.";
    case "reddit":
      return "Post text copied. Reddit submit opened — paste title/body (and attach media if needed).";
    default:
      return mediaOpened
        ? "Caption copied. Composer and media opened."
        : "Caption copied. Composer opened.";
  }
}

export type ManualShareResult = {
  platform: string;
  captionCopied: boolean;
  mediaOpened: boolean;
  message: string;
};

/** Copy caption, open platform composer, and download media when available. */
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
  let mediaDownloaded = false;
  let mediaOpened = false;
  if (mediaUrl) {
    mediaDownloaded = await downloadMediaFile(mediaUrl, post.id, post.mediaType);
    if (!mediaDownloaded) {
      window.open(mediaUrl, "_blank", "noopener,noreferrer");
      mediaOpened = true;
    }
  }

  return {
    platform,
    captionCopied: true,
    mediaOpened: mediaDownloaded || mediaOpened,
    message: shareMessage(channel, mediaDownloaded, mediaOpened),
  };
}
