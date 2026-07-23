/**
 * MotiveLife ASC next-step engine.
 * Plans are ordered; coach points at the first step whose control exists on the page.
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
          "Close localization popup",
          ["Click Cancel."],
          "English (U.S.) already exists.",
          { action: "click", text: "Cancel", texts: ["Cancel"], exact: true }
        )
      );
    }

    if (s.draftSubmission && (s.unableToSubmit || s.mustSubmitWithVersion)) {
      steps.push(
        step(
          "close-iap-draft",
          "Close Draft Submission",
          ["Close the Draft Submission panel (X)."],
          "Do not submit IAP alone — attach it to version 1.0.4.",
          { action: "close", find: "close-drawer", text: "Close", texts: ["Close", "Cancel"] }
        )
      );
      steps.push(
        step(
          "go-version",
          "Open version 1.0.4",
          ["Click 1.0.4 (or App Store → 1.0.4)."],
          "IAP must ship with the app version.",
          { action: "click", text: "1.0.4", texts: ["1.0.4"], exact: false }
        )
      );
      return steps;
    }

    if (/subscription-groups|subscription|in-app-purchase/i.test(url) || s.monthlyProduct) {
      if (s.addForReview && !s.draftSubmission) {
        steps.push(
          step(
            "iap-add-for-review",
            "Queue Monthly subscription",
            ["Click Add for Review."],
            "Queues the IAP; still attach on 1.0.4.",
            { action: "click", text: "Add for Review", texts: ["Add for Review"], exact: true }
          )
        );
      }
      if (!/version/i.test(url) || /subscription-groups/i.test(url)) {
        steps.push(
          step(
            "then-app-store",
            "Go to App Store tab",
            ["Click App Store, then 1.0.4."],
            "Attach IAP on the version page.",
            { action: "click", text: "App Store", texts: ["App Store"], exact: true }
          )
        );
        steps.push(
          step(
            "then-version-104",
            "Open 1.0.4",
            ["Click 1.0.4."],
            null,
            { action: "click", text: "1.0.4", texts: ["1.0.4"] }
          )
        );
      }
    }

    if (/version/i.test(url) || s.iapSection || s.rejected) {
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
              fill:
                "Terms of Use (EULA): https://www.mymotivelife.com/terms\nPrivacy Policy: https://www.mymotivelife.com/privacy",
            }
          )
        );
      }
      steps.push(
        step(
          "version-privacy-url",
          "Privacy Policy URL",
          ["Set Privacy Policy URL."],
          null,
          {
            action: "fill",
            text: "Privacy Policy URL",
            texts: ["Privacy Policy URL", "Privacy Policy"],
            fill: "https://www.mymotivelife.com/privacy",
          }
        )
      );
      steps.push(
        step(
          "version-attach-iap",
          "Attach subscription on this version",
          ["In-App Purchases and Subscriptions → +"],
          "Required for 2.1(b).",
          {
            action: "click",
            text: "In-App Purchases and Subscriptions",
            texts: ["In-App Purchases and Subscriptions", "In-App Purchases"],
          }
        )
      );
      steps.push(
        step(
          "version-iap-plus",
          "Add IAP with +",
          ["Click + next to In-App Purchases and Subscriptions."],
          null,
          { action: "click", text: "+", texts: ["+", "Add"] }
        )
      );
      if (String(s.buildNumber || "") !== "14") {
        steps.push(
          step(
            "version-build",
            "Select build 14",
            ["Build → 1.0.4 (14)."],
            "Not build 12.",
            { action: "click", text: "Build", texts: ["Build", "1.0.4 (14)", "(14)"] }
          )
        );
      }
      steps.push(
        step(
          "version-submit",
          "Submit version 1.0.4",
          ["Add for Review / Update Review."],
          "Stay on 1.0.4.",
          {
            action: "click",
            text: "Add for Review",
            texts: ["Add for Review", "Update Review", "Submit for Review"],
          }
        )
      );
    }

    if (steps.length === 0) {
      const find = window.__MOTIVELIFE_ASC_FIND__;
      if (find?.({ text: "1.0.4", texts: ["1.0.4"] })) {
        steps.push(
          step("open-104", "Open 1.0.4", ["Click 1.0.4."], null, {
            action: "click",
            text: "1.0.4",
            texts: ["1.0.4"],
          })
        );
      } else if (find?.({ text: "App Store", texts: ["App Store"], exact: true })) {
        steps.push(
          step("open-app-store", "Open App Store", ["Click App Store."], null, {
            action: "click",
            text: "App Store",
            texts: ["App Store"],
            exact: true,
          })
        );
      } else {
        steps.push(
          step(
            "generic",
            "Open Subscriptions or 1.0.4",
            ["Subscriptions, or App Store → 1.0.4."],
            null,
            { action: "click", text: "Subscriptions", texts: ["Subscriptions", "App Store", "1.0.4"] }
          )
        );
      }
    }

    return steps;
  };
})();
