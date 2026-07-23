/** Server-side ASC helper step engine (MotiveLife 1.0.4 IAP review flow). */

export type AscSnapshot = {
  capturedAt?: string;
  url: string;
  path?: string;
  title?: string;
  headings?: string[];
  buttons?: string[];
  controls?: Array<{ kind: string; label: string; text: string; disabled?: boolean; rail?: boolean }>;
  banners?: string[];
  signals?: Record<string, boolean | string | null>;
};

export type AscCoach = {
  action: "click" | "fill" | "close";
  text?: string;
  texts?: string[];
  fill?: string;
  find?:
    | "close-drawer"
    | "version-iap-attach"
    | "version-build-select"
    | "build-14"
    | "rail-subscriptions"
    | "monthly-subscription"
    | "rail-version-104"
    | "app-review-screenshot";
  where?: "main" | "rail" | "any";
  exact?: boolean;
  kinds?: string[];
};

export type AscStep = {
  id: string;
  title: string;
  clicks: string[];
  why?: string;
  coach?: AscCoach | null;
};

function step(
  id: string,
  title: string,
  clicks: string[],
  why?: string,
  coach?: AscCoach | null
): AscStep {
  return { id, title, clicks, why, coach: coach ?? undefined };
}

function modeOf(snapshot: AscSnapshot): string {
  const s = snapshot.signals || {};
  if (typeof s.pageMode === "string" && s.pageMode) return s.pageMode;
  const url = snapshot.url || "";
  if (/\/reviewsubmissions/i.test(url)) return "review-submissions";
  if (/\/ios\/version\//i.test(url) || /\/version\//i.test(url)) return "version";
  if (/\/iaps\b/i.test(url) || /\/in-app-purchases/i.test(url)) return "iap-catalog";
  if (/subscription-groups|\/subscriptions/i.test(url)) return "subscriptions";
  return "other";
}

function versionChecklist(s: Record<string, boolean | string | null>): AscStep[] {
  // Build first — never send to Monetization while waiting for EAS 14
  if (!s.buildIs14 && String(s.buildNumber || "") !== "14") {
    if (s.buildFourteenListed) {
      return [
        step(
          "version-build",
          "Select build 1.0.4 (14) on this form",
          [
            "Stay on this version page.",
            "Build → choose 1.0.4 (14).",
            "Do NOT click sidebar In-App Purchases or Subscriptions.",
          ],
          "Build 12 was rejected — need 14.",
          { action: "click", find: "version-build-select", text: "1.0.4 (14)" }
        ),
      ];
    }
    return [
      step(
        "wait-eas-build-14",
        "Waiting for EAS build 1.0.4 (14)",
        [
          "Build still shows 12 — 14 is not uploaded yet.",
          "Stay on 1.0.4. Do NOT click In-App Purchases or Subscriptions in the sidebar.",
          "When EAS finishes: refresh → Build → select 1.0.4 (14).",
        ],
        "Nothing to select until the binary exists.",
        { action: "click", find: "version-build-select", text: "Build" }
      ),
    ];
  }

  if (!s.iapAttachedOnVersion && s.iapSectionOnVersionForm) {
    return [
      step(
        "version-iap-attach",
        "Attach MotiveLife Pro on THIS version form",
        [
          "Scroll to “In-App Purchases and Subscriptions” (not the sidebar).",
          "Click + → add Monthly / MotiveLife Pro.",
        ],
        "Sidebar In-App Purchases is the wrong place.",
        { action: "click", find: "version-iap-attach", text: "In-App Purchases and Subscriptions" }
      ),
    ];
  }

  if (!s.iapAttachedOnVersion && !s.iapSectionOnVersionForm) {
    if (s.subReadyHint || s.subProductReady || s.visitedSubs) {
      return [
        step(
          "iap-section-missing-stay",
          "Stay on 1.0.4 — IAP section still hidden",
          [
            "Do NOT click sidebar In-App Purchases or Subscriptions again.",
            "Hard-refresh once. If section still missing, subscription is not Ready to Submit.",
          ],
          null
        ),
      ];
    }
    return [
      step(
        "check-sub-ready-once",
        "One check: Subscriptions → Ready to Submit?",
        [
          "Monetization → Subscriptions (not In-App Purchases).",
          "Open Monthly → fix Missing Metadata if needed → Ready to Submit → back to 1.0.4.",
        ],
        "One trip only.",
        {
          action: "click",
          find: "rail-subscriptions",
          text: "Subscriptions",
          texts: ["Subscriptions"],
          where: "rail",
        }
      ),
    ];
  }

  if (!s.descriptionHasTerms && !s.privacyTermsInDescriptionHint) {
    return [
      step(
        "version-description-terms",
        "Paste Terms into Description",
        ["Append Terms + Privacy lines, then Save."],
        "Apple 3.1.2(c).",
        {
          action: "fill",
          text: "Description",
          texts: ["Description"],
          where: "main",
          fill: "Terms of Use (EULA): https://www.mymotivelife.com/terms\nPrivacy Policy: https://www.mymotivelife.com/privacy",
        }
      ),
    ];
  }

  if (!s.privacyUrlOk) {
    return [
      step(
        "version-privacy-url",
        "Set Privacy Policy URL",
        ["https://www.mymotivelife.com/privacy"],
        undefined,
        {
          action: "fill",
          text: "Privacy Policy URL",
          texts: ["Privacy Policy URL"],
          where: "main",
          fill: "https://www.mymotivelife.com/privacy",
        }
      ),
    ];
  }

  return [
    step(
      "version-submit",
      "Submit this version",
      ["Click Add for Review or Update Review."],
      "Already on 1.0.4 — never click the sidebar to “go back”.",
      {
        action: "click",
        text: "Add for Review",
        texts: ["Add for Review", "Update Review", "Submit for Review"],
        where: "main",
      }
    ),
  ];
}

function subscriptionsChecklist(s: Record<string, boolean | string | null>): AscStep[] {
  if (s.subProductReady || s.subReadyToSubmit) {
    if (s.addForReview) {
      return [
        step(
          "iap-add-for-review",
          "Click Add for Review",
          ["Top right: Add for Review."],
          undefined,
          {
            action: "click",
            text: "Add for Review",
            texts: ["Add for Review"],
            exact: true,
            where: "main",
          }
        ),
      ];
    }
    return [
      step(
        "subs-go-version",
        "Subscription Ready to Submit — open 1.0.4",
        [
          "Click 1.0.4 in the left rail, hard-refresh, then In-App Purchases and Subscriptions → +.",
        ],
        undefined,
        {
          action: "click",
          find: "rail-version-104",
          text: "1.0.4",
          texts: ["1.0.4 Ready for Review", "1.0.4 Rejected", "1.0.4"],
          where: "rail",
        }
      ),
    ];
  }

  if (!s.subProductDetail) {
    return [
      step(
        "subs-open-monthly",
        "Click MotiveLife Pro (Monthly)",
        ["Stay on Subscriptions. Click MotiveLife Pro / Monthly. Do not click 1.0.4."],
        "Sidebar Ready for Review is the APP, not the subscription.",
        {
          action: "click",
          find: "monthly-subscription",
          text: "MotiveLife Pro",
          texts: ["MotiveLife Pro", "motivelife_pro_monthly", "Monthly"],
          where: "main",
        }
      ),
    ];
  }

  if (s.subNeedsReviewScreenshot || s.subMissingMetadata) {
    return [
      step(
        "subs-review-screenshot",
        "Upload App Review Screenshot (required)",
        [
          "Upload iPhone screenshot of Settings → MotiveLife Pro with price + Terms + Privacy.",
          "Save until Ready to Submit. Do not open 1.0.4 yet.",
        ],
        "Apple 2.1(b).",
        {
          action: "click",
          find: "app-review-screenshot",
          text: "App Review Screenshot",
          texts: ["App Review Screenshot", "Review Screenshot"],
          where: "main",
        }
      ),
    ];
  }

  return [
    step(
      "subs-fix-metadata",
      "Finish Missing Metadata, then Save",
      ["Fill incomplete fields, Save, wait for Ready to Submit."],
      undefined,
      {
        action: "click",
        text: "Save",
        texts: ["Save"],
        exact: true,
        where: "main",
        kinds: ["button"],
      }
    ),
  ];
}

export function stepsForAscSnapshot(snapshot: AscSnapshot): AscStep[] {
  const s = snapshot.signals || {};
  const mode = modeOf(snapshot);

  if (s.localizationModal) {
    return [
      step(
        "close-localization",
        "Close localization popup",
        ["Click Cancel."],
        undefined,
        { action: "click", text: "Cancel", texts: ["Cancel"], exact: true, where: "main" }
      ),
    ];
  }

  if (mode === "build-picker" || s.buildPickerOpen) {
    return [
      step(
        "pick-build-14",
        "Choose build 1.0.4 (14)",
        ["Click 1.0.4 (14) in this list."],
        "This is the right screen — do not go back via the sidebar.",
        { action: "click", find: "build-14", text: "1.0.4 (14)", texts: ["1.0.4 (14)", "(14)"] }
      ),
    ];
  }

  if (mode === "off-version") {
    return [
      step(
        "return-to-version",
        "Return to version 1.0.4 form",
        ["Click 1.0.4 in the left rail."],
        "You left the version page.",
        {
          action: "click",
          find: "rail-version-104",
          text: "1.0.4",
          texts: ["1.0.4 Ready for Review", "1.0.4 Rejected", "1.0.4"],
          where: "rail",
        }
      ),
    ];
  }

  if (mode === "subscriptions") return subscriptionsChecklist(s);

  if (mode === "version") return versionChecklist(s);

  if (mode === "review-submissions") {
    return [
      step(
        "review-go-version",
        "WRONG PAGE — click 1.0.4 in the left sidebar",
        ["Click 1.0.4 Ready for Review in the left rail."],
        "App Review has no IAP attach section.",
        {
          action: "click",
          find: "rail-version-104",
          text: "1.0.4 Ready for Review",
          texts: ["1.0.4 Ready for Review", "1.0.4"],
          where: "rail",
        }
      ),
    ];
  }

  if (s.draftDrawerOpen || (s.draftSubmission && s.unableToSubmit)) {
    return [
      step(
        "close-iap-draft",
        "Close Draft Submission",
        ["Close the panel (X)."],
        undefined,
        { action: "close", find: "close-drawer", text: "Close", texts: ["Close", "Cancel"] }
      ),
    ];
  }

  if (mode === "iap-catalog") {
    return [
      step(
        "iap-catalog-go-version",
        "Open version 1.0.4 (leave catalog)",
        ["Click 1.0.4 in the left sidebar."],
        undefined,
        {
          action: "click",
          find: "rail-version-104",
          text: "1.0.4",
          texts: ["1.0.4 Ready for Review", "1.0.4 Rejected", "1.0.4"],
          where: "rail",
        }
      ),
    ];
  }

  if (s.iapSection || s.readyForReview || s.rejected) return versionChecklist(s);

  return [
    step(
      "go-version",
      "Open version 1.0.4",
      ["Click 1.0.4 in the left sidebar."],
      undefined,
      {
        action: "click",
        find: "rail-version-104",
        text: "1.0.4",
        texts: ["1.0.4 Ready for Review", "1.0.4 Rejected", "1.0.4"],
        where: "rail",
      }
    ),
  ];
}

export function detectStuck(snapshot: AscSnapshot): string | null {
  const s = snapshot.signals || {};
  if (s.unableToSubmit) return "Unable to Submit for Review banner";
  if (s.pageMode === "build-picker" || s.pageMode === "version") return null;
  if (s.pageMode === "subscriptions" && s.subMissingMetadata) {
    return "Subscription Missing Metadata — stay on Subscriptions, do not open 1.0.4 yet";
  }
  if (s.draftDrawerOpen) return "Draft Submission drawer open";
  if (s.pageMode === "iap-catalog") return "On IAP catalog — open version 1.0.4";
  if (s.localizationModal) return "Localization modal open / Save disabled";
  return null;
}
