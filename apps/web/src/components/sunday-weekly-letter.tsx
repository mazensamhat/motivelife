"use client";



import { useEffect, useState } from "react";

import { Check, Copy, Share2 } from "lucide-react";

import { Button } from "./button";

import { readApiError, readApiJson } from "@/lib/fetch-api";

import { formatWeeklyLetterShareMessage } from "@/lib/accountability-partner";

import type { AccountabilityPartner, VoiceWeeklyRecap, WeekProgressStats } from "@forward/shared";

import { WeekProgressStrip } from "./week-progress-strip";

import { PremiumGate } from "./premium-gate";



interface ReviewData {

  summary: string | null;

  letterParagraphs: string[];

  tasksCompleted: number;

  wins: string[];

  focusAreas: string[];

  goalsSummary: string | null;

  weekStats?: WeekProgressStats;
  voiceRecap?: VoiceWeeklyRecap | null;
  aiGenerated?: boolean;
}



export function SundayWeeklyLetter() {

  const [review, setReview] = useState<ReviewData | null>(null);
  const [voiceRecap, setVoiceRecap] = useState<VoiceWeeklyRecap | null>(null);

  const [partner, setPartner] = useState<AccountabilityPartner | null>(null);

  const [userName, setUserName] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [copied, setCopied] = useState(false);

  const [shared, setShared] = useState(false);



  async function load(refresh = false) {

    setLoading(true);

    setError("");

    try {

      const [reviewRes, userRes] = await Promise.all([

        fetch(`/api/weekly-review${refresh ? "?refresh=true" : ""}`),

        fetch("/api/user"),

      ]);

      const data = await readApiJson<{
        review?: ReviewData;
        voiceRecap?: VoiceWeeklyRecap | null;
        accountabilityPartner?: AccountabilityPartner | null;
      }>(reviewRes);

      const userData = await readApiJson<{ user?: { name?: string | null } }>(userRes);

      if (!reviewRes.ok || !data?.review) {

        setError(await readApiError(reviewRes));

        return;

      }

      setReview(data.review);
      setVoiceRecap(data.voiceRecap ?? data.review?.voiceRecap ?? null);

      setPartner(data.accountabilityPartner ?? null);

      setUserName(userData?.user?.name ?? null);

    } catch {

      setError("Could not load your weekly letter.");

    } finally {

      setLoading(false);

    }

  }



  useEffect(() => {

    load();

  }, []);



  if (loading) {

    return <div className="h-40 animate-pulse rounded-2xl bg-forward-100" />;

  }



  if (error) {

    return (

      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">

        {error}

        <Button variant="ghost" size="sm" className="mt-2" onClick={() => load(true)}>

          Try again

        </Button>

      </div>

    );

  }



  if (!review) return null;



  const paragraphs =

    review.letterParagraphs?.length > 0

      ? review.letterParagraphs

      : review.summary

        ? review.summary.split("\n\n").filter(Boolean)

        : [];



  const letterText = [

    "Sunday Weekly Letter — motivelife.ai",

    "",

    ...paragraphs,

    "",

    review.focusAreas.length > 0

      ? `Next week's mission:\n${review.focusAreas.map((f, i) => `${i + 1}. ${f}`).join("\n")}`

      : "",

  ]

    .filter(Boolean)

    .join("\n");



  async function copyLetter() {

    await navigator.clipboard.writeText(letterText);

    setCopied(true);

    setTimeout(() => setCopied(false), 2000);

  }



  async function shareWithPartner() {

    if (!partner?.name) return;

    const text = formatWeeklyLetterShareMessage(partner.name, userName, review!.wins, review!.focusAreas);

    if (typeof navigator !== "undefined" && navigator.share) {

      try {

        await navigator.share({ text });

        return;

      } catch {

        /* clipboard fallback */

      }

    }

    await navigator.clipboard.writeText(text);

    setShared(true);

    setTimeout(() => setShared(false), 2000);

  }



  return (

    <PremiumGate feature="Sunday weekly letters">

      <section className="overflow-hidden rounded-2xl border border-forward-200 bg-[#faf8f5] shadow-lg">

        <div className="border-b border-forward-200/80 bg-white/60 px-6 py-4">

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forward-500">

            Sunday Weekly Letter

          </p>

          <p className="mt-1 text-sm text-forward-600">
            Your week in review — written for you.
            {review.aiGenerated && (
              <span className="ml-2 rounded-full bg-brand-purple/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-purple">
                AI-personalized
              </span>
            )}
          </p>

          {review.weekStats && (

            <div className="mt-3">

              <WeekProgressStrip stats={review.weekStats} />

            </div>

          )}

        </div>



        <div className="px-6 py-8 sm:px-10 sm:py-10">

          <div className="mx-auto max-w-prose space-y-4 font-serif text-forward-800">

            {paragraphs.map((para, i) => {

              const isSignOff = para.startsWith("—");

              const isHowever = para === "However…";

              const isGreeting = i === 0 && para.endsWith("…");



              if (isSignOff) {

                return (

                  <p key={i} className="pt-4 text-right text-sm italic text-forward-500">

                    {para}

                  </p>

                );

              }



              if (isHowever) {

                return (

                  <p key={i} className="pt-2 text-lg font-medium text-forward-900">

                    {para}

                  </p>

                );

              }



              return (

                <p

                  key={i}

                  className={

                    isGreeting

                      ? "text-2xl font-medium text-forward-900"

                      : "text-base leading-relaxed sm:text-lg"

                  }

                >

                  {para}

                </p>

              );

            })}

          </div>

          {voiceRecap && voiceRecap.paragraphs.length > 0 && (
            <div className="mx-auto mt-8 max-w-prose rounded-xl border border-brand-purple/20 bg-brand-purple/5 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-purple">
                Your voice this week
              </p>
              <div className="mt-2 space-y-2">
                {voiceRecap.paragraphs.map((p) => (
                  <p key={p} className="text-sm leading-relaxed text-forward-700">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          )}

          {review.focusAreas.length > 0 && (

            <div className="mx-auto mt-8 max-w-prose rounded-xl border border-forward-200 bg-white/80 px-5 py-4">

              <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">

                Next week&apos;s mission

              </p>

              <ol className="mt-2 space-y-1.5">

                {review.focusAreas.map((f, i) => (

                  <li key={i} className="text-sm font-medium text-forward-800">

                    {i + 1}. {f}

                  </li>

                ))}

              </ol>

            </div>

          )}



          <div className="mx-auto mt-6 flex max-w-prose flex-wrap justify-end gap-2">

            <Button variant="ghost" size="sm" onClick={copyLetter} className="gap-1.5">

              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}

              {copied ? "Copied!" : "Copy letter"}

            </Button>

            {partner?.name && (

              <Button variant="ghost" size="sm" onClick={shareWithPartner} className="gap-1.5">

                <Share2 className="h-3.5 w-3.5" />

                {shared ? "Sent!" : `Share with ${partner.name}`}

              </Button>

            )}

            <a

              href={`mailto:?subject=${encodeURIComponent("My Sunday Weekly Letter — motivelife.ai")}&body=${encodeURIComponent(letterText)}`}

              className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-forward-600 hover:bg-forward-100 hover:text-forward-900"

            >

              Email to myself

            </a>

            <Button variant="ghost" size="sm" onClick={() => load(true)}>

              Regenerate letter

            </Button>

          </div>

        </div>

      </section>

    </PremiumGate>

  );

}


