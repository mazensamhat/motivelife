/** Server-side ASC helper step engine (MotiveLife 1.0.4 IAP review flow). */

export type AscSnapshot = {
  capturedAt?: string;
  url: string;
  path?: string;
  title?: string;
  headings?: string[];
  buttons?: string[];
  controls?: Array<{ kind: string; label: string; text: string; disabled?: boolean }>;
  banners?: string[];
  signals?: Record<string, boolean | string | null>;
};

export type AscCoach = {
  action: "click" | "fill" | "close";
  text?: string;
  texts?: string[];
  fill?: string;
  find?: "close-drawer";
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

export function stepsForAscSnapshot(snapshot: AscSnapshot): AscStep[] {
  const s = snapshot.signals || {};
  const url = snapshot.url || "";
  const steps: AscStep[] = [];

  if (s.localizationModal) {
    steps.push(
      step(
        "close-localization",
        "Close the localization popup",
        ["Click Cancel on “Add App Store Localization”."],
        "English (U.S.) already exists.",
        { action: "click", text: "Cancel", texts: ["Cancel"] }
      )
    );
  }

  if (s.draftSubmission && (s.unableToSubmit || s.mustSubmitWithVersion)) {
    steps.push(
      step(
        "close-iap-draft",
        "Close Draft Submission — do not submit IAP alone",
        ["Click the X to close Draft Submission."],
        "Attach IAP to version 1.0.4 instead.",
        { action: "close", find: "close-drawer", text: "Close", texts: ["Close", "Cancel"] }
      )
    );
    steps.push(
      step(
        "go-version",
        "Open version 1.0.4 (Rejected)",
        ["App Store → iOS → 1.0.4. Do NOT create 1.0.5."],
        undefined,
        { action: "click", text: "1.0.4", texts: ["1.0.4", "App Store"] }
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
          ["Click blue Add for Review."],
          undefined,
          { action: "click", text: "Add for Review", texts: ["Add for Review"] }
        )
      );
    }
    if (!/version/i.test(url) || /subscription-groups/i.test(url)) {
      steps.push(
        step(
          "then-version-page",
          "Go to version 1.0.4 and attach IAP",
          ["App Store → 1.0.4 → In-App Purchases → + → Monthly."],
          undefined,
          { action: "click", text: "App Store", texts: ["App Store", "1.0.4"] }
        )
      );
    }
  }

  if (/version/i.test(url) || s.iapSection || s.rejected) {
    steps.push(
      step(
        "version-attach-iap",
        "Attach IAP on 1.0.4 if missing",
        ["In-App Purchases and Subscriptions → +"],
        undefined,
        {
          action: "click",
          text: "In-App Purchases and Subscriptions",
          texts: ["In-App Purchases and Subscriptions", "+"],
        }
      )
    );
    steps.push(
      step("version-build", "Select build 14", ["Choose 1.0.4 (14)."], undefined, {
        action: "click",
        text: "Build",
        texts: ["Build", "(14)"],
      })
    );
    steps.push(
      step(
        "version-privacy-url",
        "Set Privacy Policy URL",
        ["https://www.mymotivelife.com/privacy"],
        undefined,
        {
          action: "fill",
          text: "Privacy Policy",
          texts: ["Privacy Policy URL", "Privacy Policy"],
          fill: "https://www.mymotivelife.com/privacy",
        }
      )
    );
    steps.push(
      step(
        "version-description-terms",
        "Paste Terms into Description",
        ["Add Terms + Privacy lines."],
        undefined,
        {
          action: "fill",
          text: "Description",
          texts: ["Description"],
          fill: "Terms of Use (EULA): https://www.mymotivelife.com/terms\nPrivacy Policy: https://www.mymotivelife.com/privacy",
        }
      )
    );
    steps.push(
      step(
        "version-submit",
        "Submit the VERSION",
        ["Add for Review / Update Review on 1.0.4."],
        undefined,
        {
          action: "click",
          text: "Add for Review",
          texts: ["Add for Review", "Update Review", "Submit for Review"],
        }
      )
    );
  }

  if (steps.length === 0) {
    steps.push(
      step(
        "generic",
        "Open Subscriptions or version 1.0.4",
        ["Monetization → Subscriptions, or App Store → 1.0.4."],
        undefined,
        { action: "click", text: "Subscriptions", texts: ["Subscriptions", "App Store"] }
      )
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
