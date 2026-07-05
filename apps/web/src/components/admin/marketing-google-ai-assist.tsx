"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

type GeminiConsoleStatus = {
  configured: boolean;
  geminiApi?: boolean;
  ok?: boolean;
  tierLabel?: string;
  imageModel?: string;
  detail?: string;
};

export function MarketingGoogleAiAssist() {
  const [status, setStatus] = useState<GeminiConsoleStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [workerRes, platformsRes] = await Promise.all([
        fetch("/api/admin/marketing/gemini-worker"),
        fetch("/api/admin/platforms"),
      ]);
      const worker = workerRes.ok ? await workerRes.json() : null;
      const platforms = platformsRes.ok ? await platformsRes.json() : null;
      const googleAi = platforms?.platforms?.find(
        (p: { id: string }) => p.id === "google-ai"
      );

      setStatus({
        configured: Boolean(worker?.geminiApi || googleAi),
        geminiApi: Boolean(worker?.geminiApi ?? googleAi?.checklist?.[0]?.ok),
        ok: Boolean(worker?.ok ?? googleAi?.status === "healthy"),
        tierLabel: worker?.tierLabel ?? googleAi?.metrics?.find((m: { label: string }) => m.label === "Tier")?.value,
        imageModel: worker?.imageModel ?? googleAi?.metrics?.find((m: { label: string }) => m.label === "Image model")?.value,
        detail: worker?.detail ?? googleAi?.summary,
      });
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const automatic = status?.geminiApi && status?.ok;

  return (
    <div className="mb-4 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-200">
        <Sparkles size={16} />
        Google Gemini — automatic images
      </div>

      {loading && !status ? (
        <p className="flex items-center gap-2 text-xs text-forward-400">
          <Loader2 size={14} className="animate-spin" />
          Checking Gemini API…
        </p>
      ) : status?.geminiApi ? (
        <div className="space-y-1 text-xs">
          <p className={automatic ? "text-emerald-300/90" : "text-amber-300/90"}>
            {automatic ? "✓" : "○"} {status.detail ?? "Gemini API configured"}
          </p>
          {status.tierLabel && (
            <p className="text-forward-400">
              Tier: <span className="text-forward-200">{status.tierLabel}</span>
              {status.imageModel ? (
                <>
                  {" "}
                  · Model: <span className="text-forward-200">{status.imageModel}</span>
                </>
              ) : null}
            </p>
          )}
          <p className="text-forward-500">
            Paste screenshot in Step 1, click <strong className="text-forward-300">Image</strong> — uploads
            automatically. Set <code className="text-forward-400">GOOGLE_AI_TIER</code> in Vercel if you
            upgrade to pay-as-you-go.
          </p>
        </div>
      ) : (
        <p className="text-xs text-forward-400">
          Add <code className="text-forward-300">GOOGLE_AI_API_KEY</code> in Vercel (free tier at{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-cyan hover:underline"
          >
            AI Studio
          </a>
          ) for one-click image generation.
        </p>
      )}
    </div>
  );
}
