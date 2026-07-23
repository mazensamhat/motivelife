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
  find?: "close-drawer" | "version-iap-attach";
  where?: "main" | "rail" | "any";
  exact?: boolean;
};

export type AscStep = {
  id: string;
  title: string;
  clicks: string[];
  why?: string;
  coach?: AscCoach;
};

function step(
  id: string,
  title: string,
  clicks: string[],
  why?: string,
  coach?: AscCoach
): AscStep {
  return { id, title, clicks, why, coach };
}

function modeOf(snapshot: AscSnapshot): string {
  const s = snapshot.signals || {};
  if (typeof s.pageMode === "string" && s.pageMode) return s.pageMode;
  const url = snapshot.url || "";
  if (/\/ios\/version\//i.test(url) || /\/version\//i.test(url)) return "version";
  if (/\/iaps\b/i.test(url) || /\/in-app-purchases/i.test(url)) return "iap-catalog";
  if (/subscription-groups|\/subscriptions/i.test(url)) return "subscriptions";
  return "other";
}

export function stepsForAscSnapshot(snapshot: AscSnapshot): AscStep[] {
  const s = snapshot.signals || {};
  const mode = modeOf(snapshot);
  const steps: AscStep[] = [];

  if (s.localizationModal) {
    steps.push(
      step(
        "close-localization",
        "Close localization popup",
        ["Click Cancel."],
        "English (U.S.) already exists.",
        { action: "click", text: "Cancel", texts: ["Cancel"], exact: true, where: "main" }
      )
    );
    return steps;
  }

  // Already on version page — never point at rail 1.0.4 again.
  if (mode === "version") {
    steps.push(
      step(
        "version-iap-attach",
        "Attach subscription ON THIS VERSION",
        [
          "Scroll to “In-App Purchases and Subscriptions” on the version form.",
          "Click + there — not Monetization → In-App Purchases in the sidebar.",
        ],
        "Sidebar IAP catalog leaves the version page (loop).",
        { action: "click", find: "version-iap-attach", text: "In-App Purchases and Subscriptions" }
      )
    );
    if (!s.privacyTermsInDescriptionHint) {
      steps.push(
        step(
          "version-description-terms",
          "Add Terms to Description",
          ["Paste Terms + Privacy into Description."],
          "Apple 3.1.2(c).",
          {
            action: "fill",
            text: "Description",
            texts: ["Description"],
            where: "main",
            fill: "Terms of Use (EULA): https://www.mymotivelife.com/terms\nPrivacy Policy: https://www.mymotivelife.com/privacy",
          }
        )
      );
    }
    steps.push(
      step(
        "version-privacy-url",
        "Privacy Policy URL",
        ["Set Privacy Policy URL."],
        undefined,
        {
          action: "fill",
          text: "Privacy Policy URL",
          texts: ["Privacy Policy URL", "Privacy Policy"],
          where: "main",
          fill: "https://www.mymotivelife.com/privacy",
        }
      )
    );
    if (String(s.buildNumber || "") !== "14") {
      steps.push(
        step(
          "version-build",
          "Select build 14",
          ["Build → 1.0.4 (14)."],
          "Not build 12.",
          { action: "click", text: "Build", texts: ["Build", "(14)"], where: "main" }
        )
      );
    }
    steps.push(
      step(
        "version-submit",
        "Submit version 1.0.4",
        ["Click Update Review."],
        "Already on 1.0.4 — do not click the sidebar again.",
        {
          action: "click",
          text: "Update Review",
          texts: ["Update Review", "Add for Review", "Submit for Review"],
          where: "main",
        }
      )
    );
    return steps;
  }

  if (s.draftDrawerOpen || (s.draftSubmission && s.unableToSubmit)) {
    steps.push(
      step(
        "close-iap-draft",
        "Close Draft Submission",
        ["Close the Draft Submission panel (X)."],
        "Attach IAP on version 1.0.4.",
        { action: "close", find: "close-drawer", text: "Close", texts: ["Close", "Cancel"] }
      )
    );
    steps.push(
      step(
        "go-version-from-draft",
        "Open version 1.0.4",
        ["Click 1.0.4 Rejected."],
        undefined,
        { action: "click", text: "1.0.4", texts: ["1.0.4 Rejected", "1.0.4"], where: "rail" }
      )
    );
    return steps;
  }

  if (mode === "iap-catalog") {
    steps.push(
      step(
        "iap-catalog-go-version",
        "Open version 1.0.4 (leave catalog)",
        ["Click 1.0.4 Rejected in the left sidebar."],
        "Attach on the VERSION page, not the IAP catalog.",
        {
          action: "click",
          text: "1.0.4 Rejected",
          texts: ["1.0.4 Rejected", "1.0.4"],
          where: "rail",
        }
      )
    );
    return steps;
  }

  if (mode === "subscriptions") {
    if (s.addForReview) {
      steps.push(
        step(
          "iap-add-for-review",
          "Queue Monthly subscription",
          ["Click Add for Review."],
          undefined,
          {
            action: "click",
            text: "Add for Review",
            texts: ["Add for Review"],
            exact: true,
            where: "main",
          }
        )
      );
    }
    steps.push(
      step(
        "subs-go-version",
        "Open version 1.0.4",
        ["Click 1.0.4 Rejected."],
        undefined,
        {
          action: "click",
          text: "1.0.4 Rejected",
          texts: ["1.0.4 Rejected", "1.0.4"],
          where: "rail",
        }
      )
    );
    return steps;
  }

  steps.push(
    step(
      "go-version",
      "Open version 1.0.4",
      ["Click 1.0.4 Rejected."],
      undefined,
      {
        action: "click",
        text: "1.0.4 Rejected",
        texts: ["1.0.4 Rejected", "1.0.4"],
        where: "rail",
      }
    )
  );
  return steps;
}

export function detectStuck(snapshot: AscSnapshot): string | null {
  const s = snapshot.signals || {};
  if (s.unableToSubmit) return "Unable to Submit for Review banner";
  if (s.pageMode === "version") return null;
  if (s.draftDrawerOpen) return "Draft Submission drawer open";
  if (s.pageMode === "iap-catalog") return "On IAP catalog — open version 1.0.4";
  if (s.localizationModal) return "Localization modal open / Save disabled";
  return null;
}
