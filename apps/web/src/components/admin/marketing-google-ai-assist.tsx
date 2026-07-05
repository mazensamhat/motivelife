"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

type Status = {
  geminiApi?: boolean;
  ok?: boolean;
  tierLabel?: string;
  imageModel?: string;
  detail?: string;
  freeAi?: {
    pollinations?: string;
    cloudflare?: string;
    puter?: string;
    imageMode?: string;
  };
};

export function MarketingGoogleAiAssist() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const platformsRes = await fetch("/api/admin/platforms");
      if (!platformsRes.ok) return;
      const platforms = await platformsRes.json();
      const googleAi = platforms?.platforms?.find((p: { id: string }) => p.id === "google-ai");
      const freeAi = platforms?.platforms?.find((p: { id: string }) => p.id === "free-ai");

      const metric = (card: { metrics?: Array<{ label: string; value: string }> } | undefined, label: string) =>
        card?.metrics?.find((m) => m.label === label)?.value;

      setStatus({
        geminiApi: googleAi?.checklist?.[0]?.ok,
        ok: googleAi?.status === "healthy" || freeAi?.status === "healthy",
        tierLabel: metric(googleAi, "Tier"),
        imageModel: metric(googleAi, "Image model"),
        detail: googleAi?.summary,
        freeAi: freeAi
          ? {
              pollinations: metric(freeAi, "Pollinations"),
              cloudflare: metric(freeAi, "Cloudflare"),
              puter: metric(freeAi, "Puter"),
              imageMode: metric(freeAi, "Image mode"),
            }
          : undefined,
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

  return (
    <div className="mb-4 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-200">
        <Sparkles size={16} />
        Image generation backends
      </div>

      {loading && !status ? (
        <p className="flex items-center gap-2 text-xs text-forward-400">
          <Loader2 size={14} className="animate-spin" />
          Checking providers…
        </p>
      ) : (
        <div className="space-y-2 text-xs text-forward-400">
          {status?.geminiApi && (
            <p className={status.ok ? "text-emerald-300/90" : "text-amber-300/90"}>
              Gemini: {status.detail ?? "configured"}
              {status.tierLabel ? ` · ${status.tierLabel}` : ""}
            </p>
          )}
          {status?.freeAi && (
            <p className="text-forward-300">
              Free: Pollinations ({status.freeAi.pollinations ?? "on"}) · Cloudflare (
              {status.freeAi.cloudflare ?? "off"}) · Puter ({status.freeAi.puter ?? "off"})
            </p>
          )}
          <p>
            Paste screenshot → click <strong className="text-forward-200">Image</strong>. Set{" "}
            <code className="text-forward-400">MARKETING_IMAGE_PROVIDER</code> to{" "}
            <code className="text-forward-400">pollinations</code>,{" "}
            <code className="text-forward-400">cloudflare</code>, or{" "}
            <code className="text-forward-400">puter</code> to force a free backend.
          </p>
        </div>
      )}
    </div>
  );
}
