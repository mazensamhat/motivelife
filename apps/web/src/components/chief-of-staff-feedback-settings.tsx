"use client";

import { FeedbackNavButton } from "./dashboard-mobile-nav";

export function ChiefOfStaffFeedbackSettings() {
  return (
    <section className="rounded-xl border border-forward-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-forward-900">Tell your Chief of Staff</h2>
      <p className="mt-1 text-sm text-forward-500">
        Share what you want MotiveLife to show, change, or do for you. Your message goes to the
        MotiveLife team — like briefing your chief of staff on what matters next.
      </p>
      <div className="mt-4">
        <FeedbackNavButton />
      </div>
    </section>
  );
}
