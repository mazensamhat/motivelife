"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/button";
import { Megaphone, Sparkles, Send, Copy, CheckCircle2, Image, Film, Video, Trash2, ExternalLink, Download } from "lucide-react";
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
import { MarketingGoogleAiAssist } from "@/components/admin/marketing-google-ai-assist";

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
  mediaType: string | null;
  mediaUrl: string | null;
  mediaPreviewUrl: string | null;
  narrationPreviewUrl: string | null;
  hasSourceScreenshot?: boolean;
  createdAt: string;
  updatedAt: string;
};

type PublisherStatus = Record<string, boolean>;

type CreativeJob = {
  postId: string;
  kind: CreativeKind;
  channel: string | null;
  startedAt: number;
  phase: CreativeJobPhase;
  message?: string;
};

const BRANDS = [
  { id: "motivelife", label: "MotiveLife" },
  { id: "motivefx", label: "MotiveFX" },
  { id: "motiveiq", label: "MotiveIQ" },
] as const;

const CHANNELS = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
  { id: "google_search", label: "SEO" },
  { id: "google_ads", label: "Google Ads" },
] as const;

function instagramPublishHint(post: MarketingPost): string | null {
  if (post.channel !== "instagram" || !post.mediaPreviewUrl) return null;
  if (post.mediaType === "gif") {
    return "Instagram auto-publish needs MP4 — click 5s video (not Animation), wait for “narrated MP4 ready”, then Publish.";
  }
  if (post.mediaType === "video" && post.narrationPreviewUrl) {
    return "Voiceover is separate from the video — mux may have failed. Regenerate with 5s video until preview says MP4 video and voiceover is baked in.";
  }
  return null;
}

function publishNoteHelp(post: MarketingPost, publisherStatus: PublisherStatus): string {
  const channel = post.channel ?? "";
  const err = post.publishError?.toLowerCase() ?? "";
  if (err.includes("session has expired") || err.includes("error validating access token")) {
    return "Update MARKETING_META_ACCESS_TOKEN in Vercel (Page token expired).";
  }
  if (channel && !publisherStatus[channel]) {
    return `Use Copy to post manually until ${channel} API keys are set in Vercel.`;
  }
  if (err.includes("gif") || err.includes("mp4 for reels")) {
    return "Regenerate as 5s video or 30s video for narrated MP4 auto-publish.";
  }
  return "Use Copy for caption, or fix the issue above and click Publish again.";
}

export function MarketingAgentPanel() {
  const [posts, setPosts] = useState<MarketingPost[]>([]);
  const [publisherStatus, setPublisherStatus] = useState<PublisherStatus>({});
  const [brandId, setBrandId] = useState("motivelife");
  const [brief, setBrief] = useState(
    "Launch post: MotiveLife helps you turn voice and thoughts into daily actions — 14-day free trial."
  );
  const [selectedChannels, setSelectedChannels] = useState<string[]>([
    "linkedin",
    "instagram",
    "facebook",
    "tiktok",
    "google_search",
  ]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [creativeJob, setCreativeJob] = useState<CreativeJob | null>(null);
  const [generateMedia, setGenerateMedia] = useState(false);
  const [mediaKind, setMediaKind] = useState<CreativeKind>("image");
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
      };
      setPosts(data.posts);
      setPublisherStatus(data.publisherStatus);
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
    if (referenceImage) return;

    async function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        try {
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Could not read image."));
            reader.readAsDataURL(file);
          });
          const base64 = dataUrl.split(",")[1];
          if (!base64) throw new Error("Could not read image.");
          if (file.size > 3 * 1024 * 1024) throw new Error("Image must be under 3 MB.");
          setReferenceImage({
            previewUrl: dataUrl,
            base64,
            mimeType: file.type,
            name: "Pasted screenshot",
          });
          setReferenceImageError("");
        } catch (err) {
          setReferenceImageError(err instanceof Error ? err.message : "Could not add image.");
        }
        break;
      }
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [referenceImage]);

  useEffect(() => {
    if (!creativeJob || creativeJob.phase !== "running") return;
    document
      .getElementById(`marketing-post-${creativeJob.postId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [creativeJob?.postId, creativeJob?.phase]);

  function toggleChannel(id: string) {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
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
      setMessage(
        data.mediaWarning
          ? `Generated ${data.posts?.length ?? 0} draft(s). Media note: ${data.mediaWarning}`
          : `Generated ${data.posts?.length ?? 0} draft(s). Review before publishing.`
      );
      await load();
    } catch (e) {
      setMessage(fetchMarketingErrorMessage(e, "generate"));
    } finally {
      setGenerating(false);
    }
  }

  async function publish(id: string) {
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/marketing/posts/${id}/publish`, { method: "POST" });
      const { data, text } = await readApiResponse<{
        ok?: boolean;
        error?: string;
        manualText?: string;
        mode?: string;
      }>(res);

      if (!data) {
        throw new Error(formatApiError(res, text, data));
      }

      if (data.ok) {
        setMessage("Published via API.");
      } else if (data.manualText) {
        await navigator.clipboard.writeText(data.manualText);
        setCopiedId(id);
        setMessage(
          formatMarketingPublishError(data.error) ??
            "API not configured — copied post to clipboard. Paste manually."
        );
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        setMessage(formatMarketingPublishError(data.error) ?? "Publish failed");
      }
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Publish failed");
    }
  }

  async function generateCreative(id: string, kind: CreativeKind) {
    const post = posts.find((p) => p.id === id);
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
        body: JSON.stringify({ kind }),
      });
      const { data, text } = await readApiResponse<{
        error?: string;
        post?: MarketingPost;
        previewUrl?: string;
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
          ? "Image ready — preview below."
          : kind === "animation"
            ? "5s animation ready — preview below."
            : kind === "video_5"
              ? "5s narrated MP4 ready — preview below. Voice is baked in."
              : "30s narrated MP4 ready — preview below. Voice is baked in.");

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
      setMessage("Could not copy caption or open share page. Allow pop-ups for this site.");
    }
  }

  async function deletePost(id: string) {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
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
    if (!window.confirm(`Delete all ${draftCount} draft(s)? This cannot be undone.`)) return;
    setMessage(null);
    const res = await fetch("/api/admin/marketing/drafts", { method: "DELETE" });
    const data = (await res.json()) as { error?: string; deleted?: number };
    if (!res.ok) {
      setMessage(data.error ?? "Could not delete drafts.");
      return;
    }
    setMessage(`Deleted ${data.deleted ?? 0} draft(s).`);
    await load();
  }

  return (
    <section className="mb-6 rounded-xl border border-forward-800 bg-forward-900/60 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Megaphone size={18} className="text-emerald-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-forward-400">
          Marketing Agent
        </h2>
        <span className="text-xs text-forward-600">MotiveLife · MotiveFX · MotiveIQ</span>
      </div>

      <p className="mb-4 text-sm text-forward-400">
        AI drafts social posts with web-researched hashtags (Serper) and signup-focused copy.
        <strong className="text-cyan-300"> Paste an app screenshot</strong> (Step 1 below), write your
        brief, then generate. Use <strong>Publish</strong> for API auto-post or <strong>Share</strong> for
        manual posting.
      </p>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {Object.entries(publisherStatus).map(([ch, ok]) => (
          <span
            key={ch}
            className={`rounded-full px-2 py-0.5 ${
              ok ? "bg-emerald-500/15 text-emerald-300" : "bg-forward-800 text-forward-500"
            }`}
          >
            {ch}: {ok ? "ready" : ch === "hashtagResearch" ? (ok ? "on" : "off") : "manual"}
          </span>
        ))}
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-forward-500">Brand</span>
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
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
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => toggleChannel(ch.id)}
                className={`rounded-lg border px-2 py-1 text-xs ${
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
      </div>

      <MarketingReferenceImage
        value={referenceImage}
        mode={referenceImageMode}
        onModeChange={setReferenceImageMode}
        onChange={setReferenceImage}
        onError={setReferenceImageError}
      />
      {referenceImageError && (
        <p className="-mt-2 mb-4 text-xs text-amber-400">{referenceImageError}</p>
      )}

      <MarketingGoogleAiAssist />

      <label className="mb-4 block text-sm">
        <span className="mb-1 block text-forward-500">
          <span className="mr-2 rounded-full bg-forward-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-forward-400">
            Step 2
          </span>
          Brief (what should we promote?)
        </span>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-forward-700 bg-forward-950 px-3 py-2 text-forward-100"
        />
      </label>

      <div className="mb-4 rounded-lg border border-forward-800 bg-forward-950/50 p-3 text-sm">
        <label className="flex cursor-pointer items-center gap-2 text-forward-200">
          <input
            type="checkbox"
            checked={generateMedia}
            onChange={(e) => setGenerateMedia(e.target.checked)}
            className="rounded border-forward-600"
          />
          Generate image or video with drafts
        </label>
        {generateMedia && (
          <div className="mt-2 flex flex-wrap gap-2 pl-6">
            {(
              [
                { id: "image" as const, label: "Image" },
                { id: "animation" as const, label: "5s animation (GIF)" },
                { id: "video_5" as const, label: "5s video + voice" },
                { id: "video_30" as const, label: "30s animation + voice" },
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
        <p className="mt-2 text-xs text-forward-500">
          Images: <code className="text-forward-400">GOOGLE_AI_API_KEY</code> (Gemini, recommended) or{" "}
          <code className="text-forward-400">OPENAI_API_KEY</code>. Or use Google AI Browser assist above.
          Narrated MP4s need <code className="text-forward-400">REPLICATE_API_TOKEN</code> + OpenAI for voice.
        </p>
      </div>

      <Button onClick={generate} disabled={generating || isCreativeRunning || selectedChannels.length === 0}>
        <Sparkles size={14} className="mr-1.5" />
        {generating ? "Generating…" : "Generate drafts"}
      </Button>

      {message && !creativeJob && (
        <p className="mt-3 rounded-lg border border-forward-700 bg-forward-950 px-3 py-2 text-sm text-forward-300">
          {message}
        </p>
      )}

      {creativeJob && (
        <div className="sticky top-2 z-20 mt-3">
          <MarketingCreativeProgress
            kind={creativeJob.kind}
            channel={creativeJob.channel}
            startedAt={creativeJob.startedAt}
            phase={creativeJob.phase}
            resultMessage={creativeJob.message}
            sticky
            onDismiss={creativeJob.phase !== "running" ? dismissCreativeJob : undefined}
          />
        </div>
      )}

      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-forward-500">
            Drafts & history
          </h3>
          {posts.some((p) => p.status === "draft") && (
            <Button variant="secondary" onClick={clearAllDrafts} className="text-xs">
              <Trash2 size={14} className="mr-1" />
              Clear all drafts
            </Button>
          )}
        </div>
        {loading && posts.length === 0 ? (
          <p className="text-sm text-forward-500">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-forward-500">No posts yet — generate your first campaign.</p>
        ) : (
          posts.map((post) => {
            const isThisJob = creativeJob?.postId === post.id;
            const jobRunning = isThisJob && creativeJob?.phase === "running";
            return (
            <article
              key={post.id}
              id={`marketing-post-${post.id}`}
              className={`rounded-lg border bg-forward-950/80 p-4 ${
                jobRunning
                  ? "border-cyan-500/50 ring-2 ring-cyan-500/25"
                  : isThisJob && (creativeJob?.phase === "success" || creativeJob?.phase === "warning")
                    ? creativeJob.phase === "success"
                      ? "border-emerald-500/40 ring-1 ring-emerald-500/20"
                      : "border-amber-500/40 ring-1 ring-amber-500/20"
                    : "border-forward-800"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-white">{post.brand}</span>
                <span className="text-forward-500">{post.channel ?? post.kind}</span>
                <span
                  className={`rounded px-1.5 py-0.5 ${
                    post.status === "published"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-forward-800 text-forward-400"
                  }`}
                >
                  {post.status}
                </span>
              </div>
              {post.metaTitle && (
                <p className="mb-1 text-xs text-forward-500">SEO: {post.metaTitle}</p>
              )}
              <p className="whitespace-pre-wrap text-sm text-forward-200">{post.body.slice(0, 500)}</p>
              {post.hashtags.length > 0 && (
                <p className="mt-2 text-xs text-emerald-400/90">
                  {post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
                </p>
              )}

              {isThisJob && creativeJob && (
                <MarketingCreativeProgress
                  kind={creativeJob.kind}
                  channel={creativeJob.channel}
                  startedAt={creativeJob.startedAt}
                  phase={creativeJob.phase}
                  resultMessage={creativeJob.message}
                  onDismiss={creativeJob.phase !== "running" ? dismissCreativeJob : undefined}
                />
              )}

              {jobRunning && post.mediaPreviewUrl && (
                <p className="mt-2 text-xs text-forward-500">
                  Previous preview hidden while new creative generates…
                </p>
              )}

              {!jobRunning && post.mediaPreviewUrl && post.channel && (
                <div className="mt-3 overflow-hidden rounded-lg border border-forward-800 bg-black/40">
                  {post.mediaType === "video" ? (
                    <video
                      key={post.mediaPreviewUrl}
                      src={post.mediaPreviewUrl}
                      controls
                      playsInline
                      className="max-h-80 w-full object-contain"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={post.mediaPreviewUrl}
                      src={post.mediaPreviewUrl}
                      alt="Post creative"
                      className="max-h-80 w-full object-contain"
                    />
                  )}
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1 text-xs text-forward-500">
                    <span>
                      {post.mediaType === "video"
                        ? "MP4 video"
                        : post.mediaType === "gif"
                          ? "Animation (GIF)"
                          : post.mediaType ?? "image"}
                      {post.hasSourceScreenshot ? " · from screenshot" : ""}
                    </span>
                    {post.mediaUrl?.startsWith("http") && (
                      <>
                        <span>·</span>
                        <a
                          href={post.mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:underline"
                        >
                          Public URL
                        </a>
                      </>
                    )}
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => downloadMedia(post)}
                      className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
                    >
                      <Download size={12} />
                      Download
                    </button>
                  </p>
                </div>
              )}
              {post.narrationPreviewUrl && !jobRunning && (
                <div className="mt-2 rounded-lg border border-forward-800 bg-forward-950/50 px-3 py-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-xs text-forward-500">AI voiceover</p>
                    <button
                      type="button"
                      onClick={() => downloadNarration(post)}
                      className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
                    >
                      <Download size={12} />
                      Download MP3
                    </button>
                  </div>
                  <audio controls src={post.narrationPreviewUrl} className="w-full" />
                </div>
              )}
              {instagramPublishHint(post) && (
                <p className="mt-2 text-xs text-cyan-300">{instagramPublishHint(post)}</p>
              )}
              {post.publishError && !jobRunning && (
                <p className="mt-2 text-xs text-amber-400">
                  Publish note: {formatMarketingPublishError(post.publishError)} {publishNoteHelp(post, publisherStatus)}
                </p>
              )}
              {!post.mediaPreviewUrl && !jobRunning && post.channel && post.kind === "social_post" && (
                <p className="mt-2 text-xs text-forward-500">
                  No creative yet — click <strong>Image</strong> to{" "}
                  {post.hasSourceScreenshot ? "re-imagine your screenshot" : "generate art"},{" "}
                  <strong>Animation</strong>, <strong>5s video</strong>, or <strong>30s video</strong>{" "}
                  below.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {post.channel && post.kind === "social_post" && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => generateCreative(post.id, "image")}
                      disabled={isCreativeRunning}
                      className="text-xs"
                    >
                      <Image size={14} className="mr-1" />
                      {isThisJob && creativeJob?.kind === "image" && jobRunning
                        ? "Image…"
                        : "Image"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => generateCreative(post.id, "animation")}
                      disabled={isCreativeRunning}
                      className="text-xs"
                    >
                      <Film size={14} className="mr-1" />
                      {isThisJob && creativeJob?.kind === "animation" && jobRunning
                        ? "Anim…"
                        : "Animation"}
                    </Button>
                    <Button
                      onClick={() => generateCreative(post.id, "video_5")}
                      disabled={isCreativeRunning}
                      className="text-xs"
                    >
                      <Video size={14} className="mr-1" />
                      {isThisJob && creativeJob?.kind === "video_5" && jobRunning
                        ? "5s…"
                        : "5s video"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => generateCreative(post.id, "video_30")}
                      disabled={isCreativeRunning}
                      className="text-xs"
                    >
                      <Film size={14} className="mr-1" />
                      {isThisJob && creativeJob?.kind === "video_30" && jobRunning
                        ? "30s…"
                        : "30s video"}
                    </Button>
                  </>
                )}
                {post.channel && post.kind === "social_post" && (
                  <Button
                    variant="secondary"
                    onClick={() => shareManually(post)}
                    className="text-xs"
                    title={`Copy caption and open ${post.channel} to post manually`}
                  >
                    {sharedId === post.id ? (
                      <CheckCircle2 size={14} className="mr-1" />
                    ) : (
                      <ExternalLink size={14} className="mr-1" />
                    )}
                    {sharedId === post.id ? "Opened" : "Share"}
                  </Button>
                )}
                {post.channel && post.status !== "published" && (
                  <Button variant="secondary" onClick={() => publish(post.id)} className="text-xs">
                    {copiedId === post.id ? (
                      <CheckCircle2 size={14} className="mr-1" />
                    ) : (
                      <Send size={14} className="mr-1" />
                    )}
                    Publish
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => navigator.clipboard.writeText(post.body)}
                  className="text-xs"
                >
                  <Copy size={14} className="mr-1" />
                  Copy
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => deletePost(post.id)}
                  className="text-xs text-red-300 hover:text-red-200"
                >
                  <Trash2 size={14} className="mr-1" />
                  Delete
                </Button>
              </div>
            </article>
            );
          })
        )}
      </div>
    </section>
  );
}
