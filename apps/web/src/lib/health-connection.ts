import { prisma } from "@forward/database";
import { isFitbitConfigured, maybeSyncStaleFitbit } from "@/lib/fitbit";
import { getHealthSyncSummary } from "@/lib/health-sync";

export async function getHealthIntegrationStatus(userId: string) {
  await maybeSyncStaleFitbit(userId);

  const fitbit = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId, provider: "FITBIT" } },
  });

  let fitbitLastSync: string | null = null;
  if (fitbit?.metadata) {
    try {
      const meta = JSON.parse(fitbit.metadata) as { lastSyncAt?: string };
      fitbitLastSync = meta.lastSyncAt ?? null;
    } catch {
      /* ignore */
    }
  }

  const summary = await getHealthSyncSummary(userId);
  const phoneHealthActive =
    summary.sources.includes("health_connect") || summary.sources.includes("apple_health");

  return {
    fitbit: {
      configured: isFitbitConfigured(),
      connected: Boolean(fitbit),
      accountId: fitbit?.accountLabel ?? null,
      lastSyncAt: fitbitLastSync,
      redirectUri:
        process.env.FITBIT_REDIRECT_URI ??
        `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002"}/api/integrations/fitbit/callback`,
    },
    healthConnect: {
      availableOnWeb: false,
      syncedToday: phoneHealthActive,
      lastSyncAt: phoneHealthActive ? summary.lastSyncedAt : null,
      hint:
        "Samsung Galaxy Watch: Samsung Health → Settings → Health Connect (share steps, sleep, heart rate) → open the MotiveLife Android app → Sync. Browser cannot sync Samsung. iPhone: Apple Watch → Apple Health → MotiveLife app.",
    },
    summary,
  };
}
