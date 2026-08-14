"use client";

import { useEffect, useState } from "react";
import { Button } from "./button";
import { Card } from "./card";
import { ActionableModuleCards } from "./actionable-module-cards";
import { AiBriefingInsights } from "./ai-briefing-insights";
import { AiCoachChip } from "./ai-coach-chip";
import { ChiefStaffHero } from "./chief-staff-hero";
import { CommandCenterTimeline } from "./command-center-timeline";
import { DashboardLoadingSequence } from "./dashboard-loading-sequence";
import { LifeFeedPanel } from "./life-feed-panel";
import { LifeMomentumPanel } from "./life-momentum-panel";
import { DigitalTwinOnboarding } from "./digital-twin-onboarding";
import { TwinEnginesStrip } from "./twin-engines-panels";
import { computeTwinCompleteness, type DigitalTwinProfile } from "@forward/shared";
import { LifeForecastPanel } from "./life-forecast-panel";
import { LifeGpsPanel } from "./life-gps-panel";
import { LifeNoticesPanel } from "./life-notices-panel";
import { LifePredictionEnginePanel } from "./life-prediction-engine-panel";
import { LifeTimelinePanel } from "./life-timeline-panel";
import { LifeScoreRings } from "./life-score-rings";
import { LifeXpPanel } from "./life-xp-panel";
import { CoachingLoopBanner } from "./coaching-loop-banner";
import { TrialBanner } from "./trial-banner";
import { CoachSetupRemindersPanel } from "./coach-setup-reminders-panel";
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
import { WeeklyLetterTeaser } from "./weekly-letter-teaser";
import { TodaysMissionPanel } from "./todays-mission-panel";
import { MorningReflectionPanel, isMorningHours } from "./morning-reflection-panel";
import { NightReflectionPanel, isEveningHours } from "./night-reflection-panel";
import { TalkToCoachPanel, LifeMemoryHookPanel } from "./voice-coach-panels";
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
  LifeMemoryHighlight,
  CommandCenterTimelinePayload,
  CoachSetupReminder,
} from "@forward/shared";
import type { RetirementGapPayload } from "@/lib/retirement-gap";
import type { AccountabilityPartner } from "@forward/shared";
import { readApiError, readApiJson } from "@/lib/fetch-api";
import type { ReactNode } from "react";

interface LifeOsData {
  needsLifeFocus: boolean;
  needsTwinOnboarding?: boolean;
  needsDashboardTour?: boolean;
  userAvatarUrl?: string | null;
  userName?: string | null;
  morning: MorningOperatingPayload;
  domainScores: DomainScoreMap;
  digitalTwin?: DigitalTwinProfile | null;
  twinCompleteness?: { percent: number; nextHint: string };
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
  lifeMemoryHighlights?: LifeMemoryHighlight[];
  hiddenModules?: LifeModuleId[];
  promotedModules?: LifeModuleId[];
  commandCenter: CommandCenterTimelinePayload;
  coachSetupReminders?: CoachSetupReminder[];
}

const INTRO_MS = 2800;

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
  const [introDone, setIntroDone] = useState(false);
  const [error, setError] = useState("");
  const [expandLifeGps, setExpandLifeGps] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [seeMore, setSeeMore] = useState(false);

  async function load(refresh = false) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/life-os${refresh ? "?refresh=true" : ""}`, {
        cache: "no-store",
      });
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
    const introTimer = window.setTimeout(() => setIntroDone(true), INTRO_MS);
    if (typeof window !== "undefined" && window.location.hash === "#life-gps") {
      setExpandLifeGps(true);
    }
    return () => window.clearTimeout(introTimer);
  }, []);

  if (!introDone || loading) {
    return <DashboardLoadingSequence userName={data?.userName} />;
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

  if (data.needsLifeFocus || data.needsTwinOnboarding) {
    return <DigitalTwinOnboarding onComplete={() => load()} />;
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
    commandCenter,
    coachSetupReminders = [],
    digitalTwin = null,
    twinCompleteness,
  } = data;

  const lifeMemoryHighlights = data.lifeMemoryHighlights ?? [];
  const twinConfidence =
    twinCompleteness ??
    computeTwinCompleteness(digitalTwin ?? null);

  const goalLoops = coachingLoops?.filter((l) => l.goalId).slice(0, 1) ?? [];
  const habitLoops = coachingLoops?.filter((l) => !l.goalId).slice(0, 2) ?? [];
  const hasSocial =
    (lifeCircle?.length ?? 0) > 0 ||
    (beliefs?.length ?? 0) > 0 ||
    Boolean(preferences);
  const hasInsights =
    morning.notices.length > 0 ||
    predicts.length > 0 ||
    forecast.length > 0 ||
    Boolean(lifeIntelligence);
  const surfaceFeed = feed.length > 0;
  const hasHistory = timeline.length > 0 || Boolean(lifeGraph) || Boolean(lifeReplay);

  const domainActions = Object.fromEntries(
    moduleCards
      .filter((c) => ["career", "money", "health"].includes(c.id))
      .map((c) => [
        c.id,
        {
          title: c.actionTitle,
          href: c.actionHref,
          minutes: /workout|gym/i.test(c.actionTitle)
            ? 18
            : /budget|spend|subscription/i.test(c.actionTitle)
              ? 6
              : 12,
          reward: Math.min(6, Math.max(2, (domainScores.domainDeltas[c.id as keyof typeof domainScores.domainDeltas] ?? 0) + 3)),
        },
      ])
  );

  async function clearContext() {
    await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeContextId: null }),
    });
    load(true);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-8 md:max-w-4xl xl:max-w-7xl">
      {showTour && <DashboardTour onDone={() => setShowTour(false)} />}
      <TrialBanner />

      {coachSetupReminders.length > 0 ? (
        <CoachSetupRemindersPanel reminders={coachSetupReminders} />
      ) : null}

      {activeContext ? (
        <LifeContextBanner context={activeContext} onDismiss={clearContext} />
      ) : null}

      <div data-tour="today-hero">
        <ChiefStaffHero hero={morning.hero} />
      </div>

      <div data-tour="life-momentum">
        <LifeMomentumPanel
          scores={domainScores}
          twinConfidence={{
            percent: twinConfidence.percent,
            nextHint: twinConfidence.nextHint,
          }}
        />
      </div>

      <LifePredictionEnginePanel items={predicts} maxItems={5} />

      <TwinEnginesStrip twin={digitalTwin ?? null} />

      <div id="mission">
        <TodaysMissionPanel
          items={missionItems}
          missionBonus={morning.missionBonus}
          onComplete={() => load()}
        />
      </div>

      <div id="command-center" data-tour="command-center">
        <CommandCenterTimeline
          data={commandCenter}
          domainScores={domainScores}
          coachSetupReminders={coachSetupReminders}
          onRefresh={() => load(true)}
        />
      </div>

      {aiCoach?.suggestion ? (
        <Card className="border-brand-cyan/20 bg-brand-cyan/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">AI recommendation</p>
          <p className="mt-2 text-sm text-forward-800">{aiCoach.suggestion}</p>
        </Card>
      ) : null}

      <div id="voice">
        <TalkToCoachPanel onCaptured={() => load(true)} />
      </div>

      {surfaceFeed ? (
        <div id="feed">
          <LifeFeedPanel items={feed} prominent maxItems={3} />
        </div>
      ) : null}

      <div className="flex justify-center">
        <Button variant="secondary" size="sm" onClick={() => setSeeMore((v) => !v)}>
          {seeMore ? "Show less" : "See more — goals, insights, life log"}
        </Button>
      </div>

      {seeMore ? (
        <div className="space-y-8 border-t border-forward-100 pt-6">
          <LifeScoreRings scores={domainScores} reasons={scoreReasons} domainActions={domainActions} />

          <AiBriefingInsights
            insights={morning.insights}
            briefingInsights={morning.briefingInsights}
            notices={morning.notices}
          />

          {retirementGap && (activeContext?.id === "retirement" || retirementGap.yearsLeft <= 20) ? (
            <RetirementGapPanel gap={retirementGap} compact />
          ) : null}

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

          <div id="coach">
            <AiCoachChip coach={aiCoach} />
          </div>

          <LifeMemoryHookPanel highlights={lifeMemoryHighlights} />

          {isSunday() ? <SundayWeeklyLetter /> : <WeeklyLetterTeaser stats={weekStats} />}

          <DashboardSection title="Progress" description="XP, streaks, and momentum this week." defaultOpen>
            {weekStats ? <WeekProgressStrip stats={weekStats} /> : null}
            {lifeXp ? <LifeXpPanel xp={lifeXp} compact /> : null}
          </DashboardSection>

          <DashboardSection title="UPLIFT & VYRA" description="Goals elevated and your AI Chief of Staff." defaultOpen>
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

          <DashboardSection title="Focus areas" description="One next action per module." defaultOpen>
            <ActionableModuleCards cards={moduleCards} domainDeltas={domainScores.domainDeltas} />
          </DashboardSection>

          {hasInsights || (surfaceFeed && feed.length > 3) || predicts.length > 5 || forecast.length > 0 ? (
            <div id="insights-feed">
              <DashboardSection title="Insights" description="Forecasts and discoveries.">
                {morning.notices.length > 0 ? <LifeNoticesPanel notices={morning.notices} /> : null}
                {predicts.length > 5 ? (
                  <LifePredictionEnginePanel items={predicts.slice(5)} compact maxItems={5} />
                ) : null}
                {surfaceFeed && feed.length > 3 ? <LifeFeedPanel items={feed.slice(3)} /> : null}
                {forecast.length > 0 ? <LifeForecastPanel items={forecast} /> : null}
                {lifeIntelligence ? <LifeIntelligencePanel data={lifeIntelligence} /> : null}
              </DashboardSection>
            </div>
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

          <DashboardSection title="Practice & reviews" description="Voice, reflections, and check-ins.">
            {isMorningHours() ? <MorningReflectionPanel /> : null}
            {todayImprove ? (
              <PremiumGate feature="Improve today coaching">
                <TodayImprovePanel improve={todayImprove} onComplete={() => load(true)} />
              </PremiumGate>
            ) : null}
            <VoicePracticePanel domain="leadership" />
            {isEveningHours() ? (
              <>
                <NightReflectionPanel />
                <EveningReviewPanel />
              </>
            ) : null}
            <DailyExperience />
          </DashboardSection>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => load(true)}>
          Refresh my day
        </Button>
      </div>
    </div>
  );
}
