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
    if (/\/ios\/version\//i.test(url) || /\/version\//i.test(url)) return "version";
    if (/\/iaps\b/i.test(url) || /\/in-app-purchases/i.test(url)) return "iap-catalog";
    if (/subscription-groups|\/subscriptions/i.test(url)) return "subscriptions";
    return "other";
  }

  function versionChecklist(s) {
    const steps = [];

    if (!s.iapAttachedOnVersion) {
      steps.push(
        step(
          "version-iap-attach",
          "Attach subscription on this version form",
          [
            "Scroll to “In-App Purchases and Subscriptions”.",
            "Click + and add Monthly / MotiveLife Pro.",
            "Do NOT use Monetization → In-App Purchases in the sidebar.",
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
    }

    if (!s.buildIs14 && String(s.buildNumber || "") !== "14") {
      steps.push(
        step(
          "version-build",
          "Select build 1.0.4 (14)",
          [
            "In the Build section, choose 1.0.4 (14).",
            "If a build list opens, click 1.0.4 (14) — stay in this flow (don’t use the sidebar).",
          ],
          "Not build 12.",
          { action: "click", find: "version-build-select", text: "1.0.4 (14)" }
        )
      );
    }

    // Save if dirty
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
        "You are already on 1.0.4 — never click the sidebar version row to “go back”.",
        {
          action: "click",
          text: "Add for Review",
          texts: ["Add for Review", "Update Review", "Submit for Review"],
          where: "main",
        }
      )
    );

    return steps;
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

    if (mode === "version") {
      return versionChecklist(s);
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
            text: "1.0.4",
            texts: ["1.0.4 Ready for Review", "1.0.4 Rejected", "1.0.4"],
            where: "rail",
          }
        )
      );
      return steps;
    }

    // Soft fallback: if version form markers exist, use checklist (don’t bounce)
    if (s.iapSection || s.readyForReview || s.rejected) {
      return versionChecklist(s);
    }

    return [
      step(
        "go-version",
        "Open version 1.0.4",
        ["Click 1.0.4 in the left sidebar."],
        null,
        {
          action: "click",
          text: "1.0.4",
          texts: ["1.0.4 Ready for Review", "1.0.4 Rejected", "1.0.4"],
          where: "rail",
        }
      ),
    ];
  };
})();
