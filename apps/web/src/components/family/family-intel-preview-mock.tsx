"use client";

import { useEffect, useState } from "react";

type Scene = "calm" | "drive" | "leave";

/**
 * Static visual mock — proposed Family Brief vs today’s card farm.
 * Public preview for founder review (no live data).
 */
export function FamilyIntelPreviewMock() {
  const [scene, setScene] = useState<Scene>("drive");
  const [openMore, setOpenMore] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 40);
    return () => window.clearTimeout(t);
  }, []);

  const brief =
    scene === "calm"
      ? {
          headline: "Everyone’s settled",
          line: "Home is quiet · kids still at the parks earlier today",
          accent: null as string | null,
          flow: "Home by 7–8",
          leave: "Nothing soon",
          different: "All normal",
        }
      : scene === "leave"
        ? {
            headline: "Leave by 3:40 for Hamoudi Work",
            line: "Traffic buffer on · ~18 min drive",
            accent: "Leave soon",
            flow: "Zeinab out",
            leave: "3:40 PM",
            different: "All normal",
          }
        : {
            headline: "Zeinab is driving home",
            line: "ETA 4 min · Updated Now · 58 km/h",
            accent: "On the move",
            flow: "1 driving",
            leave: "Nothing soon",
            different: "All normal",
          };

  return (
    <div className="min-h-dvh bg-[#eef3f8] text-forward-900">
      <div
        className="pointer-events-none fixed inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,198,255,0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 20%, rgba(0,255,135,0.08), transparent 50%), linear-gradient(180deg, #dfe8f3 0%, #eef3f8 40%, #f7f9fc 100%)",
        }}
      />

      <main className="relative mx-auto max-w-lg px-4 pb-16 pt-8 sm:max-w-2xl sm:pt-10">
        <header
          className={`transition-all duration-700 ${
            ready ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-forward-500">
            Preview mock · not live data
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-forward-950 sm:text-4xl">
            Family Brief
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-forward-600">
            Proposed visuals under the map — one calm composition instead of eight equal
            KPI boxes. Toggle a household moment, then compare with today’s layout.
          </p>
        </header>

        <div
          className={`mt-6 flex flex-wrap gap-2 transition-all delay-100 duration-700 ${
            ready ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          {(
            [
              ["drive", "Driving home"],
              ["leave", "Leave-by soon"],
              ["calm", "Quiet evening"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setScene(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                scene === id
                  ? "bg-forward-900 text-white"
                  : "bg-white/70 text-forward-700 ring-1 ring-forward-200/80 hover:bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Fake map chrome for context */}
        <div
          className={`mt-6 overflow-hidden rounded-2xl transition-all delay-150 duration-700 ${
            ready ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <div
            className="relative h-44 sm:h-52"
            style={{
              background:
                "linear-gradient(145deg, #c5d4e4 0%, #b7c9db 35%, #a8bdd2 70%, #9eb6ce 100%)",
            }}
          >
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(10,25,48,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(10,25,48,0.06) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />
            <div className="absolute left-3 right-3 top-3 flex items-center justify-between rounded-xl bg-white/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
              <span className="font-semibold text-forward-900">
                {scene === "drive" ? "Zeinab Samhat" : "Family Map"}
              </span>
              <span className="text-forward-500">
                {scene === "drive" ? "Last updated Now · 58 km/h" : "Live"}
              </span>
            </div>
            <div
              className={`absolute left-1/2 top-[58%] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-bold text-white shadow-lg transition-transform duration-500 ${
                ready ? "scale-100" : "scale-75"
              }`}
              style={{
                background:
                  scene === "drive"
                    ? "linear-gradient(135deg, #00c6ff, #0072ff)"
                    : "linear-gradient(135deg, #00c6ff, #00ff87)",
              }}
            >
              {scene === "drive" ? "Z" : "M"}
            </div>
            <p className="absolute bottom-3 left-3 text-[10px] font-medium text-forward-700/70">
              Map stays the hero · brief lives below
            </p>
          </div>
        </div>

        {/* PROPOSED */}
        <section
          className={`mt-4 transition-all delay-200 duration-700 ${
            ready ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
          }`}
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Proposed · Family Brief
          </p>

          <div className="relative overflow-hidden rounded-[1.35rem] bg-white/85 px-5 py-5 shadow-[0_12px_40px_-24px_rgba(10,25,48,0.35)] ring-1 ring-white/80 backdrop-blur-sm">
            <div
              className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full opacity-50"
              style={{
                background:
                  scene === "leave"
                    ? "radial-gradient(circle, rgba(255,140,0,0.22), transparent 70%)"
                    : "radial-gradient(circle, rgba(0,198,255,0.2), transparent 70%)",
              }}
            />

            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forward-400">
                    KINZO AI
                  </p>
                  <h2
                    key={brief.headline}
                    className="mt-1 font-display text-[1.65rem] font-semibold leading-[1.15] tracking-tight text-forward-950 transition-opacity duration-500"
                  >
                    {brief.headline}
                  </h2>
                  <p
                    key={brief.line}
                    className="mt-2 max-w-md text-sm leading-relaxed text-forward-600 transition-opacity duration-500"
                  >
                    {brief.line}
                  </p>
                </div>
                {brief.accent ? (
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${
                      scene === "leave"
                        ? "bg-orange-50 text-orange-700 ring-1 ring-orange-200/80"
                        : "bg-sky-50 text-sky-800 ring-1 ring-sky-200/80"
                    }`}
                  >
                    {brief.accent}
                  </span>
                ) : null}
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-forward-100/90 pt-4">
                <QuietMetric label="Flow" value={brief.flow} />
                <QuietMetric
                  label="Leave by"
                  value={brief.leave}
                  emphasize={scene === "leave"}
                />
                <QuietMetric label="Different" value={brief.different} muted />
              </div>

              <button
                type="button"
                onClick={() => setOpenMore((v) => !v)}
                className="mt-4 text-xs font-semibold text-forward-500 underline-offset-2 hover:text-forward-800 hover:underline"
              >
                {openMore ? "Hide more" : "Places · Drive · Fuel · Family time"}
              </button>

              {openMore ? (
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-forward-50 pt-3 text-sm">
                  <MiniRow k="Places" v="Home · Mi'kmaq Park" />
                  <MiniRow k="Drive" v="82 · last trip" />
                  <MiniRow k="Fuel" v="$12.40 this month" />
                  <MiniRow k="Family time" v="11h home" />
                </div>
              ) : null}
            </div>
          </div>

          {/* Quieter weekly strip */}
          <div className="mt-3 px-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forward-400">
                Weekly driving
              </p>
              <p className="text-xs text-forward-500">3 drives · 42 km</p>
            </div>
            <p className="mt-1 text-sm text-forward-700">
              Avg score <span className="font-semibold text-forward-900">84</span>
              <span className="text-forward-400"> · </span>
              Hard brakes down vs last week
            </p>
          </div>
        </section>

        {/* TODAY */}
        <section
          className={`mt-10 transition-all delay-300 duration-700 ${
            ready ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
          }`}
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-forward-400">
            Today · card farm (for contrast)
          </p>
          <div className="rounded-2xl border border-forward-200 bg-white p-4 opacity-80">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-base font-semibold">Family Intelligence</h3>
                <p className="mt-0.5 text-xs text-forward-500">
                  Live map plus what the household’s movement is teaching us…
                </p>
              </div>
              <span className="text-brand-blue">◈</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {["Drive 72", "Fuel $3", "Visits 24", "Shopping —"].map((t) => (
                <div
                  key={t}
                  className="rounded-lg border border-forward-100 bg-forward-50 px-2.5 py-2 text-xs font-semibold"
                >
                  {t}
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                "Flow",
                "Different",
                "Places",
                "Driving",
                "Fuel",
                "Shopping",
                "Leave by",
                "Family time",
              ].map((t) => (
                <div
                  key={t}
                  className="rounded-xl border border-forward-100 bg-forward-50/60 px-3 py-2.5"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-forward-500">
                    {t}
                  </p>
                  <p className="mt-1 text-sm font-semibold">…</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <p className="mt-8 text-center text-xs leading-relaxed text-forward-500">
          Web-only mock · no EAS · swap scenes above to feel the brief.
          <br />
          Full write-up: docs/FAMILY_INTELLIGENCE_UX_EXPERT_BRIEF.md
        </p>
      </main>
    </div>
  );
}

function QuietMetric({
  label,
  value,
  emphasize,
  muted,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-forward-400">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-[0.95rem] font-semibold leading-snug ${
          emphasize
            ? "text-orange-700"
            : muted
              ? "text-forward-500"
              : "text-forward-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function MiniRow({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-forward-400">
        {k}
      </p>
      <p className="mt-0.5 text-forward-800">{v}</p>
    </div>
  );
}
