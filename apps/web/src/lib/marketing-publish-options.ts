/** Default publish placement per social channel. */
export function defaultPublishFormat(channel: string | null | undefined): string {
  switch (channel) {
    case "youtube":
      return "shorts";
    case "instagram":
    case "facebook":
      return "reels";
    case "tiktok":
      return "short";
    case "linkedin":
    case "x":
    case "threads":
    case "reddit":
    default:
      return "feed";
  }
}

export function defaultPublishPrivacy(channel: string | null | undefined): string | null {
  return channel === "youtube" ? "public" : null;
}

export function formatOptionsForChannel(
  channel: string | null | undefined
): { id: string; label: string }[] {
  switch (channel) {
    case "youtube":
      return [
        { id: "shorts", label: "Shorts" },
        { id: "video", label: "Video" },
      ];
    case "instagram":
      return [
        { id: "reels", label: "Reels" },
        { id: "feed", label: "Feed" },
      ];
    case "facebook":
      return [
        { id: "reels", label: "Reels" },
        { id: "feed", label: "Feed" },
      ];
    case "tiktok":
      return [{ id: "short", label: "Short" }];
    case "linkedin":
    case "x":
    case "threads":
    case "reddit":
      return [{ id: "feed", label: "Feed" }];
    default:
      return [{ id: "feed", label: "Feed" }];
  }
}
