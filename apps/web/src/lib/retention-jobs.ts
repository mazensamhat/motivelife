import { prisma } from "@forward/database";
import type { LifePreference } from "@forward/shared";
import { computeLifeScore } from "@/lib/generation";
import { getProgressStats } from "@/lib/forward";
import { buildMissionItems } from "@/lib/life-os";
import { getLifeEngineStreak } from "@/lib/life-engine-streak";
import {
  hasResendApiKey,
  sendMorningBriefingEmail,
  sendStreakAtRiskEmail,
  sendTrialEndingEmail,
} from "@/lib/email";
import { createNotification } from "@/lib/notifications";

function parsePrefs(raw: string | null): LifePreference | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LifePreference;
  } catch {
    return null;
  }
}

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function sentToday(userId: string, type: string) {
  const since = startOfUtcDay();
  const count = await prisma.notification.count({
    where: { userId, type, createdAt: { gte: since } },
  });
  return count > 0;
}

export type RetentionRunResult = {
  users: number;
  morningEmails: number;
  streakEmails: number;
  trialEmails: number;
  inAppNotifications: number;
};

export async function runDailyRetentionJobs(hourUtc: number): Promise<RetentionRunResult> {
  const result: RetentionRunResult = {
    users: 0,
    morningEmails: 0,
    streakEmails: 0,
    trialEmails: 0,
    inAppNotifications: 0,
  };

  const users = await prisma.user.findMany({
    where: { disabledAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      preferences: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      proExpiresAt: true,
      stripeSubscriptionId: true,
    },
  });

  const emailEnabled = hasResendApiKey();
  const isMorningWindow = hourUtc >= 12 && hourUtc <= 14;
  const isEveningWindow = hourUtc >= 22 || hourUtc <= 1;

  for (const user of users) {
    result.users += 1;
    const prefs = parsePrefs(user.preferences);
    if (prefs?.notifications === "off") continue;

    const paid = Boolean(user.stripeSubscriptionId);
    const onTrial =
      !paid &&
      user.trialEndsAt &&
      user.trialEndsAt.getTime() > Date.now() &&
      user.subscriptionPlan !== "plus";
    const trialDaysLeft = onTrial
      ? Math.ceil((user.trialEndsAt!.getTime() - Date.now()) / 86400000)
      : null;

    if (isMorningWindow && prefs?.notifications !== "minimal") {
      const type = "retention_morning";
      if (!(await sentToday(user.id, type))) {
        const [stats, missionItems] = await Promise.all([
          getProgressStats(user.id),
          buildMissionItems(user.id),
        ]);
        const mission = missionItems.find((m) => !m.done)?.title ?? null;
        const score = computeLifeScore(stats);
        const title = mission ? `Today's priority: ${mission}` : "Your briefing is ready";
        const body = `Life Score ${score} — tap for your chief-of-staff plan.`;

        await createNotification({
          userId: user.id,
          type,
          title,
          body,
          href: "/dashboard",
          force: true,
        });
        result.inAppNotifications += 1;

        if (emailEnabled && !(await sentToday(user.id, `${type}_email`))) {
          const sent = await sendMorningBriefingEmail(user.email, user.name, mission, score);
          if (sent.ok) {
            await prisma.notification.create({
              data: {
                userId: user.id,
                type: `${type}_email`,
                title: "Morning email sent",
                body: title,
              },
            });
            result.morningEmails += 1;
          }
        }
      }
    }

    if (isEveningWindow) {
      const streak = await getLifeEngineStreak(user.id);
      if (streak.atRisk && streak.currentStreak >= 2 && !streak.completedToday) {
        const type = "retention_streak";
        if (!(await sentToday(user.id, type))) {
          await createNotification({
            userId: user.id,
            type,
            title: `${streak.currentStreak}-day streak at risk`,
            body: "Complete Momentum Engine before midnight to keep it alive.",
            href: "/dashboard#life-engine",
            force: true,
          });
          result.inAppNotifications += 1;

          if (emailEnabled && !(await sentToday(user.id, `${type}_email`))) {
            const sent = await sendStreakAtRiskEmail(
              user.email,
              user.name,
              streak.currentStreak
            );
            if (sent.ok) {
              await prisma.notification.create({
                data: {
                  userId: user.id,
                  type: `${type}_email`,
                  title: "Streak reminder sent",
                  body: `${streak.currentStreak}-day streak`,
                },
              });
              result.streakEmails += 1;
            }
          }
        }
      }
    }

    if (onTrial && trialDaysLeft != null && [7, 3, 1].includes(trialDaysLeft)) {
      const type =
        trialDaysLeft === 7
          ? "retention_trial_7"
          : trialDaysLeft === 3
            ? "retention_trial_3"
            : "retention_trial_1";
      if (!(await sentToday(user.id, type))) {
        await createNotification({
          userId: user.id,
          type,
          title:
            trialDaysLeft === 1
              ? "Trial ends tomorrow"
              : `${trialDaysLeft} days left on Pro trial`,
          body: "Upgrade to keep your chief of staff, weekly letters, and voice coach.",
          href: "/settings",
          force: true,
        });
        result.inAppNotifications += 1;

        if (emailEnabled && !(await sentToday(user.id, `${type}_email`))) {
          const sent = await sendTrialEndingEmail(user.email, user.name, trialDaysLeft);
          if (sent.ok) {
            await prisma.notification.create({
              data: {
                userId: user.id,
                type: `${type}_email`,
                title: "Trial reminder sent",
                body: `${trialDaysLeft} days left`,
              },
            });
            result.trialEmails += 1;
          }
        }
      }
    }
  }

  return result;
}
