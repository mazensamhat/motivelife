/**
 * MotiveLife ASC next-step engine — completion-aware, no loops.
 * Stay on version 1.0.4 — do not create 1.0.5.
 *
 * Hard rules from real ASC sessions:
 * - NEVER point at sidebar Monetization → In-App Purchases (catalog loop).
 * - NEVER bounce Subscriptions ↔ 1.0.4 using sidebar "Ready for Review".
 * - If Build shows (12) and (14) is not uploaded yet → wait for EAS, stay on version.
 * - Only go to Subscriptions when product is not Ready to Submit (main canvas).
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
    // 1) Build first — user's ASC showed (12). Do not send them to Monetization.
    if (!s.buildIs14) {
      if (s.buildFourteenListed) {
        return [
          step(
            "version-build",
            "Select build 1.0.4 (14) on this form",
            [
              "Stay on this version page.",
              "Scroll to Build → choose 1.0.4 (14).",
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
            "This page still shows build 12 — build 14 is not uploaded yet.",
            "Stay on 1.0.4. Do NOT click In-App Purchases or Subscriptions in the sidebar.",
            "When EAS finishes: refresh this page → Build → select 1.0.4 (14).",
          ],
          "We never created build 14 until now — there is nothing to select.",
          { action: "click", find: "version-build-select", text: "Build" }
        ),
      ];
    }

    // 2) Attach IAP only if the VERSION FORM section exists (never sidebar catalog)
    if (!s.iapAttachedOnVersion && s.iapSectionOnVersionForm) {
      return [
        step(
          "version-iap-attach",
          "Attach MotiveLife Pro on THIS version form",
          [
            "Scroll to “In-App Purchases and Subscriptions” (on this page, not the sidebar).",
            "Click + → add Monthly / MotiveLife Pro.",
          ],
          "Sidebar In-App Purchases is the wrong place — that was the loop.",
          { action: "click", find: "version-iap-attach", text: "In-App Purchases and Subscriptions" }
        ),
      ];
    }

    // 3) Section missing — do NOT loop. Only open Subscriptions once if never visited.
    if (!s.iapAttachedOnVersion && !s.iapSectionOnVersionForm) {
      if (s.subReadyHint || s.subProductReady || s.visitedSubs) {
        return [
          step(
            "iap-section-missing-stay",
            "Stay on 1.0.4 — IAP section still hidden",
            [
              "Do NOT click sidebar In-App Purchases or Subscriptions again.",
              "Ctrl+Shift+R this tab once.",
              "If “In-App Purchases and Subscriptions” still never appears between Build and Game Center, the subscription is not Ready to Submit yet — open Subscriptions ONCE, fix Missing Metadata / App Review Screenshot, Save, then come back.",
            ],
            "Endless Monetization clicks will not create this section.",
            null
          ),
        ];
      }
      return [
        step(
          "check-sub-ready-once",
          "One check: Subscriptions → Ready to Submit?",
          [
            "Apple hides the version IAP section until the Monthly product is Ready to Submit.",
            "Click Monetization → Subscriptions (not In-App Purchases).",
            "Open MotiveLife Pro Monthly. If Missing Metadata → fix App Review Screenshot → Save.",
            "When status is Ready to Submit, return to 1.0.4 and refresh.",
          ],
          "One trip only — not a bounce loop.",
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
        ),
      ];
    }

    if (!s.privacyUrlOk) {
      return [
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
        ),
      ];
    }

    const save = window.__MOTIVELIFE_ASC_FIND__?.({
      text: "Save",
      texts: ["Save"],
      exact: true,
      where: "main",
      kinds: ["button"],
    });
    if (save?.el && !save.disabled) {
      return [
        step("version-save", "Save changes", ["Click Save (top right)."], null, {
          action: "click",
          text: "Save",
          texts: ["Save"],
          exact: true,
          where: "main",
          kinds: ["button"],
        }),
      ];
    }

    return [
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
      ),
    ];
  }

  function subscriptionsChecklist(s) {
    // If Apple blocks solo IAP submit — close draft, go to version. Do NOT Add for Review again.
    if (s.unableToSubmit || s.mustSubmitWithVersion || s.draftDrawerOpen) {
      return [
        step(
          "close-iap-draft",
          "Close Draft — cannot submit subscription alone",
          [
            "Yellow Unable to Submit is normal for a first subscription.",
            "Close this draft (X).",
            "Then open version 1.0.4 and attach there after build 14 exists.",
          ],
          "Stop clicking Add for Review on the subscription.",
          { action: "close", find: "close-drawer", text: "Close", texts: ["Close", "Cancel"] }
        ),
      ];
    }

    if (s.subProductReady || s.subReadyToSubmit) {
      return [
        step(
          "subs-go-version",
          "Subscription Ready to Submit — open 1.0.4",
          [
            "Click 1.0.4 in the left rail.",
            "Hard-refresh.",
            "If build is still 12, wait for EAS 14 — do not open In-App Purchases sidebar.",
          ],
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

    if (!s.subProductDetail) {
      return [
        step(
          "subs-open-monthly",
          "Click MotiveLife Pro (Monthly)",
          [
            "Stay on Subscriptions.",
            "Click MotiveLife Pro / Monthly in the MAIN list.",
            "Do not click 1.0.4 or In-App Purchases yet.",
          ],
          null,
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
          "Upload App Review Screenshot",
          [
            "Scroll to App Review Screenshot.",
            "Upload iPhone shot of Settings → MotiveLife Pro (price + Terms + Privacy).",
            "Save until Ready to Submit.",
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
        ["Fill incomplete fields → Save → wait for Ready to Submit."],
        null,
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

    if (mode === "build-picker" || s.buildPickerOpen) {
      const has14 = window.__MOTIVELIFE_ASC_FIND__?.({
        find: "build-14",
        text: "1.0.4 (14)",
        texts: ["1.0.4 (14)", "(14)"],
      });
      if (has14?.el) {
        return [
          step(
            "pick-build-14",
            "Choose build 1.0.4 (14)",
            ["Click 1.0.4 (14) in this list, then Done/Add if asked."],
            "Do not go back via the sidebar.",
            { action: "click", find: "build-14", text: "1.0.4 (14)", texts: ["1.0.4 (14)", "(14)"] }
          ),
        ];
      }
      return [
        step(
          "build-14-not-uploaded",
          "Build 14 is not in this list yet",
          [
            "Close this picker.",
            "Wait for EAS to finish uploading 1.0.4 (14).",
            "Do not pick build 12 again.",
          ],
          null,
          { action: "click", text: "Cancel", texts: ["Cancel", "Done", "Close"], where: "main" }
        ),
      ];
    }

    if (mode === "off-version") {
      return [
        step(
          "return-to-version",
          "Return to version 1.0.4 form",
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

    // Catalog = wrong place. Always leave.
    if (mode === "iap-catalog") {
      return [
        step(
          "iap-catalog-go-version",
          "WRONG PAGE — leave In-App Purchases catalog",
          [
            "You opened Monetization → In-App Purchases (catalog).",
            "That is NOT where you attach IAP to the version.",
            "Click 1.0.4 in the left sidebar and stay on the version form.",
          ],
          "This was the endless loop.",
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
      return subscriptionsChecklist(s);
    }

    if (mode === "version") {
      return versionChecklist(s);
    }

    if (mode === "review-submissions") {
      return [
        step(
          "review-read-then-version",
          "Read App Review, then open 1.0.4",
          [
            "Note Apple’s messages on this page.",
            "Then click 1.0.4 in the left rail to work the version form.",
            "Do not open Monetization → In-App Purchases.",
          ],
          null,
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
          ["Close the panel (X). Then open 1.0.4."],
          "Cannot submit first subscription alone.",
          { action: "close", find: "close-drawer", text: "Close", texts: ["Close", "Cancel"] }
        ),
      ];
    }

    const url = snapshot.url || "";
    if (/appstoreconnect\.apple\.com/i.test(url)) {
      return [
        step(
          "go-version",
          "Open version 1.0.4",
          ["Click 1.0.4 in the left sidebar. Do not open In-App Purchases."],
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

    return [
      step(
        "generic-report",
        "Page reported to Cursor",
        ["Stay on this tab. Status must say LIVE OK (stored)."],
        null,
        null
      ),
    ];
  };
})();
