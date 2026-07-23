/**
 * MotiveLife ASC next-step engine — page-mode aware (no 1.0.4 ↔ IAP catalog loop).
 * Stay on version 1.0.4 — do not create 1.0.5.
 */
(function () {
  function step(id, title, clicks, why, coach) {
    return { id, title, clicks, why, coach };
  }

  function modeOf(snapshot) {
    const s = snapshot.signals || {};
    if (s.pageMode) return s.pageMode;
    const url = snapshot.url || "";
    if (/\/ios\/version\//i.test(url) || /\/version\//i.test(url)) return "version";
    if (/\/iaps\b/i.test(url) || /\/in-app-purchases/i.test(url)) return "iap-catalog";
    if (/subscription-groups|\/subscriptions/i.test(url)) return "subscriptions";
    return "other";
  }

  window.__MOTIVELIFE_ASC_STEPS__ = function stepsFor(snapshot) {
    const s = snapshot.signals || {};
    const mode = modeOf(snapshot);
    const steps = [];

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

    // Real Draft Submission drawer only — not the IAP catalog educational copy.
    if (s.draftDrawerOpen || (s.draftSubmission && s.unableToSubmit)) {
      steps.push(
        step(
          "close-iap-draft",
          "Close Draft Submission",
          ["Close the Draft Submission panel (X)."],
          "Do not submit IAP alone — attach it on version 1.0.4.",
          { action: "close", find: "close-drawer", text: "Close", texts: ["Close", "Cancel"] }
        )
      );
      steps.push(
        step(
          "go-version-from-draft",
          "Open version 1.0.4",
          ["Click 1.0.4 Rejected in the left rail."],
          "IAP must ship with the app version.",
          { action: "click", text: "1.0.4", texts: ["1.0.4 Rejected", "1.0.4"], where: "rail" }
        )
      );
      return steps;
    }

    // IAP catalog (/iaps): ONLY leave to the version page. Never bounce back later via sidebar.
    if (mode === "iap-catalog") {
      steps.push(
        step(
          "iap-catalog-go-version",
          "Open version 1.0.4 (stay out of this catalog)",
          ["Click 1.0.4 Rejected in the left sidebar."],
          "Attach the subscription on the VERSION page, not here.",
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

    // Subscriptions product UI: queue then go to version — never to IAP catalog.
    if (mode === "subscriptions") {
      if (s.addForReview) {
        steps.push(
          step(
            "iap-add-for-review",
            "Queue Monthly subscription",
            ["Click Add for Review."],
            "Then open version 1.0.4 to attach it.",
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
          "Attach on the version page.",
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

    // VERSION PAGE — never point at left-rail "In-App Purchases" (that is the loop).
    if (mode === "version") {
      steps.push(
        step(
          "version-iap-attach",
          "Attach subscription ON THIS VERSION",
          [
            "Scroll the version form to “In-App Purchases and Subscriptions”.",
            "Click + there (not Monetization → In-App Purchases in the sidebar).",
          ],
          "Sidebar In-App Purchases leaves the version page — ignore it.",
          { action: "click", find: "version-iap-attach", text: "In-App Purchases and Subscriptions" }
        )
      );

      if (!s.privacyTermsInDescriptionHint) {
        steps.push(
          step(
            "version-description-terms",
            "Add Terms to Description",
            ["Paste Terms + Privacy into Description (main form)."],
            "Apple 3.1.2(c).",
            {
              action: "fill",
              text: "Description",
              texts: ["Description"],
              where: "main",
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
          ["Set Privacy Policy URL on this version form."],
          null,
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
            {
              action: "click",
              text: "Build",
              texts: ["Build", "1.0.4 (14)", "(14)"],
              where: "main",
            }
          )
        );
      }

      steps.push(
        step(
          "version-submit",
          "Submit version 1.0.4",
          ["Click Update Review (top right)."],
          "Stay on 1.0.4 — do not open the IAP catalog.",
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

    // Other pages: get onto 1.0.4 via the rail.
    steps.push(
      step(
        "go-version",
        "Open version 1.0.4",
        ["Click 1.0.4 Rejected in the left sidebar."],
        null,
        {
          action: "click",
          text: "1.0.4 Rejected",
          texts: ["1.0.4 Rejected", "1.0.4"],
          where: "rail",
        }
      )
    );
    return steps;
  };
})();
