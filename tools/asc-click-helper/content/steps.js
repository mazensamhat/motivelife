/**
 * MotiveLife App Store Connect next-step engine (Jul 23, 2026 rejection flow).
 * Stay on version 1.0.4 — do not create 1.0.5.
 */
(function () {
  function step(id, title, clicks, why) {
    return { id, title, clicks, why };
  }

  window.__MOTIVELIFE_ASC_STEPS__ = function stepsFor(snapshot) {
    const s = snapshot.signals || {};
    const url = snapshot.url || "";
    const steps = [];

    // Localization modal open — cancel it
    if (s.localizationModal) {
      steps.push(
        step(
          "close-localization",
          "Close the localization popup",
          [
            "Click Cancel on “Add App Store Localization” (Save is gray if nothing changed — that’s fine).",
            "English (U.S.) MotiveLife Pro should already be in the Localization table.",
          ],
          "You don’t need a new localization if English (U.S.) already exists."
        )
      );
    }

    // IAP-only draft submission drawer — wrong place to submit
    if (s.draftSubmission && (s.unableToSubmit || s.mustSubmitWithVersion)) {
      steps.push(
        step(
          "close-iap-draft",
          "Close this Draft Submission panel — don’t submit IAP alone",
          [
            "Click the X to close Draft Submission.",
            "Yellow box is expected: first subscription must go with an app version.",
          ],
          "Apple will not enable Submit here. Attach IAP to version 1.0.4 instead."
        )
      );
      steps.push(
        step(
          "go-version",
          "Open version 1.0.4",
          [
            "Top nav: App Store (or Distribution → App Store).",
            "Open iOS app MotiveLife / Motivelife.ai.",
            "Open version 1.0.4 (Rejected) — do NOT create 1.0.5.",
          ],
          "IAP must be submitted with the app binary version."
        )
      );
      return steps;
    }

    // On subscription product page
    if (/subscription|in-app-purchase|iap/i.test(url) || s.monthlyProduct) {
      if (s.addForReview && !s.draftSubmission) {
        steps.push(
          step(
            "iap-add-for-review",
            "Queue the Monthly subscription",
            [
              "Confirm Product ID motivelife_pro_monthly, duration 1 month, English localization MotiveLife Pro.",
              "Confirm Review screenshot is present.",
              "Click blue Add for Review (top right).",
            ],
            "This only queues the IAP — you still attach it to 1.0.4."
          )
        );
      }
      if (!/version/i.test(url)) {
        steps.push(
          step(
            "then-version-page",
            "Then open version 1.0.4",
            [
              "Go to App Store → iOS → version 1.0.4 (Rejected).",
              "Scroll to In-App Purchases and Subscriptions → click +.",
              "Select Monthly / MotiveLife Pro (and the subscription group if shown).",
              "Confirm it appears on the 1.0.4 page.",
            ],
            "This is the step Apple means by “submit with an app version”."
          )
        );
      }
    }

    // Version page
    if (/version|ios.*app/i.test(url) || s.iapSection || s.rejected) {
      steps.push(
        step(
          "version-attach-iap",
          "On 1.0.4: attach IAP if missing",
          [
            "Find In-App Purchases and Subscriptions.",
            "If Monthly / MotiveLife Pro is not listed → click + → select it.",
            "If already listed → skip.",
          ],
          "2.1(b) fails if the product isn’t on this version."
        )
      );
      steps.push(
        step(
          "version-build",
          "Select build 14",
          [
            "Build section → select 1.0.4 (14) after EAS submit finishes.",
            "Do not leave build 12 selected.",
          ],
          "Disclosure + cookie fixes are in build 14."
        )
      );
      steps.push(
        step(
          "version-metadata",
          "Metadata for 3.1.2(c)",
          [
            "Privacy Policy URL = https://www.mymotivelife.com/privacy",
            "In Description add:\nTerms of Use (EULA): https://www.mymotivelife.com/terms\nPrivacy Policy: https://www.mymotivelife.com/privacy",
          ],
          "Apple requires Terms in metadata as well as in-app."
        )
      );
      steps.push(
        step(
          "version-submit",
          "Submit the VERSION (not the IAP drawer)",
          [
            "Paste Review Notes from docs/APP_STORE_REJECT_2026-07-23.md into App Review Information.",
            "Click Add for Review / Update Review / Submit for Review on the 1.0.4 page.",
          ],
          "Stay on 1.0.4 Rejected → Update Review."
        )
      );
    }

    if (steps.length === 0) {
      steps.push(
        step(
          "generic",
          "Navigate to the right ASC surface",
          [
            "If fixing IAP: Monetization → Subscriptions → Monthly (motivelife_pro_monthly).",
            "If submitting: App Store → version 1.0.4 → attach IAP → build 14 → Update Review.",
            "Click “Copy status for Cursor” and paste into Cursor chat.",
          ],
          "Helper will get more specific once you’re on a subscription or version page."
        )
      );
    }

    return steps;
  };
})();
