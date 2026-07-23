/** Server-side ASC helper step engine (MotiveLife 1.0.4 IAP review flow). */

export type AscSnapshot = {
  capturedAt?: string;
  url: string;
  path?: string;
  title?: string;
  headings?: string[];
  buttons?: string[];
  banners?: string[];
  signals?: Record<string, boolean | string | null>;
};

export type AscStep = {
  id: string;
  title: string;
  clicks: string[];
  why?: string;
};

function step(id: string, title: string, clicks: string[], why?: string): AscStep {
  return { id, title, clicks, why };
}

export function stepsForAscSnapshot(snapshot: AscSnapshot): AscStep[] {
  const s = snapshot.signals || {};
  const url = snapshot.url || "";
  const steps: AscStep[] = [];

  if (s.localizationModal) {
    steps.push(
      step(
        "close-localization",
        "Close the localization popup",
        [
          "Click Cancel on “Add App Store Localization”.",
          "English (U.S.) MotiveLife Pro should already exist in the Localization table.",
        ],
        "Save stays gray when nothing changed — that is fine."
      )
    );
  }

  if (s.draftSubmission && (s.unableToSubmit || s.mustSubmitWithVersion)) {
    steps.push(
      step(
        "close-iap-draft",
        "Close Draft Submission — do not submit IAP alone",
        [
          "Click X to close the Draft Submission panel.",
          "Yellow “Unable to Submit” is expected for a first subscription.",
        ],
        "Apple requires the subscription to be submitted with an app version."
      )
    );
    steps.push(
      step(
        "go-version",
        "Open version 1.0.4 (Rejected)",
        [
          "App Store → iOS → MotiveLife → version 1.0.4.",
          "Do NOT create 1.0.5.",
        ]
      )
    );
    return steps;
  }

  if (/subscription|in-app-purchase|iap/i.test(url) || s.monthlyProduct) {
    if (s.addForReview && !s.draftSubmission) {
      steps.push(
        step(
          "iap-add-for-review",
          "Queue Monthly subscription",
          [
            "Confirm Product ID motivelife_pro_monthly, 1 month, MotiveLife Pro localization, Review screenshot.",
            "Click blue Add for Review.",
          ]
        )
      );
    }
    if (!/version/i.test(url)) {
      steps.push(
        step(
          "then-version-page",
          "Attach IAP on version 1.0.4",
          [
            "Go to App Store → version 1.0.4.",
            "In-App Purchases and Subscriptions → + → select Monthly / MotiveLife Pro (and group if shown).",
          ]
        )
      );
    }
  }

  if (/version|ios.*app/i.test(url) || s.iapSection || s.rejected) {
    steps.push(
      step("version-attach-iap", "Confirm IAP is listed on 1.0.4", [
        "If Monthly / MotiveLife Pro missing → + → add it.",
        "If already listed → continue.",
      ])
    );
    steps.push(
      step("version-build", "Select build 14", [
        "Build section → choose 1.0.4 (14) after EAS upload.",
        "Do not leave build 12 selected.",
      ])
    );
    steps.push(
      step("version-metadata", "Add Terms + Privacy to metadata", [
        "Privacy Policy URL = https://www.mymotivelife.com/privacy",
        "Description must include:\nTerms of Use (EULA): https://www.mymotivelife.com/terms\nPrivacy Policy: https://www.mymotivelife.com/privacy",
      ])
    );
    steps.push(
      step("version-submit", "Submit the VERSION", [
        "Paste Review Notes from docs/APP_STORE_REJECT_2026-07-23.md.",
        "Click Update Review / Submit for Review on the 1.0.4 page (not the IAP-only drawer).",
      ])
    );
  }

  if (steps.length === 0) {
    steps.push(
      step("generic", "Open the right ASC page", [
        "IAP setup: Monetization → Subscriptions → Monthly (motivelife_pro_monthly).",
        "Submit: App Store → 1.0.4 → attach IAP → build 14 → Update Review.",
        "Click Report now in the helper if you are stuck.",
      ])
    );
  }

  return steps;
}

export function detectStuck(snapshot: AscSnapshot): string | null {
  const s = snapshot.signals || {};
  if (s.unableToSubmit) return "Unable to Submit for Review banner";
  if (s.draftSubmission && s.mustSubmitWithVersion) return "IAP draft requires app version";
  if (s.localizationModal) return "Localization modal open / Save disabled";
  const buttons = (snapshot.buttons || []).join(" ");
  if (/Submit for Review/i.test(buttons) && s.unableToSubmit) return "Submit disabled";
  return null;
}
