import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@forward/database";
import { ChangePasswordSettings } from "@/components/change-password-settings";
import { GenerationSwitcher } from "@/components/generation-switcher";
import { IntegrationsPanel } from "@/components/integrations-panel";
import { LifeBeliefsSettings } from "@/components/life-beliefs-settings";
import { LifeFocusSettings } from "@/components/life-focus-settings";
import { ProfileSettings } from "@/components/profile-settings";
import { SubscriptionSettings } from "@/components/subscription-settings";
import { getSession } from "@/lib/session";
import { getResolvedGeneration } from "@/lib/generation-preview";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { name: true, email: true, birthYear: true },
  });

  if (!user) redirect("/login");

  const { generation, profileGeneration } = await getResolvedGeneration(user.birthYear);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-forward-900">Settings</h1>
        <p className="mt-1 text-forward-500">
          Profile, dashboard view, and connected services.
        </p>
      </div>

      <ProfileSettings name={user.name} email={user.email} birthYear={user.birthYear} />

      <ChangePasswordSettings />

      <LifeFocusSettings />

      <LifeBeliefsSettings />

      <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-forward-100" />}>
        <SubscriptionSettings />
      </Suspense>

      <GenerationSwitcher
        activeGeneration={generation}
        profileGeneration={profileGeneration}
      />

      <div>
        <h2 className="text-lg font-semibold text-forward-900">Integrations</h2>
        <p className="mt-1 text-sm text-forward-500">
        Connect Google Calendar to power your daily briefings.
        </p>
        <div className="mt-4">
          <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-forward-100" />}>
            <IntegrationsPanel />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
