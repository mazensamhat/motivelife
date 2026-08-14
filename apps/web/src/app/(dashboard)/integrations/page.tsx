import { Suspense } from "react";
import { IntegrationsPanel } from "@/components/integrations-panel";

export default function IntegrationsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-forward-900">Connect</h1>
      <p className="mt-1 text-forward-500">
        Apps, devices & services — Google Calendar, Apple Calendar, Fitbit, and more.
      </p>
      <div className="mt-8">
        <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-forward-100" />}>
          <IntegrationsPanel />
        </Suspense>
      </div>
    </div>
  );
}
