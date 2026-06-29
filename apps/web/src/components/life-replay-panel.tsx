"use client";



import { useState } from "react";

import { Check, Share2 } from "lucide-react";

import type { LifeReplayPayload } from "@forward/shared";

import { formatLifeReplayShareText } from "@/lib/life-replay-client";

import { cn } from "@/lib/utils";



const DOMAIN_LABEL: Record<string, string> = {

  career: "Career",

  money: "Money",

  health: "Health",

  learning: "Learning",

  relationships: "Relationships",

  mindset: "Mindset",

};



export function LifeReplayPanel({

  replay,

  userName,

}: {

  replay: LifeReplayPayload;

  userName?: string | null;

}) {

  const [copied, setCopied] = useState(false);



  async function shareReplay() {

    const text = formatLifeReplayShareText(replay, userName);



    if (typeof navigator !== "undefined" && navigator.share) {

      try {

        await navigator.share({ title: replay.headline, text });

        return;

      } catch {

        /* fall through to clipboard */

      }

    }



    await navigator.clipboard.writeText(text);

    setCopied(true);

    setTimeout(() => setCopied(false), 2000);

  }



  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border shadow-lg",
        replay.isYearEnd
          ? "border-brand-cyan/30 bg-gradient-to-br from-forward-950 via-indigo-950 to-forward-950 text-white animate-in fade-in duration-700"
          : "border-forward-200 bg-white"
      )}
    >
      {replay.isYearEnd && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-cyan/20 via-transparent to-transparent" />
          <div className="pointer-events-none absolute -left-20 top-10 h-40 w-40 rounded-full bg-brand-cyan/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 bottom-0 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
        </>
      )}
      <div className="relative px-6 py-7 sm:px-8">

        <div className="flex flex-wrap items-start justify-between gap-3">

          <div>

            <p

              className={cn(

                "text-xs font-semibold uppercase tracking-widest",

                replay.isYearEnd ? "text-brand-cyan" : "text-forward-400"

              )}

            >

              Life Replay

            </p>

            <h2
              className={cn(
                "mt-1 text-3xl font-bold",
                replay.isYearEnd ? "text-white animate-in fade-in slide-in-from-bottom-3 duration-500" : "text-forward-900"
              )}
            >

              {replay.headline}

            </h2>

            <p className={cn("mt-2 text-sm", replay.isYearEnd ? "text-forward-300" : "text-forward-600")}>

              {replay.subheadline}

            </p>

          </div>

          <button

            type="button"

            onClick={shareReplay}

            className={cn(

              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors",

              replay.isYearEnd

                ? "bg-white/10 text-white hover:bg-white/20"

                : "border border-forward-200 bg-forward-50 text-forward-700 hover:bg-forward-100"

            )}

          >

            {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}

            {copied ? "Copied!" : "Share card"}

          </button>

        </div>



        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">

          {[

            { label: "Life Moments", value: replay.stats.lifeMoments },

            { label: "Goals done", value: replay.stats.goalsCompleted },

            { label: "Tasks done", value: replay.stats.tasksCompleted },

            {

              label: "Score Δ",

              value: replay.stats.scoreDelta >= 0 ? `+${replay.stats.scoreDelta}` : replay.stats.scoreDelta,

            },

          ].map((stat, i) => (
            <div
              key={stat.label}
              className={cn(
                "rounded-xl px-3 py-3 text-center transition-all",
                replay.isYearEnd ? "bg-white/10 animate-in fade-in slide-in-from-bottom-2" : "bg-forward-50"
              )}
              style={replay.isYearEnd ? { animationDelay: `${i * 120}ms`, animationFillMode: "backwards" } : undefined}
            >

              <p

                className={cn(

                  "text-2xl font-bold tabular-nums",

                  replay.isYearEnd ? "text-white" : "text-forward-900"

                )}

              >

                {stat.value}

              </p>

              <p className={cn("text-[10px] uppercase tracking-wide", replay.isYearEnd ? "text-forward-400" : "text-forward-500")}>

                {stat.label}

              </p>

            </div>

          ))}

        </div>



        {replay.highlights.length > 0 && (

          <div className="mt-6">

            <p className={cn("text-xs font-semibold uppercase tracking-widest", replay.isYearEnd ? "text-forward-400" : "text-forward-500")}>

              Biggest wins

            </p>

            <ul className="mt-3 space-y-2">

              {replay.highlights.map((h) => (

                <li

                  key={h.id}

                  className={cn(

                    "flex items-center gap-3 rounded-xl px-4 py-3",

                    replay.isYearEnd ? "bg-white/5" : "border border-forward-100 bg-forward-50/80"

                  )}

                >

                  <span className="text-xl">{h.emoji}</span>

                  <div className="min-w-0 flex-1">

                    <p className={cn("truncate text-sm font-medium", replay.isYearEnd ? "text-white" : "text-forward-900")}>

                      {h.title}

                    </p>

                    <p className={cn("text-xs", replay.isYearEnd ? "text-forward-500" : "text-forward-400")}>

                      {new Date(h.occurredAt).toLocaleDateString(undefined, {

                        month: "short",

                        day: "numeric",

                      })}

                    </p>

                  </div>

                </li>

              ))}

            </ul>

          </div>

        )}



        <div className="mt-6">

          <p className={cn("text-xs font-semibold uppercase tracking-widest", replay.isYearEnd ? "text-forward-400" : "text-forward-500")}>

            Lessons learned

          </p>

          <ul className="mt-2 space-y-1.5">

            {replay.lessons.map((lesson, i) => (

              <li

                key={`${i}-${lesson.slice(0, 32)}`}

                className={cn("text-sm", replay.isYearEnd ? "text-forward-200" : "text-forward-700")}

              >

                · {lesson}

              </li>

            ))}

          </ul>

        </div>



        {replay.isYearEnd && (
          <p className="mt-4 text-center text-xs font-medium uppercase tracking-[0.25em] text-brand-cyan/90">
            ✦ Your year in motion ✦
          </p>
        )}

        <p className={cn("mt-5 text-xs", replay.isYearEnd ? "text-forward-500" : "text-forward-400")}>

          Strongest area this year: {DOMAIN_LABEL[replay.stats.topDomain] ?? replay.stats.topDomain}

        </p>

      </div>

    </section>

  );

}


