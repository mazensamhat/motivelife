/**
 * MotiveLife ASC next-step engine — completion-aware, no loops.
 * Stay on version 1.0.4 — do not create 1.0.5.
 *
 * Rules:
 * - Only emit INCOMPLETE steps (skip what’s already done on the page).
 * - Build picker is its own mode — never “go back to 1.0.4” from there.
 * - Version / build-picker never point at the left-rail version row.
 */
(function () {
  function step(id, title, clicks, why, coach) {
    return { id, title, clicks, why, coach };
  }

  function modeOf(snapshot) {
    const s = snapshot.signals || {};
    if (s.pageMode) return s.pageMode;
    const url = snapshot.url || "";
    if (/\/reviewsubmissions/i.test(url)) return "review-submissions";
    if (/\/ios\/version\//i.test(url) || /\/version\//i.test(url)) return "version";
    if (/\/iaps\b/i.test(url) || /\/in-app-purchases/i.test(url)) return "iap-catalog";
    if (/subscription-groups|\/subscriptions/i.test(url)) return "subscriptions";
    return "other";
  }

  function versionChecklist(s) {
    const steps = [];

    // Apple HIDES "In-App Purchases and Subscriptions" on the version form until
    // the subscription is Ready to Submit (and sometimes while Ready for Review).
    if (!s.iapAttachedOnVersion && !s.iapSectionOnVersionForm) {
      steps.push(
        step(
          "make-sub-ready",
          "IAP section is missing — open Subscriptions first",
          [
            "Apple hides “In-App Purchases and Subscriptions” on this version page until the subscription is Ready to Submit.",
            "Click Monetization → Subscriptions (left sidebar).",
            "Open Monthly / MotiveLife Pro. Fix any Missing Metadata until status is Ready to Submit.",
            "Then return to 1.0.4, refresh, and the IAP section should appear between Build and Game Center.",
          ],
          "Not a scroll bug — the section is often not in the DOM at all.",
          {
            action: "click",
            find: "rail-subscriptions",
            text: "Subscriptions",
            texts: ["Subscriptions"],
            where: "rail",
          }
        )
      );
      return steps.slice(0, 1);
    }

    if (!s.iapAttachedOnVersion) {
      steps.push(
        step(
          "version-iap-attach",
          "Attach subscription on this version form",
          [
            "Scroll to “In-App Purchases and Subscriptions” (between Build and Game Center).",
            "Click + and add Monthly / MotiveLife Pro.",
          ],
          "Required for Apple 2.1(b).",
          { action: "click", find: "version-iap-attach", text: "In-App Purchases and Subscriptions" }
        )
      );
    }

    if (!s.descriptionHasTerms && !s.privacyTermsInDescriptionHint) {
      steps.push(
        step(
          "version-description-terms",
          "Paste Terms into Description",
          ["Append the Terms + Privacy lines at the end of Description, then Save."],
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

    if (!s.privacyUrlOk) {
      steps.push(
        step(
          "version-privacy-url",
          "Set Privacy Policy URL",
          ["Privacy Policy URL = https://www.mymotivelife.com/privacy — then Save."],
          "Only the URL field — not Build, not the sidebar.",
          {
            action: "fill",
            text: "Privacy Policy URL",
            texts: ["Privacy Policy URL"],
            exact: false,
            where: "main",
            fill: "https://www.mymotivelife.com/privacy",
          }
        )
      );
    }

    // Skip build hunting when version is already Ready for Review (build is selected).
    const needBuild =
      !s.buildIs14 &&
      String(s.buildNumber || "") !== "14" &&
      !s.readyForReview;
    if (needBuild) {
      steps.push(
        step(
          "version-build",
          "Select build 1.0.4 (14) on this form",
          [
            "Scroll to the Build section on THIS version page.",
            "Choose 1.0.4 (14). Do not open TestFlight / iOS builds elsewhere.",
          ],
          "Not build 12. Stay on the version form.",
          { action: "click", find: "version-build-select", text: "1.0.4 (14)" }
        )
      );
    }

    const save = window.__MOTIVELIFE_ASC_FIND__?.({
      text: "Save",
      texts: ["Save"],
      exact: true,
      where: "main",
      kinds: ["button"],
    });
    if (save?.el && !save.disabled) {
      steps.push(
        step("version-save", "Save changes", ["Click Save (top right)."], null, {
          action: "click",
          text: "Save",
          texts: ["Save"],
          exact: true,
          where: "main",
          kinds: ["button"],
        })
      );
    }

    steps.push(
      step(
        "version-submit",
        "Submit this version",
        ["Click Add for Review or Update Review (top right)."],
        "You are already on 1.0.4 — never click the sidebar to “go back”.",
        {
          action: "click",
          text: "Add for Review",
          texts: ["Add for Review", "Update Review", "Submit for Review"],
          where: "main",
        }
      )
    );

    // Only the next incomplete action — prevents Privacy ↔ Build pile-ups
    return steps.slice(0, 1);
  }

  window.__MOTIVELIFE_ASC_STEPS__ = function stepsFor(snapshot) {
    const s = snapshot.signals || {};
    const mode = modeOf(snapshot);

    if (s.localizationModal) {
      return [
        step(
          "close-localization",
          "Close localization popup",
          ["Click Cancel."],
          "English (U.S.) already exists.",
          { action: "click", text: "Cancel", texts: ["Cancel"], exact: true, where: "main" }
        ),
      ];
    }

    // Build picker: ONLY pick (14). Never send user to sidebar 1.0.4.
    if (mode === "build-picker" || s.buildPickerOpen) {
      return [
        step(
          "pick-build-14",
          "Choose build 1.0.4 (14)",
          ["Click 1.0.4 (14) in this build list, then Done/Add if asked."],
          "This IS the right screen — do not go “back” to 1.0.4 in the sidebar.",
          { action: "click", find: "build-14", text: "1.0.4 (14)", texts: ["1.0.4 (14)", "(14)"] }
        ),
      ];
    }

    // Left the version form (TestFlight / builds). Use the rail version row to return.
    if (mode === "off-version") {
      return [
        step(
          "return-to-version",
          "Return to version 1.0.4 form",
          [
            "You left the version page (often via a Builds/TestFlight link).",
            "Click 1.0.4 in the left rail to return — then stay on that form.",
          ],
          "Do not hunt for Privacy URL here.",
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

    if (mode === "version") {
      return versionChecklist(s);
    }

    // App Review / submissions list — NOT the version form. Point mouse at rail 1.0.4.
    if (mode === "review-submissions") {
      return [
        step(
          "review-go-version",
          "WRONG PAGE — click 1.0.4 in the left sidebar",
          [
            "You are on App Review. The mouse should outline 1.0.4 Ready for Review on the left.",
            "Click that. Wait until the URL contains /version/ (version form).",
            "Then scroll to In-App Purchases and Subscriptions → +.",
          ],
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
          ["Close the Draft Submission panel (X)."],
          "Attach IAP on the version form next.",
          { action: "close", find: "close-drawer", text: "Close", texts: ["Close", "Cancel"] }
        ),
        step(
          "go-version-from-draft",
          "Open version 1.0.4",
          ["Click 1.0.4 in the left rail."],
          null,
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

    if (mode === "iap-catalog") {
      return [
        step(
          "iap-catalog-go-version",
          "Open version 1.0.4 (leave catalog)",
          ["Click 1.0.4 in the left sidebar."],
          "Attach on the VERSION form, not this catalog.",
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

    if (mode === "subscriptions") {
      const steps = [];
      if (s.addForReview) {
        steps.push(
          step(
            "iap-add-for-review",
            "Queue Monthly subscription",
            ["Click Add for Review."],
            null,
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
          ["Click 1.0.4 in the left rail."],
          null,
          {
            action: "click",
            find: "rail-version-104",
            text: "1.0.4",
            texts: ["1.0.4 Ready for Review", "1.0.4 Rejected", "1.0.4"],
            where: "rail",
          }
        )
      );
      return steps;
    }

    // Soft fallback ONLY when the version form is actually on screen (not sidebar text)
    if (mode === "version" || (s.iapSection && /\/version\//i.test(snapshot.url || ""))) {
      return versionChecklist(s);
    }

    const url = snapshot.url || "";
    if (/appstoreconnect\.apple\.com/i.test(url)) {
      return [
        step(
          "go-version",
          "Open version 1.0.4",
          ["Click 1.0.4 in the left sidebar."],
          null,
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

    // Any other website: report-only (Cursor reads live feed and replies in chat)
    return [
      step(
        "generic-report",
        "Page reported to Cursor",
        [
          "Stay on this tab. Status must say LIVE OK.",
          "If LIVE FAIL — Options → set the shared secret, then Report now.",
        ],
        "Works on any https page.",
        null
      ),
    ];
  };
})();
