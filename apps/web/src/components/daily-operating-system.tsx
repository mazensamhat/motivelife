"use client";

import { useEffect, useState } from "react";
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
import { PartnerActivityPanel } from "./partner-activity-panel";
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
import { DailyExperience } from "./daily-experience";
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

export function DailyOperatingSystem() {
  const [data, setData] = useState<LifeOsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandLifeGps, setExpandLifeGps] = useState(false);

  async function load(refresh = false) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/life-os${refresh ? "?refresh=true" : ""}`);
      const json = await readApiJson<LifeOsData>(res);
      if (!res.ok || !json) {
        setError(await readApiError(res));
        return;
      }
      setData(json);
    } catch {
      setError("Could not load your day.");
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
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => load(true)}>
          Try again
        </Button>
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
    partnerActivity,
    lifeXp,
    coachingLoops,
    todayImprove,
    weekStats,
    hiddenModules,
    promotedModules,
  } = data;

  async function clearContext() {
    await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeContextId: null }),
    });
    load(true);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <TrialBanner />

      {weekStats && <WeekProgressStrip stats={weekStats} />}

      {accountabilityPartner?.linkedUserId && partnerActivity && (
        <PartnerActivityPanel
          partner={accountabilityPartner}
          activity={partnerActivity}
          userName={userName}
          userCompletedToday={lifeEngineStreak?.completedToday}
        />
      )}

      {isSunday() && <SundayWeeklyLetter />}

      {lifeReplay && <LifeReplayPanel replay={lifeReplay} userName={userName} />}

      {retirementGap && (activeContext?.id === "retirement" || retirementGap.yearsLeft <= 20) && (
        <RetirementGapPanel gap={retirementGap} compact />
      )}

      {lifeEngine && (
        <LifeEnginePanel
          action={lifeEngine}
          streak={lifeEngineStreak}
          accountabilityPartner={accountabilityPartner}
          userName={userName}
          onComplete={() => load(true)}
        />
      )}

      {todayImprove && (
        <PremiumGate feature="Improve today coaching">
          <TodayImprovePanel improve={todayImprove} onComplete={() => load(true)} />
        </PremiumGate>
      )}

      <ChiefStaffHero hero={morning.hero} />

      {isMorningHours() && <MorningReflectionPanel />}

      <VoicePracticePanel domain="leadership" />

      {isEveningHours() && (
        <>
          <NightReflectionPanel />
          <EveningReviewPanel />
        </>
      )}

      {activeContext && (
        <LifeContextBanner context={activeContext} onDismiss={clearContext} />
      )}

      {(beliefs?.length ?? 0) > 0 || preferences ? (
        <BeliefsSnapshot beliefs={beliefs ?? []} preferences={preferences} />
      ) : null}

      <LifeNoticesPanel notices={morning.notices} />

      <LifeScoreRings scores={domainScores} reasons={scoreReasons} />

      {lifeXp && <LifeXpPanel xp={lifeXp} compact />}

      {coachingLoops && coachingLoops.length > 0 && (
        <div className="space-y-3">
          {coachingLoops
            .filter((l) => l.goalId)
            .slice(0, 1)
            .map((loop) => (
              <CoachingLoopBanner key={loop.id} loop={loop} />
            ))}
          {coachingLoops
            .filter((l) => !l.goalId)
            .slice(0, 2)
            .map((loop) => (
              <CoachingLoopBanner key={loop.id} loop={loop} />
            ))}
        </div>
      )}

      <LifeGpsPanel gps={lifeGps} onUpdate={() => load()} expandGoals={expandLifeGps} />

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

      <div id="feed">
        <LifeFeedPanel items={feed} />
      </div>

      <LifePredictsPanel items={predicts} />

      {activeContext && (
        <p className="text-xs font-medium text-brand-blue">
          Modules prioritized for {activeContext.label}
        </p>
      )}

      {(hiddenModules?.length ?? 0) > 0 && (
        <p className="text-xs text-forward-500">
          Dashboard adapted — unused modules hidden: {hiddenModules!.join(", ")}
          {promotedModules?.length ? `. Promoted: ${promotedModules.join(", ")}` : ""}
        </p>
      )}

      <ActionableModuleCards cards={moduleCards} />

      <LifeForecastPanel items={forecast} />

      {lifeIntelligence && <LifeIntelligencePanel data={lifeIntelligence} />}

      {lifeGraph && <LifeGraphSnippet graph={lifeGraph} />}

      <LifeTimelinePanel entries={timeline} />

      <details className="group rounded-xl border border-forward-200 bg-white">
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-forward-700">
          Evening review & weekly check-in
        </summary>
        <div className="border-t border-forward-100 px-5 py-4">
          <DailyExperience />
        </div>
      </details>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => load(true)}>
          Refresh my day
        </Button>
      </div>
    </div>
  );
}
