"use client";

import { useMemo, useState } from "react";
import { Copy, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/button";
import { GEMINI_APP_URL } from "@/lib/google-ai-config";

const BRAND_LABELS: Record<string, string> = {
  motivelife: "MotiveLife",
  motivefx: "MotiveFX",
  motiveiq: "MotiveIQ",
};

export function MarketingGoogleAiAssist({
  brandId,
  brief,
  hasScreenshot,
}: {
  brandId: string;
  brief: string;
  hasScreenshot: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(() => {
    const brand = BRAND_LABELS[brandId] ?? brandId;
    const screenshotLine = hasScreenshot
      ? "Use the attached app screenshot as reference — reimagine it as a premium social ad (same feature, cinematic brand look, cyan-to-green gradient accents, dark navy background)."
      : "Create a premium social marketing image for a mobile app.";
    return `${screenshotLine}

Brand: ${brand}
Brief: ${brief.trim() || "Launch post for our AI life coach app."}

Style: dark premium UI, rounded cards, MotiveLife cyan (#00c6ff) to green (#00ff87) gradient, no watermarks, no fake stock people unless needed.
Format: square 1:1 social post (or vertical 9:16 if I ask for Stories).

Output: one polished marketing image ready for Instagram/LinkedIn.`;
  }, [brandId, brief, hasScreenshot]);

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mb-4 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-200">
        <Sparkles size={16} />
        Google AI — no API key needed
      </div>
      <p className="mb-3 text-xs text-forward-400">
        Like MotiveIQ: open Gemini in your browser (logged into Google), paste this prompt
        {hasScreenshot ? " + your screenshot" : ""}, download the image, then paste it back in Step 1
        above. Slower than API, but free with your Google account.
      </p>
      <pre className="mb-3 max-h-32 overflow-auto rounded-lg bg-forward-950/80 p-3 text-[11px] leading-relaxed text-forward-300">
        {prompt}
      </pre>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={copyPrompt} className="text-xs">
          <Copy size={14} className="mr-1" />
          {copied ? "Copied!" : "Copy prompt"}
        </Button>
        <a
          href={GEMINI_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-forward-600 bg-forward-950 px-3 py-2 text-xs font-semibold text-forward-100 hover:border-cyan-500/50"
        >
          <ExternalLink size={14} className="mr-1" />
          Open Gemini
        </a>
      </div>
      <p className="mt-2 text-[11px] text-forward-500">
        For automatic images in Ops Console, add{" "}
        <code className="text-forward-400">GOOGLE_AI_API_KEY</code> in Vercel (free tier at{" "}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-cyan hover:underline"
        >
          AI Studio
        </a>
        ).
      </p>
    </div>
  );
}
