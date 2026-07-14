"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/button";
import {
  Megaphone,
  Sparkles,
  Send,
  Copy,
  CheckCircle2,
  Image,
  Film,
  Video,
  Trash2,
  ExternalLink,
  Download,
} from "lucide-react";
import { formatApiError, readApiResponse } from "@/lib/fetch-api";
import {
  fetchMarketingErrorMessage,
  formatMarketingPublishError,
} from "@/lib/marketing-publish-errors";
import {
  MarketingCreativeProgress,
  type CreativeKind,
  type CreativeJobPhase,
} from "@/components/admin/marketing-creative-progress";
import { sharePostManually } from "@/lib/marketing-manual-share";
import {
  MarketingReferenceImage,
  type ReferenceImage,
  type ReferenceImageMode,
} from "@/components/admin/marketing-reference-image";
import { downloadPostMedia, downloadPostNarration } from "@/lib/marketing-media-download";
import {
  MARKETING_OPS_FREE_TOOLS,
  MARKETING_OPS_TOOL_CATEGORIES,
  MARKETING_SCREENSHOTS_FOLDER,
} from "@/lib/marketing-ops-tools";

type MarketingPost = {
  id: string;
  brand: string;
  channel: string | null;
  kind: string;
  status: string;
  title: string | null;
  body: string;
  hashtags: string[];
  ctaUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  publishError: string | null;
  slug: string | null;
  publishedUrl: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  mediaPreviewUrl: string | null;
  narrationPreviewUrl: string | null;
  hasSourceScreenshot?: boolean;
  createdAt: string;
  updatedAt: string;
};

type BrandPublisherStatus = {
  linkedin: boolean;
  instagram: boolean;
  facebook: boolean;
  reddit?: boolean;
  tiktok?: boolean;
  x?: boolean;
  threads?: boolean;
  youtube?: boolean;
  buffer?: boolean;
  zernio?: boolean;
  metaPageId: boolean;
  instagramAccountId: boolean;
};

type PublisherStatus = {
  linkedin?: boolean;
  instagram?: boolean;
  facebook?: boolean;
  tiktok?: boolean;
  reddit?: boolean;
  x?: boolean;
  threads?: boolean;
  youtube?: boolean;
  google_ads?: boolean;
  google_search?: boolean;
  buffer?: boolean;
  zernio?: boolean;
  openai?: boolean;
  chatgpt?: boolean;
  gemini?: boolean;
  pollinations?: boolean;
  serper?: boolean;
  replicate?: boolean;
  grok?: boolean;
  hashtagResearch?: boolean;
  imageGeneration?: boolean;
  brandPublishers?: Record<string, BrandPublisherStatus>;
};

function brandChannelConfigured(
  brandId: string,
  channel: string,
  publisherStatus: PublisherStatus
): boolean {
  const brand = publisherStatus.brandPublishers?.[brandId];
  if (brand && channel in brand) {
    return Boolean(brand[channel as keyof BrandPublisherStatus]);
  }
  return Boolean(publisherStatus[channel as keyof PublisherStatus]);
}

type ImageProviderOption = {
  id: string;
  label: string;
  available: boolean;
  detail: string;
};

type CreativeJob = {
  postId: string;
  kind: CreativeKind;
  channel: string | null;
  startedAt: number;
  phase: CreativeJobPhase;
  message?: string;
};

const BRAND_DEFAULT_BRIEFS: Record<string, string> = {
  motivelife:
    "Launch post: MotiveLife helps you turn voice and thoughts into daily actions — 14-day free trial.",
  motivefx:
    "Launch post: MotiveFX — AI command center for stocks, crypto, sports betting, and Polymarket signals. Trade smarter, move faster.",
  motiveiq:
    "Launch post: MotiveIQ — AI growth intelligence for automotive dealerships. Sharper pipelines, clearer ops, faster F&I and service outcomes.",
  motivepulse:
    "Launch post: MotivePulse IQ — Insights. Automation. Growth. AI reviews, reputation, and growth automation for local businesses. Get your free Motive Score.",
};

const BRANDS = [
  { id: "motivelife", label: "MotiveLife" },
  { id: "motivefx", label: "MotiveFX" },
  { id: "motiveiq", label: "MotiveIQ" },
  { id: "motivepulse", label: "MotivePulse IQ" },
] as const;

const SOCIAL_CHANNELS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "tiktok", label: "TikTok" },
  { id: "reddit", label: "Reddit" },
  { id: "x", label: "X" },
  { id: "threads", label: "Threads" },
  { id: "youtube", label: "YouTube" },
] as const;

const EXTRA_CHANNELS = [
  { id: "google_search", label: "SEO" },
  { id: "google_ads", label: "Ads" },
] as const;

const ALL_CHANNELS = [...SOCIAL_CHANNELS, ...EXTRA_CHANNELS] as const;

const VIEW_TABS = [
  ...SOCIAL_CHANNELS,
  { id: "other", label: "SEO & Ads" },
] as const;

type ViewTabId = (typeof VIEW_TABS)[number]["id"];

function instagramPublishHint(post: MarketingPost): string | null {
  if (post.channel !== "instagram" || !post.mediaPreviewUrl) return null;
  if (post.mediaType === "gif") {
    return "Instagram auto-publish needs MP4 — click 5s video, then Publish.";
  }
  return null;
}

function publishNoteHelp(
  post: MarketingPost,
  publisherStatus: PublisherStatus,
  brandId: string
): string {
  const channel = post.channel ?? "";
  const err = post.publishError?.toLowerCase() ?? "";
  if (channel === "google_search") {
    return "Click Publish to site to go live at /blog/your-slug.";
  }
  if (err.includes("session has expired") || err.includes("error validating access token")) {
    return "Update MARKETING_META_ACCESS_TOKEN in Vercel (Page token expired).";
  }
  if (err.includes("media id") || err.includes("still processing")) {
    return "Wait 30–60 seconds for Instagram to finish processing, then click Publish again.";
  }
  if (channel && !brandChannelConfigured(brandId, channel, publisherStatus)) {
    const envHint =
      brandId === "motivelife"
        ? channel === "youtube"
          ? "MARKETING_YOUTUBE_* + MARKETING_YOUTUBE_REFRESH_TOKEN (or GOOGLE_CLIENT_*)"
          : channel === "reddit" || channel === "x" || channel === "threads" || channel === "tiktok"
            ? "MARKETING_BUFFER_* or MARKETING_ZERNIO_*"
            : `MARKETING_${channel.toUpperCase()} keys (or Buffer/Zernio)`
        : channel === "youtube"
          ? `MARKETING_${brandId.toUpperCase()}_YOUTUBE_REFRESH_TOKEN + CHANNEL_ID + MARKETING_YOUTUBE_CLIENT_*`
          : `MARKETING_${brandId.toUpperCase()}_BUFFER_* / ZERNIO_* or native META/LINKEDIN`;
    return `Use Copy to post manually until ${brandId} ${channel} is configured in Vercel (${envHint}).`;
  }
  if (err.includes("gif") || err.includes("mp4 for reels")) {
    return "Regenerate as 5s video for an MP4 auto-publish.";
  }
  return "Use Copy for caption, or fix the issue above and click Publish again.";
}

function postsForViewTab(posts: MarketingPost[], tabId: ViewTabId): MarketingPost[] {
  if (tabId === "other") {
    return posts.filter(
      (p) => p.channel === "google_search" || p.channel === "google_ads" || p.kind !== "social_post"
    );
  }
  return posts.filter((p) => p.channel === tabId);
}

function formatDraftLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DraftMediaPreview({
  post,
  jobRunning,
}: {
  post: MarketingPost;
  jobRunning: boolean;
}) {
  if (jobRunning) {
    return (
      <div className="flex aspect-[4/5] max-h-[420px] w-full items-center justify-center rounded-lg border border-cyan-500/30 bg-black/50 text-sm text-forward-400">
        Generating creative…
      </div>
    );
  }

  if (post.mediaPreviewUrl) {
    return (
      <div className="overflow-hidden rounded-lg border border-forward-700 bg-black/50">
        {post.mediaType === "video" ? (
          <video
            key={post.mediaPreviewUrl}
            src={post.mediaPreviewUrl}
            controls
            playsInline
            className="max-h-[420px] w-full object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={post.mediaPreviewUrl}
            src={post.mediaPreviewUrl}
            alt="Post creative"
            className="max-h-[420px] w-full object-contain"
          />
        )}
        <p className="px-3 py-2 text-xs text-forward-500">
          {post.mediaType === "video"
            ? "MP4 video"
            : post.mediaType === "gif"
              ? "Animation (GIF)"
              : post.mediaType ?? "Image"}
          {post.hasSourceScreenshot ? " · from screenshot" : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="flex aspect-[4/5] max-h-[420px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-forward-700 bg-forward-950/80 px-4 text-center">
      <Image size={28} className="text-forward-600" />
      <p className="text-sm text-forward-400">No image yet</p>
      <p className="text-xs text-forward-600">
        Enable “Include image” when generating, or use the buttons below.
      </p>
    </div>
  );
}

export function MarketingAgentPanel() {
  const draftsRef = useRef<HTMLDivElement>(null);
  const [posts, setPosts] = useState<MarketingPost[]>([]);
  const [publisherStatus, setPublisherStatus] = useState<PublisherStatus>({});
  const [imageProviders, setImageProviders] = useState<ImageProviderOption[]>([]);
  const [brandId, setBrandId] = useState("motivelife");
  const [brief, setBrief] = useState(BRAND_DEFAULT_BRIEFS.motivelife);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([
    "instagram",
    "facebook",
  ]);
  const [activeViewTab, setActiveViewTab] = useState<ViewTabId>("instagram");
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [creativeJob, setCreativeJob] = useState<CreativeJob | null>(null);
  const [generateMedia, setGenerateMedia] = useState(false);
  const [mediaKind, setMediaKind] = useState<CreativeKind>("image");
  const [scheduleAt, setScheduleAt] = useState("");
  const [imageProvider, setImageProvider] = useState("auto");
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(null);
  const [referenceImageMode, setReferenceImageMode] = useState<ReferenceImageMode>("reimagine");
  const [referenceImageError, setReferenceImageError] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sharedId, setSharedId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch("/api/admin/marketing");
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as {
        posts: MarketingPost[];
        publisherStatus: PublisherStatus;
        imageProviders?: ImageProviderOption[];
        defaultImageProvider?: string;
      };
      setPosts(data.posts);
      setPublisherStatus(data.publisherStatus);
      if (data.imageProviders?.length) {
        setImageProviders(data.imageProviders);
        setImageProvider((prev) => {
          if (prev !== "auto" && data.imageProviders!.some((p) => p.id === prev && p.available)) {
            return prev;
          }
          const envDefault = data.defaultImageProvider ?? "auto";
          const preferred = data.imageProviders!.find((p) => p.id === envDefault && p.available);
          const auto = data.imageProviders!.find((p) => p.id === "auto" && p.available);
          return preferred?.id ?? auto?.id ?? "auto";
        });
      }
    } catch {
      if (!opts?.silent) setMessage("Could not load marketing agent.");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!creativeJob || creativeJob.phase !== "running") return;
    document
      .getElementById(`marketing-post-${creativeJob.postId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [creativeJob?.postId, creativeJob?.phase]);

  const tabPosts = useMemo(() => {
    return postsForViewTab(posts, activeViewTab).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [posts, activeViewTab]);

  const activePost = useMemo(() => {
    if (activePostId) {
      const selected = tabPosts.find((p) => p.id === activePostId);
      if (selected) return selected;
    }
    return tabPosts[0] ?? null;
  }, [tabPosts, activePostId]);

  useEffect(() => {
    setActivePostId(null);
  }, [activeViewTab]);

  function toggleChannel(id: string) {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function scrollToDrafts() {
    draftsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function pickViewTabAfterGenerate(channels: string[]) {
    const social = SOCIAL_CHANNELS.map((c) => c.id).find((id) => channels.includes(id));
    if (social) {
      setActiveViewTab(social as ViewTabId);
      return;
    }
    if (channels.some((c) => c === "google_search" || c === "google_ads")) {
      setActiveViewTab("other");
    }
  }

  async function generate() {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/marketing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          brief,
          channels: selectedChannels,
          includeSeo: selectedChannels.includes("google_search"),
          includeAds: selectedChannels.includes("google_ads"),
          generateMedia,
          mediaKind: generateMedia ? mediaKind : undefined,
          imageProvider,
          referenceImage: referenceImage
            ? { base64: referenceImage.base64, mimeType: referenceImage.mimeType }
            : undefined,
          referenceImageMode: referenceImage ? referenceImageMode : undefined,
        }),
      });
      const { data, text } = await readApiResponse<{
        error?: string;
        posts?: MarketingPost[];
        mediaWarning?: string;
      }>(res);
      if (!res.ok || !data) throw new Error(formatApiError(res, text, data));

      pickViewTabAfterGenerate(selectedChannels);
      setMessage(
        data.mediaWarning
          ? `Generated ${data.posts?.length ?? 0} draft(s). ${data.mediaWarning}`
          : `Generated ${data.posts?.length ?? 0} draft(s). Switch tabs above to review each channel.`
      );
      await load({ silent: true });
      scrollToDrafts();
    } catch (e) {
      setMessage(fetchMarketingErrorMessage(e, "generate"));
    } finally {
      setGenerating(false);
    }
  }

  async function publish(id: string) {
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/marketing/posts/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleDate: scheduleAt.trim()
            ? new Date(scheduleAt).toISOString()
            : undefined,
        }),
      });
      const { data, text } = await readApiResponse<{
        ok?: boolean;
        error?: string;
        manualText?: string;
        publishedUrl?: string;
        scheduled?: boolean;
      }>(res);

      if (!data) throw new Error(formatApiError(res, text, data));

      if (data.ok) {
        setMessage(
          data.publishedUrl
            ? `Published to site: ${data.publishedUrl}`
            : data.scheduled
              ? "Scheduled via Buffer/Zernio."
              : "Published via API."
        );
        setScheduleAt("");
      } else if (data.manualText) {
        await navigator.clipboard.writeText(data.manualText);
        setCopiedId(id);
        setMessage(
          formatMarketingPublishError(data.error) ??
            "API not configured — copied post to clipboard."
        );
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        setMessage(formatMarketingPublishError(data.error) ?? "Publish failed");
      }
      await load({ silent: true });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Publish failed");
    }
  }

  async function generateCreative(
    id: string,
    kind: CreativeKind,
    providerOverride?: string
  ) {
    const post = posts.find((p) => p.id === id);
    if (post?.channel && post.channel !== activeViewTab && activeViewTab !== "other") {
      setActiveViewTab(post.channel as ViewTabId);
    }
    setCreativeJob({
      postId: id,
      kind,
      channel: post?.channel ?? null,
      startedAt: Date.now(),
      phase: "running",
    });
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/marketing/posts/${id}/creative`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          imageProvider: providerOverride ?? imageProvider,
        }),
      });
      const { data, text } = await readApiResponse<{
        error?: string;
        post?: MarketingPost;
        fallbackNote?: string;
        partialSuccess?: boolean;
      }>(res);
      if (!res.ok || !data) throw new Error(formatApiError(res, text, data));

      if (data.post) {
        setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data.post! } : p)));
      }

        const successMessage =
        data.fallbackNote ??
        (kind === "image"
          ? "Image ready."
          : kind === "animation"
            ? "5s animation ready."
            : kind === "video_5"
              ? "5s MP4 ready."
              : kind === "video_30"
                ? "Short MP4 ready."
                : "Creative ready.");

      setCreativeJob((prev) =>
        prev && prev.postId === id
          ? {
              ...prev,
              phase: data.partialSuccess ? "warning" : "success",
              message: successMessage,
            }
          : prev
      );
      setMessage(successMessage);
      await load({ silent: true });
    } catch (e) {
      const errMsg = fetchMarketingErrorMessage(e, "creative");
      setCreativeJob((prev) =>
        prev && prev.postId === id ? { ...prev, phase: "error", message: errMsg } : prev
      );
      setMessage(errMsg);
    }
  }

  function dismissCreativeJob() {
    setCreativeJob(null);
  }

  const isCreativeRunning = creativeJob?.phase === "running";

  async function downloadMedia(post: MarketingPost) {
    setMessage(null);
    try {
      await downloadPostMedia(post);
      setMessage("Download started.");
    } catch {
      setMessage("Could not download media.");
    }
  }

  async function downloadNarration(post: MarketingPost) {
    setMessage(null);
    try {
      await downloadPostNarration(post);
      setMessage("Voiceover download started.");
    } catch {
      setMessage("Could not download voiceover.");
    }
  }

  async function shareManually(post: MarketingPost) {
    setMessage(null);
    try {
      const result = await sharePostManually(post, window.location.origin);
      setSharedId(post.id);
      setMessage(result.message);
      setTimeout(() => setSharedId(null), 3000);
    } catch {
      setMessage("Could not copy caption or open share page.");
    }
  }

  async function deletePost(id: string) {
    if (!window.confirm("Delete this post?")) return;
    setMessage(null);
    const res = await fetch(`/api/admin/marketing/posts/${id}`, { method: "DELETE" });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMessage(data.error ?? "Could not delete post.");
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setMessage("Post deleted.");
  }

  async function clearAllDrafts() {
    const draftCount = posts.filter((p) => p.status === "draft").length;
    if (draftCount === 0) {
      setMessage("No drafts to delete.");
      return;
    }
    if (!window.confirm(`Delete all ${draftCount} draft(s)?`)) return;
    setMessage(null);
    const res = await fetch("/api/admin/marketing/drafts", { method: "DELETE" });
    const data = (await res.json()) as { error?: string; deleted?: number };
    if (!res.ok) {
      setMessage(data.error ?? "Could not delete drafts.");
      return;
    }
    setMessage(`Deleted ${data.deleted ?? 0} draft(s).`);
    await load({ silent: true });
  }

  const selectedProvider = imageProviders.find((p) => p.id === imageProvider);

  return (
    <section className="mb-6 rounded-xl border border-forward-800 bg-forward-900/60 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Megaphone size={18} className="text-emerald-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-forward-400">
            Marketing Agent
          </h2>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          {(
            [
              "instagram",
              "facebook",
              "linkedin",
              "youtube",
              "buffer",
              "zernio",
            ] as const
          ).map((ch) => {
            const ok =
              ch === "buffer" || ch === "zernio"
                ? Boolean(publisherStatus[ch]) ||
                  Boolean(publisherStatus.brandPublishers?.[brandId]?.[ch])
                : brandChannelConfigured(brandId, ch, publisherStatus);
            return (
              <span
                key={ch}
                className={`rounded-full px-2 py-0.5 ${
                  ok ? "bg-emerald-500/15 text-emerald-300" : "bg-forward-800 text-forward-500"
                }`}
              >
                {ch}: {ok ? "API" : "off"}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-forward-800 bg-forward-950/50 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-forward-500">
            Creative APIs (in Ops)
          </h3>
          <a
            href={MARKETING_SCREENSHOTS_FOLDER}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300"
          >
            Product UI screenshots
            <ExternalLink size={11} />
          </a>
        </div>
        <p className="mb-2.5 text-[11px] leading-relaxed text-forward-500">
          Green = API key live in Vercel. Click a ready API tool on a selected draft to generate
          in-app. Web-only tools have no public server API.
        </p>
        <div className="space-y-2">
          {MARKETING_OPS_TOOL_CATEGORIES.map((cat) => {
            const tools = MARKETING_OPS_FREE_TOOLS.filter((t) => t.category === cat.id);
            if (!tools.length) return null;
            return (
              <div key={cat.id} className="flex flex-wrap items-center gap-1.5">
                <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide text-forward-600">
                  {cat.label}
                </span>
                {tools.map((tool) => {
                  const apiReady =
                    tool.integration === "api" &&
                    Boolean(
                      tool.statusKey &&
                        publisherStatus[tool.statusKey as keyof PublisherStatus]
                    );

                  if (tool.integration === "web") {
                    return (
                      <a
                        key={tool.id}
                        href={tool.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={tool.blurb}
                        className="inline-flex items-center gap-1 rounded-md border border-forward-800 bg-forward-950 px-2 py-0.5 text-[11px] text-forward-500 hover:text-forward-300"
                      >
                        {tool.label}
                        <span className="text-[9px] uppercase text-forward-600">web</span>
                      </a>
                    );
                  }

                  if (!tool.creativeKind) {
                    return (
                      <span
                        key={tool.id}
                        title={
                          apiReady
                            ? tool.blurb
                            : `${tool.blurb}${tool.envHint ? ` — set ${tool.envHint}` : ""}`
                        }
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${
                          apiReady
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                            : "border-forward-800 bg-forward-950 text-forward-600"
                        }`}
                      >
                        {tool.label}
                        <span className="text-[9px] uppercase opacity-80">
                          {apiReady ? "API" : "off"}
                        </span>
                      </span>
                    );
                  }

                  const canRun = apiReady && Boolean(activePostId) && !isCreativeRunning;

                  return (
                    <button
                      key={tool.id}
                      type="button"
                      disabled={!canRun}
                      title={
                        apiReady
                          ? activePostId
                            ? tool.blurb
                            : `${tool.blurb} — select a draft first`
                          : `${tool.blurb}${tool.envHint ? ` — set ${tool.envHint}` : ""}`
                      }
                      onClick={() => {
                        if (!activePostId || !tool.creativeKind) return;
                        void generateCreative(
                          activePostId,
                          tool.creativeKind as CreativeKind,
                          tool.imageProvider
                        );
                      }}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${
                        apiReady
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400"
                          : "border-forward-800 bg-forward-950 text-forward-600"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {tool.label}
                      <span className="text-[9px] uppercase opacity-80">
                        {apiReady ? "API" : "off"}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(300px,360px)_1fr]">
        {/* Compose */}
        <div className="space-y-3 rounded-xl border border-forward-800 bg-forward-950/40 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-forward-500">Create</h3>

          <label className="block text-sm">
            <span className="mb-1 block text-forward-500">Brand</span>
            <select
              value={brandId}
              onChange={(e) => {
                const next = e.target.value;
                setBrandId(next);
                setBrief(BRAND_DEFAULT_BRIEFS[next] ?? brief);
              }}
              className="w-full rounded-lg border border-forward-700 bg-forward-950 px-3 py-2 text-forward-100"
            >
              {BRANDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1 block text-sm text-forward-500">Channels</span>
            <div className="flex flex-wrap gap-1.5">
              {ALL_CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => toggleChannel(ch.id)}
                  className={`rounded-lg border px-2.5 py-1 text-xs ${
                    selectedChannels.includes(ch.id)
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                      : "border-forward-700 text-forward-400"
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          <MarketingReferenceImage
            compact
            value={referenceImage}
            mode={referenceImageMode}
            onModeChange={setReferenceImageMode}
            onChange={setReferenceImage}
            onError={setReferenceImageError}
          />
          {referenceImageError && (
            <p className="text-xs text-amber-400">{referenceImageError}</p>
          )}

          <label className="block text-sm">
            <span className="mb-1 block text-forward-500">Brief</span>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-forward-700 bg-forward-950 px-3 py-2 text-forward-100"
            />
          </label>

          <div>
            <span className="mb-1 block text-sm text-forward-500">Image provider</span>
            <select
              value={imageProvider}
              onChange={(e) => setImageProvider(e.target.value)}
              className="w-full rounded-lg border border-forward-700 bg-forward-950 px-3 py-2 text-sm text-forward-100"
            >
              {imageProviders.length === 0 ? (
                <option value="auto">Auto</option>
              ) : (
                imageProviders.map((p) => (
                  <option key={p.id} value={p.id} disabled={!p.available}>
                    {p.label}
                    {!p.available ? " (not configured)" : ""}
                  </option>
                ))
              )}
            </select>
            {selectedProvider && (
              <p className="mt-1 text-[11px] text-forward-500">{selectedProvider.detail}</p>
            )}
          </div>

          <div className="rounded-lg border border-forward-800 bg-forward-950/60 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-forward-200">
              <input
                type="checkbox"
                checked={generateMedia}
                onChange={(e) => setGenerateMedia(e.target.checked)}
                className="rounded border-forward-600"
              />
              Include image with drafts
            </label>
            {generateMedia && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(
                  [
                    { id: "image" as const, label: "Image" },
                    { id: "animation" as const, label: "GIF" },
                    { id: "video_5" as const, label: "5s video" },
                    { id: "video_30" as const, label: "30s video" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMediaKind(opt.id)}
                    className={`rounded-lg border px-2 py-1 text-xs ${
                      mediaKind === opt.id
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                        : "border-forward-700 text-forward-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={generate}
            disabled={generating || isCreativeRunning || selectedChannels.length === 0}
            className="w-full"
          >
            <Sparkles size={14} className="mr-1.5" />
            {generating ? "Generating…" : "Generate drafts"}
          </Button>
        </div>

        {/* Drafts viewer */}
        <div
          ref={draftsRef}
          className="flex min-h-[480px] flex-col rounded-xl border border-forward-800 bg-forward-950/40 p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-forward-500">
              Drafts
            </h3>
            {posts.some((p) => p.status === "draft") && (
              <Button variant="secondary" onClick={clearAllDrafts} className="text-xs">
                <Trash2 size={14} className="mr-1" />
                Clear all
              </Button>
            )}
          </div>

          <div className="mb-4 flex flex-wrap gap-1 border-b border-forward-800 pb-2">
            {VIEW_TABS.map((tab) => {
              const count = postsForViewTab(posts, tab.id).filter((p) => p.status === "draft")
                .length;
              const isActive = activeViewTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveViewTab(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    isActive
                      ? "bg-emerald-500/15 font-medium text-emerald-200"
                      : "text-forward-400 hover:bg-forward-800 hover:text-forward-200"
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                        isActive ? "bg-emerald-500/25" : "bg-forward-800"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {creativeJob && (
            <div className="mb-3">
              <MarketingCreativeProgress
                kind={creativeJob.kind}
                channel={creativeJob.channel}
                startedAt={creativeJob.startedAt}
                phase={creativeJob.phase}
                resultMessage={creativeJob.message}
                onDismiss={creativeJob.phase !== "running" ? dismissCreativeJob : undefined}
              />
            </div>
          )}

          {message && !creativeJob && (
            <p className="mb-3 rounded-lg border border-forward-700 bg-forward-950 px-3 py-2 text-sm text-forward-300">
              {message}
            </p>
          )}

          {loading && posts.length === 0 ? (
            <p className="text-sm text-forward-500">Loading…</p>
          ) : !activePost ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center text-forward-500">
              <p className="text-sm">No {VIEW_TABS.find((t) => t.id === activeViewTab)?.label} drafts yet.</p>
              <p className="mt-1 text-xs">Select channels on the left and click Generate drafts.</p>
            </div>
          ) : (
            <article
              id={`marketing-post-${activePost.id}`}
              className={`flex flex-1 flex-col gap-4 ${
                creativeJob?.postId === activePost.id && creativeJob.phase === "running"
                  ? "rounded-lg ring-2 ring-cyan-500/30"
                  : ""
              }`}
            >
              {tabPosts.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  {tabPosts.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActivePostId(p.id)}
                      className={`rounded px-2 py-0.5 text-xs ${
                        p.id === activePost.id
                          ? "bg-forward-700 text-forward-100"
                          : "bg-forward-900 text-forward-500"
                      }`}
                    >
                      {formatDraftLabel(p.updatedAt)}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <DraftMediaPreview
                  post={activePost}
                  jobRunning={
                    creativeJob?.postId === activePost.id && creativeJob.phase === "running"
                  }
                />

                <div className="flex min-w-0 flex-col">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold capitalize text-white">{activePost.brand}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 ${
                        activePost.status === "published"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-forward-800 text-forward-400"
                      }`}
                    >
                      {activePost.status}
                    </span>
                  </div>

                  {activePost.metaTitle && (
                    <p className="mb-2 text-xs text-forward-500">SEO: {activePost.metaTitle}</p>
                  )}

                  {activePost.publishedUrl && (
                    <a
                      href={activePost.publishedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mb-2 inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                    >
                      <ExternalLink size={12} />
                      View live page
                    </a>
                  )}

                  {activePost.title && (
                    <p className="mb-2 text-sm font-semibold text-forward-100">{activePost.title}</p>
                  )}

                  <p className="flex-1 whitespace-pre-wrap text-sm leading-relaxed text-forward-200">
                    {activePost.body}
                  </p>

                  {activePost.hashtags.length > 0 && (
                    <p className="mt-3 text-xs text-emerald-400/90">
                      {activePost.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
                    </p>
                  )}
                </div>
              </div>

              {activePost.mediaPreviewUrl && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-forward-500">
                  {activePost.mediaUrl?.startsWith("http") && (
                    <a
                      href={activePost.mediaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:underline"
                    >
                      Public URL
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => downloadMedia(activePost)}
                    className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
                  >
                    <Download size={12} />
                    Download media
                  </button>
                </div>
              )}

              {activePost.narrationPreviewUrl &&
                !(creativeJob?.postId === activePost.id && creativeJob.phase === "running") && (
                  <div className="rounded-lg border border-forward-800 bg-forward-950/50 px-3 py-2">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-xs text-forward-500">AI voiceover</p>
                      <button
                        type="button"
                        onClick={() => downloadNarration(activePost)}
                        className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
                      >
                        <Download size={12} />
                        Download MP3
                      </button>
                    </div>
                    <audio controls src={activePost.narrationPreviewUrl} className="w-full" />
                  </div>
                )}

              {instagramPublishHint(activePost) && (
                <p className="text-xs text-cyan-300">{instagramPublishHint(activePost)}</p>
              )}

              {activePost.publishError &&
                !(creativeJob?.postId === activePost.id && creativeJob.phase === "running") && (
                  <p className="text-xs text-amber-400">
                    {formatMarketingPublishError(activePost.publishError)}{" "}
                    {publishNoteHelp(activePost, publisherStatus, activePost.brand)}
                  </p>
                )}

              {activePost.channel && activePost.kind === "social_post" && (
                <div className="mt-auto flex flex-wrap gap-2 border-t border-forward-800 pt-3">
                  <Button
                    variant="secondary"
                    onClick={() => generateCreative(activePost.id, "image")}
                    disabled={isCreativeRunning}
                    className="text-xs"
                  >
                    <Image size={14} className="mr-1" />
                    Image
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => generateCreative(activePost.id, "animation")}
                    disabled={isCreativeRunning}
                    className="text-xs"
                  >
                    <Film size={14} className="mr-1" />
                    GIF
                  </Button>
                  <Button
                    onClick={() => generateCreative(activePost.id, "video_5")}
                    disabled={isCreativeRunning}
                    className="text-xs"
                  >
                    <Video size={14} className="mr-1" />
                    5s video
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => generateCreative(activePost.id, "video_30")}
                    disabled={isCreativeRunning}
                    className="text-xs"
                  >
                    <Film size={14} className="mr-1" />
                    30s video
                  </Button>
                  <label className="flex items-center gap-1.5 text-[11px] text-forward-400">
                    Schedule
                    <input
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(e) => setScheduleAt(e.target.value)}
                      className="rounded border border-forward-700 bg-forward-950 px-1.5 py-1 text-forward-200"
                    />
                  </label>
                  <Button
                    variant="secondary"
                    onClick={() => shareManually(activePost)}
                    className="text-xs"
                  >
                    {sharedId === activePost.id ? (
                      <CheckCircle2 size={14} className="mr-1" />
                    ) : (
                      <ExternalLink size={14} className="mr-1" />
                    )}
                    Share
                  </Button>
                  {activePost.status !== "published" && (
                    <Button
                      variant="secondary"
                      onClick={() => publish(activePost.id)}
                      className="text-xs"
                    >
                      {copiedId === activePost.id ? (
                        <CheckCircle2 size={14} className="mr-1" />
                      ) : (
                        <Send size={14} className="mr-1" />
                      )}
                      Publish
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => navigator.clipboard.writeText(activePost.body)}
                    className="text-xs"
                  >
                    <Copy size={14} className="mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => deletePost(activePost.id)}
                    className="text-xs text-red-300 hover:text-red-200"
                  >
                    <Trash2 size={14} className="mr-1" />
                    Delete
                  </Button>
                </div>
              )}

              {activePost.kind !== "social_post" && (
                <div className="mt-auto flex flex-wrap gap-2 border-t border-forward-800 pt-3">
                  {activePost.channel === "google_search" && activePost.status !== "published" && (
                    <Button onClick={() => publish(activePost.id)} className="text-xs">
                      {copiedId === activePost.id ? (
                        <CheckCircle2 size={14} className="mr-1" />
                      ) : (
                        <Send size={14} className="mr-1" />
                      )}
                      Publish to site
                    </Button>
                  )}
                  {activePost.channel === "google_search" && activePost.status === "published" && (
                    <Button
                      variant="secondary"
                      onClick={() => publish(activePost.id)}
                      className="text-xs"
                    >
                      <Send size={14} className="mr-1" />
                      Update live page
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => navigator.clipboard.writeText(activePost.body)}
                    className="text-xs"
                  >
                    <Copy size={14} className="mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => deletePost(activePost.id)}
                    className="text-xs text-red-300 hover:text-red-200"
                  >
                    <Trash2 size={14} className="mr-1" />
                    Delete
                  </Button>
                </div>
              )}
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
