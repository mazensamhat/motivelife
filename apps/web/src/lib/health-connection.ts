import { prisma } from "@forward/database";
import { isFitbitConfigured } from "@/lib/fitbit";
import { getHealthSyncSummary } from "@/lib/health-sync";

export async function getHealthIntegrationStatus(userId: string) {
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
  const healthConnectActive = summary.sources.includes("health_connect");

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
      syncedToday: healthConnectActive,
      lastSyncAt: healthConnectActive ? summary.lastSyncedAt : null,
      hint: "On supported devices, open Health and tap Sync phone health.",
    },
    summary,
  };
}
