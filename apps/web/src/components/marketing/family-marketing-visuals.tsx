import {
  FAMILY_AI_CARD,
  FAMILY_COMPARISON_CORE,
  FAMILY_COMPARISON_FURTHER,
  FAMILY_DRIVE_DEMO,
  FAMILY_LIFE_IMPACT_DEMO,
  FAMILY_NORMAL_LIFE_DEMO,
  FAMILY_NOW_DEMO,
  FAMILY_OMG_CHANGE_DEMO,
  FAMILY_PLACE_DEMO,
  FAMILY_PRODUCT_NAME,
} from "@/lib/family-marketing";

/** Compact Family Map for homepage teaser — miniature of the hero composition. */
export function FamilyMapMiniVisual() {
  return (
    <div className="family-command-stage relative isolate overflow-hidden rounded-3xl border border-forward-200 bg-forward-950 shadow-lg">
      <div className="family-map-plane absolute inset-0 opacity-80" aria-hidden />
      <div className="family-map-grid absolute inset-0 opacity-30" aria-hidden />
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <span className="family-pin family-pin-a scale-75">A</span>
        <span className="family-pin family-pin-b scale-75">J</span>
        <span className="family-pin family-pin-c scale-75">S</span>
        <span className="family-pin family-pin-d scale-75">R</span>
      </div>
      <div className="relative z-10 space-y-3 p-4 sm:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-cyan">
          {FAMILY_NOW_DEMO.title}
        </p>
        <ul className="space-y-2">
          {FAMILY_NOW_DEMO.members.map((m) => (
            <li key={m.name} className="flex items-center gap-2 text-xs text-forward-100">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold">
                {m.pin}
              </span>
              <span>
                <span className="font-semibold text-white">{m.name}</span>
                <span className="text-forward-400"> {m.status}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="border-t border-white/10 pt-3 text-sm font-semibold text-white">
          {FAMILY_NOW_DEMO.everyoneHome}
        </p>
      </div>
    </div>
  );
}

/** Dominant Family Map hero — sells intelligence, not a tracker grid. */
export function FamilyMapHeroVisual() {
  return (
    <div className="family-command-stage relative isolate overflow-hidden rounded-none border-y border-white/10 bg-forward-950 sm:rounded-3xl sm:border">
      <div className="family-map-plane absolute inset-0" aria-hidden />
      <div className="family-map-grid absolute inset-0 opacity-40" aria-hidden />

      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <span className="family-pin family-pin-a">A</span>
        <span className="family-pin family-pin-b">J</span>
        <span className="family-pin family-pin-c">S</span>
        <span className="family-pin family-pin-d">R</span>
        <span className="family-route-pulse" />
      </div>

      <div className="relative z-10 grid gap-4 p-4 sm:gap-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
        <div className="family-intel-panel landing-fade-up space-y-4 rounded-2xl border border-white/10 bg-forward-950/80 p-5 backdrop-blur-md sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-cyan">
            {FAMILY_NOW_DEMO.title}
          </p>
          <ul className="space-y-3">
            {FAMILY_NOW_DEMO.members.map((m) => (
              <li key={m.name} className="flex items-start gap-3 text-sm text-forward-100">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white">
                  {m.pin}
                </span>
                <span>
                  <span className="font-semibold text-white">{m.name}</span>
                  <span className="text-forward-300"> {m.status}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-white/10 pt-4 font-display text-lg font-semibold text-white sm:text-xl">
            {FAMILY_NOW_DEMO.everyoneHome}
          </p>
        </div>

        <div className="family-intel-panel landing-fade-up landing-fade-up-delay-1 space-y-3 rounded-2xl border border-brand-orange/35 bg-brand-orange/10 p-5 backdrop-blur-md sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-orange">
            {FAMILY_AI_CARD.title}
          </p>
          <p className="text-sm leading-relaxed text-forward-100 sm:text-base">{FAMILY_AI_CARD.body}</p>
          <p className="text-xs text-forward-300">{FAMILY_AI_CARD.meta}</p>
          <p className="text-xs font-medium text-brand-cyan">{FAMILY_AI_CARD.tone}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {FAMILY_AI_CARD.actions.map((action) => (
              <span
                key={action}
                className="inline-flex rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white"
              >
                {action}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FamilyPlaceIntelVisual() {
  const d = FAMILY_PLACE_DEMO;
  return (
    <div className="overflow-hidden rounded-3xl border border-forward-200 bg-white shadow-sm">
      <div className="border-b border-forward-100 bg-forward-50 px-5 py-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">
          Place Intelligence™
        </p>
        <h3 className="mt-1 font-display text-2xl font-semibold text-forward-900">{d.name}</h3>
        <p className="mt-1 text-sm text-forward-600">{d.visits}</p>
      </div>
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-3 sm:px-6">
        <Stat label="Average visit" value={d.avgVisit} />
        <Stat label="Usually visits" value={d.usual} />
        <Stat label="Most frequent" value={d.visitor} />
      </div>
      <div className="border-t border-forward-100 px-5 py-4 sm:px-6">
        <p className="text-sm font-medium text-forward-800">
          Currently: <span className="text-brand-blue">{d.current}</span>
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-forward-200 bg-forward-50 px-4 py-3">
          <p className="text-sm text-forward-700">
            {d.listCount} items on your household list — send them to {d.visitor}?
          </p>
          <span className="inline-flex rounded-lg bg-forward-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white">
            Send list
          </span>
        </div>
      </div>
    </div>
  );
}

export function FamilyDriveIntelVisual() {
  const d = FAMILY_DRIVE_DEMO;
  return (
    <div className="overflow-hidden rounded-3xl border border-forward-200 bg-forward-950 text-white shadow-sm">
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-cyan">
          Drive Intelligence™
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="font-display text-2xl font-semibold">{d.name}</h3>
            <p className="mt-1 text-sm text-forward-300">{d.duration}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-5xl font-semibold tabular-nums text-brand-green">
              {d.score}
              <span className="text-2xl text-forward-400"> / 100</span>
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-brand-green">
              {d.band}
            </p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <StatDark label="Max speed" value={d.maxSpeed} />
          <StatDark label="Hard braking" value={String(d.hardBraking)} />
          <StatDark label="Rapid accel" value={String(d.rapidAccel)} />
        </div>
        <p className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-forward-200">
          {d.ai}
        </p>
      </div>
    </div>
  );
}

export function FamilyNormalLifeVisual() {
  const d = FAMILY_NORMAL_LIFE_DEMO;
  return (
    <div className="rounded-3xl border border-forward-200 bg-white p-5 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">
        Normal Life Model™
      </p>
      <h3 className="mt-2 font-display text-2xl font-semibold text-forward-900 sm:text-3xl">
        {d.headline}
      </h3>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <RoutineColumn title={d.normalTitle} rows={d.normal} muted />
        <RoutineColumn title={d.todayTitle} rows={d.today} />
      </div>
      <p className="mt-8 font-display text-xl font-semibold text-brand-orange sm:text-2xl">
        {d.punch}
      </p>
    </div>
  );
}

export function FamilyLifeImpactVisual() {
  const d = FAMILY_LIFE_IMPACT_DEMO;
  return (
    <div className="rounded-3xl border border-white/10 bg-forward-900/60 p-5 text-white sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-cyan">
        Connected to your Digital Twin™
      </p>
      <h3 className="mt-2 max-w-2xl font-display text-2xl font-semibold sm:text-3xl">
        {d.headline}
      </h3>
      <div className="mt-8 flex flex-wrap items-center gap-2 text-sm">
        {d.chain.map((item, i) => (
          <div key={item} className="flex items-center gap-2">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-medium">
              {item}
            </span>
            {i < d.chain.length - 1 ? (
              <span className="text-forward-500" aria-hidden>
                ↓
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm font-medium text-forward-300">{d.since}</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {d.deltas.map((line) => (
          <li key={line} className="text-sm text-forward-100">
            {line}
          </li>
        ))}
      </ul>
      <p className="mt-6 font-display text-lg font-semibold text-brand-orange">{d.momentum}</p>
    </div>
  );
}

/** Big “OH MY GOD” change example — peace of mind + Life Impact. */
export function FamilyOmgChangeVisual() {
  const d = FAMILY_OMG_CHANGE_DEMO;
  return (
    <div className="overflow-hidden rounded-3xl border border-brand-orange/35 bg-gradient-to-br from-forward-950 via-forward-900 to-forward-950 p-5 text-white shadow-xl sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-orange">{d.eyebrow}</p>
      <h3 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {d.headline}
      </h3>
      <p className="mt-4 text-sm font-medium text-forward-300">{d.over}</p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {d.deltas.map((row) => (
          <li
            key={row.label}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <p className="text-xs uppercase tracking-wide text-forward-400">{row.label}</p>
            <p className="mt-1 font-display text-xl font-semibold tabular-nums text-white">
              {row.value}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-6 max-w-2xl text-base leading-relaxed text-forward-200">{d.insight}</p>
      <p className="mt-4 font-display text-xl font-semibold text-brand-orange sm:text-2xl">
        {d.momentum}
      </p>
      <p className="mt-6 text-sm font-semibold text-brand-cyan">{d.cta}</p>
    </div>
  );
}

export function FamilyComparisonVisual() {
  return (
    <div className="overflow-hidden rounded-3xl border border-forward-200 bg-white shadow-sm">
      <div className="grid grid-cols-[1.2fr_1fr_1.2fr] border-b border-forward-200 bg-forward-50 text-xs font-semibold uppercase tracking-wide sm:text-sm">
        <div className="px-3 py-4 text-forward-500 sm:px-5">Capability</div>
        <div className="border-l border-forward-200 px-3 py-4 text-forward-500 sm:px-5">
          Typical location apps
        </div>
        <div className="border-l border-forward-200 bg-brand-blue/5 px-3 py-4 text-brand-blue sm:px-5">
          {FAMILY_PRODUCT_NAME}™
        </div>
      </div>

      <ul>
        {FAMILY_COMPARISON_CORE.map((row) => (
          <ComparisonRow key={row.label} {...row} />
        ))}
      </ul>

      <div className="border-y border-forward-200 bg-forward-950 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-brand-cyan sm:text-sm">
        And then MyMotiveFamily goes further
      </div>

      <ul>
        {FAMILY_COMPARISON_FURTHER.map((row) => (
          <ComparisonRow key={row.label} {...row} emphasizeOurs />
        ))}
      </ul>
    </div>
  );
}

function ComparisonRow({
  label,
  typical,
  ours,
  emphasizeOurs,
}: {
  label: string;
  typical: string;
  ours: string;
  emphasizeOurs?: boolean;
}) {
  return (
    <li className="grid grid-cols-[1.2fr_1fr_1.2fr] border-b border-forward-100 text-sm last:border-b-0">
      <div className="px-3 py-3.5 font-medium text-forward-800 sm:px-5">{label}</div>
      <div className="border-l border-forward-100 px-3 py-3.5 text-forward-500 sm:px-5">
        {typical}
      </div>
      <div
        className={`border-l border-forward-100 px-3 py-3.5 sm:px-5 ${
          emphasizeOurs
            ? "bg-brand-blue/[0.04] font-semibold text-forward-900"
            : "bg-brand-blue/[0.02] text-forward-800"
        }`}
      >
        {ours}
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-forward-500">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-forward-900">{value}</p>
    </div>
  );
}

function StatDark({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-forward-400">{label}</p>
      <p className="mt-1 font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function RoutineColumn({
  title,
  rows,
  muted,
}: {
  title: string;
  rows: ReadonlyArray<{ place: string; time: string; highlight?: boolean }>;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 ${
        muted ? "border-forward-200 bg-forward-50" : "border-brand-orange/30 bg-brand-orange/5"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-forward-500">{title}</p>
      <ul className="mt-3 space-y-2.5">
        {rows.map((row) => (
          <li
            key={`${title}-${row.place}-${row.time}`}
            className={`flex items-center justify-between text-sm ${
              row.highlight ? "font-semibold text-brand-orange" : "text-forward-800"
            }`}
          >
            <span>{row.place}</span>
            <span className="tabular-nums text-forward-600">{row.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
