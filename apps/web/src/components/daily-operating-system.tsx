"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "./button";
import { Card } from "./card";
import { ActionableModuleCards } from "./actionable-module-cards";
import { AiCoachChip } from "./ai-coach-chip";
import { ChiefStaffHero } from "./chief-staff-hero";
import { LifeFeedPanel } from "./life-feed-panel";
import { LifeFocusOnboarding } from "./life-focus-onboarding";
import { LifeForecastPanel } from "./life-forecast-panel";
import { LifeGpsPanel } from "./life-gps-panel";
import { LifeNoticesPanel } from "./life-notices-panel";
import { LifePredictsPanel } from "./life-predicts-panel";
import { LifeTimelinePanel } from "./life-timeline-panel";
import { LifeScoreRings } from "./life-score-rings";
import { LifeXpPanel } from "./life-xp-panel";
import { CoachingLoopBanner } from "./coaching-loop-banner";
import { TrialBanner } from "./trial-banner";
import { LifeCirclePanel } from "./life-circle-panel";
import { WeekProgressStrip } from "./week-progress-strip";
import { TodayImprovePanel } from "./today-improve-panel";
import { PremiumGate } from "./premium-gate";
import { BeliefsSnapshot } from "./beliefs-snapshot";
import { LifeContextBanner } from "./life-context-banner";
import { LifeEnginePanel } from "./life-engine-panel";
import { LifeGraphSnippet } from "./life-graph-snippet";
import { LifeIntelligencePanel } from "./life-intelligence-panel";
import { LifeReplayPanel } from "./life-replay-panel";
import { RetirementGapPanel } from "./retirement-gap-panel";
import { SundayWeeklyLetter } from "./sunday-weekly-letter";
import { TodaysMissionPanel } from "./todays-mission-panel";
import { MorningReflectionPanel, isMorningHours } from "./morning-reflection-panel";
import { NightReflectionPanel, isEveningHours } from "./night-reflection-panel";
import { VoicePracticePanel } from "./voice-practice-panel";
import { EveningReviewPanel } from "./evening-review-panel";
import { DashboardTour } from "./dashboard-tour";
import { DailyExperience } from "./daily-experience";
import { clientLogout } from "@/lib/auth-client";
import type {
  AiCoachPrompt,
  DomainScoreMap,
  LifeBelief,
  LifeContextState,
  LifeEngineAction,
  LifeEngineStreakPayload,
  LifeFeedItem,
  LifeForecastItem,
  LifeGraphPayload,
  LifeGpsPayload,
  LifeIntelligencePayload,
  LifeModuleId,
  LifePredictItem,
  LifePreference,
  LifeReplayPayload,
  LifeTimelineEntry,
  LifeXpPayload,
  CoachingLoopPayload,
  LifeCircleMemberPayload,
  PartnerActivityPayload,
  TodayImprovePayload,
  WeekProgressStats,
  MissionItem,
  ModuleCardPayload,
  MorningOperatingPayload,
  ScoreChangeReason,
} from "@forward/shared";
import type { RetirementGapPayload } from "@/lib/retirement-gap";
import type { AccountabilityPartner } from "@forward/shared";
import { readApiError, readApiJson } from "@/lib/fetch-api";

interface LifeOsData {
  needsLifeFocus: boolean;
  needsDashboardTour?: boolean;
  userAvatarUrl?: string | null;
  userName?: string | null;
  morning: MorningOperatingPayload;
  domainScores: DomainScoreMap;
  scoreReasons: ScoreChangeReason[];
  missionItems: MissionItem[];
  moduleCards: ModuleCardPayload[];
  lifeGps: LifeGpsPayload;
  timeline: LifeTimelineEntry[];
  forecast: LifeForecastItem[];
  feed: LifeFeedItem[];
  predicts: LifePredictItem[];
  aiCoach: AiCoachPrompt;
  lifeGraph?: LifeGraphPayload;
  lifeIntelligence?: LifeIntelligencePayload;
  activeContext?: LifeContextState | null;
  beliefs?: LifeBelief[];
  preferences?: LifePreference | null;
  lifeEngine?: LifeEngineAction;
  lifeEngineStreak?: LifeEngineStreakPayload;
  lifeReplay?: LifeReplayPayload | null;
  retirementGap?: RetirementGapPayload | null;
  accountabilityPartner?: AccountabilityPartner | null;
  partnerActivity?: PartnerActivityPayload | null;
  lifeCircle?: LifeCircleMemberPayload[];
  lifeXp?: LifeXpPayload;
  coachingLoops?: CoachingLoopPayload[];
  todayImprove?: TodayImprovePayload | null;
  weekStats?: WeekProgressStats;
  hiddenModules?: LifeModuleId[];
  promotedModules?: LifeModuleId[];
}

function isSunday() {
  return new Date().getDay() === 0;
}

function DashboardSection({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  if (defaultOpen) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-forward-800">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-forward-500">{description}</p> : null}
        </div>
        {children}
      </section>
    );
  }

  return (
    <details className="group rounded-xl border border-forward-200 bg-white">
      <summary className="cursor-pointer list-none px-5 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-forward-800">{title}</p>
            {description ? <p className="mt-0.5 text-xs text-forward-500">{description}</p> : null}
          </div>
          <span className="text-forward-400 transition group-open:rotate-180">▾</span>
        </div>
      </summary>
      <div className="space-y-4 border-t border-forward-100 px-5 py-4">{children}</div>
    </details>
  );
}

export function DailyOperatingSystem() {
  const [data, setData] = useState<LifeOsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandLifeGps, setExpandLifeGps] = useState(false);
  const [showTour, setShowTour] = useState(false);

  async function load(refresh = false) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/life-os${refresh ? "?refresh=true" : ""}`);
      if (res.status === 401) {
        await clientLogout();
        return;
      }
      const json = await readApiJson<LifeOsData>(res);
      if (!res.ok || !json) {
        setError(await readApiError(res));
        return;
      }
      setData(json);
      if (json.needsDashboardTour) setShowTour(true);
    } catch {
      setError("Could not load your day. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (typeof window !== "undefined" && window.location.hash === "#life-gps") {
      setExpandLifeGps(true);
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-56 animate-pulse rounded-2xl bg-forward-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-forward-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-forward-100" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-sm text-red-600">{error}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => load(true)}>
            Try again
          </Button>
          <Button variant="ghost" size="sm" onClick={() => clientLogout()}>
            Sign out
          </Button>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const userName = data.userName;

  if (data.needsLifeFocus) {
    return <LifeFocusOnboarding onComplete={() => load()} />;
  }

  const {
    morning,
    domainScores,
    scoreReasons,
    missionItems,
    moduleCards,
    lifeGps,
    timeline,
    forecast,
    feed,
    predicts,
    aiCoach,
    lifeGraph,
    lifeIntelligence,
    activeContext,
    beliefs,
    preferences,
    lifeEngine,
    lifeEngineStreak,
    lifeReplay,
    retirementGap,
    accountabilityPartner,
    lifeCircle,
    lifeXp,
    coachingLoops,
    todayImprove,
    weekStats,
  } = data;

  const goalLoops = coachingLoops?.filter((l) => l.goalId).slice(0, 1) ?? [];
  const habitLoops = coachingLoops?.filter((l) => !l.goalId).slice(0, 2) ?? [];
  const hasSocial =
    (lifeCircle?.length ?? 0) > 0 ||
    (beliefs?.length ?? 0) > 0 ||
    Boolean(preferences);
  const hasInsights =
    morning.notices.length > 0 ||
    feed.length > 0 ||
    predicts.length > 0 ||
    forecast.length > 0 ||
    Boolean(lifeIntelligence);
  const hasHistory = timeline.length > 0 || Boolean(lifeGraph) || Boolean(lifeReplay);

  async function clearContext() {
    await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeContextId: null }),
    });
    load(true);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-8">
      {showTour && <DashboardTour onDone={() => setShowTour(false)} />}
      <TrialBanner />

      {weekStats ? <WeekProgressStrip stats={weekStats} /> : null}

      {activeContext ? (
        <LifeContextBanner context={activeContext} onDismiss={clearContext} />
      ) : null}

      {isSunday() ? <SundayWeeklyLetter /> : null}

      {retirementGap && (activeContext?.id === "retirement" || retirementGap.yearsLeft <= 20) ? (
        <RetirementGapPanel gap={retirementGap} compact />
      ) : null}

      <DashboardSection
        title="Your day"
        description="Start here — briefing, one action, and today's mission."
        defaultOpen
      >
        <div data-tour="today-hero">
          <ChiefStaffHero hero={morning.hero} />
        </div>

        {isMorningHours() ? <MorningReflectionPanel /> : null}

        {lifeEngine ? (
          <div data-tour="life-engine">
            <LifeEnginePanel
              action={lifeEngine}
              streak={lifeEngineStreak}
              accountabilityPartner={accountabilityPartner}
              userName={userName}
              onComplete={() => load(true)}
            />
          </div>
        ) : null}

        {todayImprove ? (
          <PremiumGate feature="Improve today coaching">
            <TodayImprovePanel improve={todayImprove} onComplete={() => load(true)} />
          </PremiumGate>
        ) : null}

        <div id="mission">
          <TodaysMissionPanel
            items={missionItems}
            missionBonus={morning.missionBonus}
            onComplete={() => load()}
          />
        </div>

        <div id="coach">
          <AiCoachChip coach={aiCoach} />
        </div>
      </DashboardSection>

      <DashboardSection title="Your progress" description="Scores and momentum this week." defaultOpen>
        <LifeScoreRings scores={domainScores} reasons={scoreReasons} />
        {lifeXp ? <LifeXpPanel xp={lifeXp} compact /> : null}
      </DashboardSection>

      <DashboardSection title="Goals & coaching" description="Life GPS and active coaching loops." defaultOpen>
        <LifeGpsPanel gps={lifeGps} onUpdate={() => load()} expandGoals={expandLifeGps} />
        {goalLoops.length > 0 || habitLoops.length > 0 ? (
          <div className="space-y-3">
            {goalLoops.map((loop) => (
              <CoachingLoopBanner key={loop.id} loop={loop} />
            ))}
            {habitLoops.map((loop) => (
              <CoachingLoopBanner key={loop.id} loop={loop} />
            ))}
          </div>
        ) : null}
      </DashboardSection>

      <DashboardSection title="Focus areas" description="Jump into the modules that matter right now." defaultOpen>
        <ActionableModuleCards cards={moduleCards} />
      </DashboardSection>

      {hasInsights ? (
        <DashboardSection title="Insights" description="Notices, predictions, and forecasts.">
          {morning.notices.length > 0 ? <LifeNoticesPanel notices={morning.notices} /> : null}
          {feed.length > 0 ? (
            <div id="feed">
              <LifeFeedPanel items={feed} />
            </div>
          ) : null}
          {predicts.length > 0 ? <LifePredictsPanel items={predicts} /> : null}
          {forecast.length > 0 ? <LifeForecastPanel items={forecast} /> : null}
          {lifeIntelligence ? <LifeIntelligencePanel data={lifeIntelligence} /> : null}
        </DashboardSection>
      ) : null}

      {hasHistory ? (
        <DashboardSection title="Life log" description="Timeline, connections, and replays.">
          {lifeReplay ? <LifeReplayPanel replay={lifeReplay} userName={userName} /> : null}
          {lifeGraph ? <LifeGraphSnippet graph={lifeGraph} /> : null}
          {timeline.length > 0 ? <LifeTimelinePanel entries={timeline} /> : null}
        </DashboardSection>
      ) : null}

      {hasSocial ? (
        <DashboardSection title="Circle & mindset" description="People and beliefs shaping your week.">
          {lifeCircle && lifeCircle.length > 0 ? (
            <div data-tour="life-circle">
              <LifeCirclePanel
                members={lifeCircle}
                userName={userName}
                userAvatarUrl={data.userAvatarUrl}
                userCompletedToday={lifeEngineStreak?.completedToday}
                userStreak={lifeEngineStreak}
              />
            </div>
          ) : null}
          {(beliefs?.length ?? 0) > 0 || preferences ? (
            <BeliefsSnapshot beliefs={beliefs ?? []} preferences={preferences} />
          ) : null}
        </DashboardSection>
      ) : null}

      <DashboardSection title="Practice & reviews" description="Voice practice, reflections, and check-ins.">
        <VoicePracticePanel domain="leadership" />
        {isEveningHours() ? (
          <>
            <NightReflectionPanel />
            <EveningReviewPanel />
          </>
        ) : null}
        <DailyExperience />
      </DashboardSection>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => load(true)}>
          Refresh my day
        </Button>
      </div>
    </div>
  );
}
