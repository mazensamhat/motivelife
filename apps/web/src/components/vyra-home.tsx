"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { AiCoachPrompt, LifeGpsPayload } from "@forward/shared";
import { AiCoachChip } from "@/components/ai-coach-chip";
import { TalkToCoachPanel } from "@/components/voice-coach-panels";
import { Button } from "@/components/button";
import { ProductSuiteIcon } from "@/components/product-icons";
import { PRODUCT_SUITE } from "@/lib/product-suite";
import { readApiError, readApiJson } from "@/lib/fetch-api";
import { ResponsivePage } from "@/components/responsive-page";
import { cn } from "@/lib/utils";

type Turn = { role: "user" | "vyra"; text: string };

type VyraAskResponse = {
  answer: string;
  specialists: Array<{ id: string; label: string; href: string; note: string }>;
};

export function VyraHome() {
  const brand = PRODUCT_SUITE.vyra;
  const [coach, setCoach] = useState<AiCoachPrompt | null>(null);
  const [gps, setGps] = useState<LifeGpsPayload | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Turn[]>([
    {
      role: "vyra",
      text: "I’m VYRA — your Chief of Staff. Ask a life question. I’ll consult UPLIFT, Kashu, DayO, and KINZO instead of inventing a second goals or money app.",
    },
  ]);
  const [specialists, setSpecialists] = useState<VyraAskResponse["specialists"]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/life-os", { cache: "no-store" });
        const data = await readApiJson<{ aiCoach: AiCoachPrompt; lifeGps: LifeGpsPayload }>(res);
        if (data) {
          setCoach(data.aiCoach);
          setGps(data.lifeGps);
        }
      } catch {
        /* peek is optional */
      }
    })();
  }, []);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    setDraft("");
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    try {
      const data = await fetch("/api/vyra/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-10),
        }),
      });
      const json = await readApiJson<VyraAskResponse>(data);
      if (!data.ok || !json) throw new Error(await readApiError(data));
      setMessages((m) => [...m, { role: "vyra", text: json.answer }]);
      setSpecialists(json.specialists ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "VYRA could not answer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsivePage width="module" className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-start gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: `color-mix(in srgb, ${brand.primary} 18%, white)` }}
        >
          <ProductSuiteIcon id="vyra" className="h-8 w-8" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: brand.primaryDark }}>
            Chief of Staff
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight" style={{ color: brand.primaryDark }}>
            VYRA
          </h1>
          <p className="mt-1 max-w-xl text-sm text-forward-600">
            Life intelligence. UPLIFT owns goals. Kashu owns money. VYRA asks them, then synthesizes.
          </p>
          {gps?.destination ? (
            <p className="mt-2 text-xs text-forward-500">
              Consulting UPLIFT destination:{" "}
              <Link href="/goals" className="font-medium text-forward-800 underline-offset-2 hover:underline">
                {gps.destination}
              </Link>
            </p>
          ) : null}
        </div>
      </header>

      {coach ? <AiCoachChip coach={coach} /> : null}

      <div className="space-y-4 rounded-2xl border border-violet-200 bg-white p-4 md:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-forward-900">
          <MessageCircle className="h-5 w-5 text-violet-700" />
          Talk it through
        </h2>
        <div className="max-h-[22rem] space-y-3 overflow-y-auto rounded-xl border border-forward-100 bg-violet-50/40 p-3">
          {messages.map((msg, i) => (
            <div
              key={`${msg.role}-${i}`}
              className={cn(
                "max-w-[95%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                msg.role === "user"
                  ? "ml-auto bg-violet-700 text-white"
                  : "bg-white text-forward-800 ring-1 ring-violet-100"
              )}
            >
              {msg.text}
            </div>
          ))}
        </div>
        {specialists.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {specialists.map((s) => (
              <Link
                key={s.id}
                href={s.href}
                className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-900 ring-1 ring-violet-200"
                title={s.note}
              >
                Open {s.label}
              </Link>
            ))}
          </div>
        ) : null}
        <form
          className="space-y-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <textarea
            className="min-h-[4.5rem] w-full rounded-xl border border-forward-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-600/30"
            placeholder="Should I take this job? Pay Dad today or Friday? Is the vacation goal realistic?"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
          />
          <div className="flex flex-wrap gap-2">
            {[
              "Should I take this job?",
              "Can my cash flow support my goal?",
              "What should I do next today?",
            ].map((q) => (
              <button
                key={q}
                type="button"
                className="rounded-full bg-forward-50 px-3 py-1 text-xs text-forward-700 ring-1 ring-forward-200"
                onClick={() => setDraft(q)}
              >
                {q}
              </button>
            ))}
          </div>
          <Button type="submit" disabled={busy || !draft.trim()}>
            {busy ? "Consulting…" : "Ask VYRA"}
          </Button>
        </form>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <TalkToCoachPanel />
    </ResponsivePage>
  );
}
