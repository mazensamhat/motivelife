/**
 * MotiveLife App Store Connect next-step engine + coach targets.
 * Stay on version 1.0.4 — do not create 1.0.5.
 */
(function () {
  function step(id, title, clicks, why, coach) {
    return { id, title, clicks, why, coach };
  }

  window.__MOTIVELIFE_ASC_STEPS__ = function stepsFor(snapshot) {
    const s = snapshot.signals || {};
    const url = snapshot.url || "";
    const steps = [];

    if (s.localizationModal) {
      steps.push(
        step(
          "close-localization",
          "Close the localization popup",
          ["Click Cancel on “Add App Store Localization”."],
          "English (U.S.) already exists — don’t add another.",
          { action: "click", text: "Cancel", texts: ["Cancel"] }
        )
      );
    }

    if (s.draftSubmission && (s.unableToSubmit || s.mustSubmitWithVersion)) {
      steps.push(
        step(
          "close-iap-draft",
          "Close Draft Submission — don’t submit IAP alone",
          ["Click the X to close Draft Submission."],
          "Apple will not enable Submit here. Attach IAP to version 1.0.4 instead.",
          { action: "close", find: "close-drawer", text: "Close", texts: ["Close", "Cancel"] }
        )
      );
      steps.push(
        step(
          "go-version",
          "Open version 1.0.4",
          ["App Store → iOS → 1.0.4 (Rejected). Do NOT create 1.0.5."],
          "IAP must be submitted with the app binary version.",
          { action: "click", text: "1.0.4", texts: ["1.0.4", "App Store", "iOS App"] }
        )
      );
      return steps;
    }

    if (/subscription-groups|subscription|in-app-purchase/i.test(url) || s.monthlyProduct) {
      if (s.addForReview && !s.draftSubmission) {
        steps.push(
          step(
            "iap-add-for-review",
            "Queue the Monthly subscription",
            ["Click blue Add for Review (top right)."],
            "This only queues the IAP — you still attach it to 1.0.4.",
            { action: "click", text: "Add for Review", texts: ["Add for Review"] }
          )
        );
      }
      if (!/version/i.test(url) || /subscription-groups/i.test(url)) {
        steps.push(
          step(
            "then-version-page",
            "Go to version 1.0.4 and attach IAP",
            [
              "Open App Store → version 1.0.4.",
              "In-App Purchases and Subscriptions → + → Monthly.",
            ],
            "This is what Apple means by submit with an app version.",
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
          ["In-App Purchases and Subscriptions → + → Monthly / MotiveLife Pro."],
          "2.1(b) fails if the product isn’t on this version.",
          {
            action: "click",
            text: "In-App Purchases and Subscriptions",
            texts: ["In-App Purchases and Subscriptions", "+", "Add"],
          }
        )
      );
      steps.push(
        step(
          "version-build",
          "Select build 14",
          ["Build → choose 1.0.4 (14)."],
          "Don’t leave build 12 selected.",
          { action: "click", text: "Build", texts: ["Build", "1.0.4 (14)", "(14)"] }
        )
      );
      steps.push(
        step(
          "version-privacy-url",
          "Set Privacy Policy URL",
          ["Privacy Policy URL = https://www.mymotivelife.com/privacy"],
          "Required metadata.",
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
          ["Add Terms + Privacy lines to Description."],
          "Apple 3.1.2(c) metadata requirement.",
          {
            action: "fill",
            text: "Description",
            texts: ["Description"],
            fill:
              "Terms of Use (EULA): https://www.mymotivelife.com/terms\nPrivacy Policy: https://www.mymotivelife.com/privacy",
          }
        )
      );
      steps.push(
        step(
          "version-submit",
          "Submit the VERSION",
          ["Click Add for Review / Update Review / Submit for Review on 1.0.4."],
          "Stay on 1.0.4 — Update Review.",
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
          "Coach appears when a known button is on screen.",
          { action: "click", text: "Subscriptions", texts: ["Subscriptions", "App Store"] }
        )
      );
    }

    return steps;
  };
})();
