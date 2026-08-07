import { redirect } from "next/navigation";
import { prisma } from "@forward/database";
import { DashboardShell } from "@/components/dashboard-shell";
import { isAdminEmail } from "@/lib/admin";
import { getSession } from "@/lib/session";
import { computeLifeScore } from "@/lib/generation";
import { getResolvedGeneration } from "@/lib/generation-preview";
import { getProgressStats } from "@/lib/forward";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Parallel boot — sequential awaits were stacking cold-path latency on every
  // Mode of Life navigation while Family GPS/SSE contended for Postgres.
  const [user, stats] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: { name: true, birthYear: true, email: true },
    }),
    getProgressStats(session.id),
  ]);

  const { generation, profileGeneration, theme } = await getResolvedGeneration(user?.birthYear);
  const lifeScore = computeLifeScore(stats);

  return (
    <div
      className="flex h-dvh max-h-dvh overflow-hidden bg-forward-50"
      data-generation={generation}
      style={
        {
          "--gen-primary": theme.primary,
          "--gen-primary-light": theme.primaryLight,
          "--gen-primary-dark": theme.primaryDark,
        } as Record<string, string>
      }
    >
      <DashboardShell
        theme={theme}
        generation={generation}
        profileGeneration={profileGeneration}
        userName={user?.name ?? session.name}
        userEmail={user?.email ?? session.email}
        lifeScore={lifeScore}
        isAdmin={isAdminEmail(session.email)}
      >
        {children}
      </DashboardShell>
    </div>
  );
}
