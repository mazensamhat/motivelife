"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/button";
import { Megaphone, Sparkles, Send, Copy, CheckCircle2, Image, Film, Mic, Trash2 } from "lucide-react";

type CreativeKind = "image" | "video_5" | "video_30";

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
  createdAt: string;
  updatedAt: string;
};

type PublisherStatus = Record<string, boolean>;

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
  const [generatingCreativeId, setGeneratingCreativeId] = useState<string | null>(null);
  const [generatingCreativeKind, setGeneratingCreativeKind] = useState<CreativeKind | null>(null);
  const [generateMedia, setGenerateMedia] = useState(false);
  const [mediaKind, setMediaKind] = useState<CreativeKind>("image");
  const [message, setMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
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
      setMessage("Could not load marketing agent.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
        }),
      });
      const data = (await res.json()) as { error?: string; posts?: MarketingPost[] };
      if (!res.ok) throw new Error(data.error ?? "Generate failed");
      setMessage(`Generated ${data.posts?.length ?? 0} draft(s). Review before publishing.`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setGenerating(false);
    }
  }

  async function publish(id: string) {
    setMessage(null);
    const res = await fetch(`/api/admin/marketing/posts/${id}/publish`, { method: "POST" });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      manualText?: string;
      mode?: string;
    };
    if (data.ok) {
      setMessage("Published via API.");
    } else if (data.manualText) {
      await navigator.clipboard.writeText(data.manualText);
      setCopiedId(id);
      setMessage(data.error ?? "API not configured — copied post to clipboard. Paste manually.");
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      setMessage(data.error ?? "Publish failed");
    }
    await load();
  }

  async function generateCreative(id: string, kind: CreativeKind) {
    setGeneratingCreativeId(id);
    setGeneratingCreativeKind(kind);
    const waitHint =
      kind === "image"
        ? "Generating image… up to 60 seconds."
        : kind === "video_5"
          ? "Generating 5s narrated video… up to 2 minutes."
          : "Generating 30s narrated video… up to 3 minutes.";
    setMessage(waitHint);
    try {
      const res = await fetch(`/api/admin/marketing/posts/${id}/creative`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = (await res.json()) as {
        error?: string;
        post?: MarketingPost;
        previewUrl?: string;
        fallbackNote?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Creative generation failed");

      if (data.post) {
        setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data.post! } : p)));
      }

      setMessage(
        data.fallbackNote ??
          (kind === "image"
            ? "Image ready — preview below."
            : `${kind === "video_5" ? "5s" : "30s"} narrated video ready — press play to hear the voiceover.`)
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Creative generation failed");
    } finally {
      setGeneratingCreativeId(null);
      setGeneratingCreativeKind(null);
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
        Generate images or narrated videos (5s / 30s with AI voice). Auto-post when API keys are set —
        see <code className="text-forward-300">docs/AUTO_POST_SETUP.md</code>.
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

      <label className="mb-4 block text-sm">
        <span className="mb-1 block text-forward-500">Brief (what should we promote?)</span>
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
                { id: "video_5" as const, label: "5s video + voice" },
                { id: "video_30" as const, label: "30s video + voice" },
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
          Videos use OpenAI voiceover + app-branded visuals. Large MP4s need{" "}
          <code className="text-forward-400">BLOB_READ_WRITE_TOKEN</code> in Vercel.
        </p>
      </div>

      <Button onClick={generate} disabled={generating || selectedChannels.length === 0}>
        <Sparkles size={14} className="mr-1.5" />
        {generating ? "Generating…" : "Generate drafts"}
      </Button>

      {message && (
        <p className="mt-3 rounded-lg border border-forward-700 bg-forward-950 px-3 py-2 text-sm text-forward-300">
          {message}
        </p>
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
        {loading ? (
          <p className="text-sm text-forward-500">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-forward-500">No posts yet — generate your first campaign.</p>
        ) : (
          posts.map((post) => (
            <article
              key={post.id}
              className="rounded-lg border border-forward-800 bg-forward-950/80 p-4"
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
              {post.mediaPreviewUrl && post.channel && (
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
                  <p className="px-2 py-1 text-xs text-forward-500">
                    {post.mediaType === "video" ? "Narrated video" : post.mediaType ?? "image"}
                    {post.mediaUrl?.startsWith("http") && (
                      <>
                        {" · "}
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
                  </p>
                </div>
              )}
              {post.narrationPreviewUrl && (
                <div className="mt-2 rounded-lg border border-forward-800 bg-forward-950/50 px-3 py-2">
                  <p className="mb-1 text-xs text-forward-500">AI voiceover</p>
                  <audio controls src={post.narrationPreviewUrl} className="w-full" />
                </div>
              )}
              {post.publishError && (
                <p className="mt-2 text-xs text-amber-400">
                  Publish note: {post.publishError} Use <strong>Copy</strong> to post manually until
                  Meta/LinkedIn keys are in Vercel.
                </p>
              )}
              {generatingCreativeId === post.id && (
                <p className="mt-2 text-xs text-cyan-300">
                  Creating{" "}
                  {generatingCreativeKind === "video_30"
                    ? "30s narrated video"
                    : generatingCreativeKind === "video_5"
                      ? "5s narrated video"
                      : "image"}
                  … please wait.
                </p>
              )}
              {!post.mediaPreviewUrl && post.channel && post.kind === "social_post" && (
                <p className="mt-2 text-xs text-forward-500">
                  No creative yet — click <strong>Image</strong>, <strong>5s video</strong>, or{" "}
                  <strong>30s video</strong> below.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {post.channel && post.kind === "social_post" && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => generateCreative(post.id, "image")}
                      disabled={generatingCreativeId === post.id}
                      className="text-xs"
                    >
                      <Image size={14} className="mr-1" />
                      {generatingCreativeId === post.id && generatingCreativeKind === "image"
                        ? "Image…"
                        : "Image"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => generateCreative(post.id, "video_5")}
                      disabled={generatingCreativeId === post.id}
                      className="text-xs"
                    >
                      <Mic size={14} className="mr-1" />
                      {generatingCreativeId === post.id && generatingCreativeKind === "video_5"
                        ? "5s…"
                        : "5s video"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => generateCreative(post.id, "video_30")}
                      disabled={generatingCreativeId === post.id}
                      className="text-xs"
                    >
                      <Film size={14} className="mr-1" />
                      {generatingCreativeId === post.id && generatingCreativeKind === "video_30"
                        ? "30s…"
                        : "30s video"}
                    </Button>
                  </>
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
          ))
        )}
      </div>
    </section>
  );
}
