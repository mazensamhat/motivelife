/**
 * Reads App Store Connect DOM/URL into a structured snapshot (no passwords).
 */
(function () {
  function textOf(el) {
    return (el?.innerText || el?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function visibleButtons() {
    const nodes = Array.from(
      document.querySelectorAll("button, a[role='button'], [role='button']")
    );
    return nodes
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map((el) => textOf(el))
      .filter(Boolean)
      .filter((t) => t.length < 80)
      .slice(0, 40);
  }

  function banners() {
    const candidates = Array.from(
      document.querySelectorAll(
        "[role='alert'], .banner, .alert, [class*='Banner'], [class*='alert'], [class*='Warning']"
      )
    );
    return candidates
      .map(textOf)
      .filter((t) => t.length > 12 && t.length < 500)
      .slice(0, 12);
  }

  function headings() {
    return Array.from(document.querySelectorAll("h1, h2, h3"))
      .map(textOf)
      .filter(Boolean)
      .slice(0, 20);
  }

  function hasText(re) {
    return re.test(document.body?.innerText || "");
  }

  window.__MOTIVELIFE_ASC_READ__ = function readAscPage() {
    const url = location.href;
    const path = location.pathname + location.search + location.hash;
    return {
      capturedAt: new Date().toISOString(),
      url,
      path,
      title: document.title || "",
      headings: headings(),
      buttons: visibleButtons(),
      banners: banners(),
      signals: {
        addForReview: hasText(/Add for Review/i),
        submitForReview: hasText(/Submit for Review/i),
        updateReview: hasText(/Update Review|Submit for Review/i),
        unableToSubmit: hasText(/Unable to Submit for Review/i),
        mustSubmitWithVersion: hasText(/add an app version|submitted with a new app version/i),
        mustSubmitWithGroup: hasText(/submitted with its subscription group/i),
        draftSubmission: hasText(/Draft Submission/i),
        localizationModal: hasText(/Add App Store Localization/i),
        iapSection: hasText(/In-App Purchases and Subscriptions/i),
        prepareForSubmission: hasText(/Prepare for Submission/i),
        rejected: hasText(/\bRejected\b/i),
        monthlyProduct: hasText(/motivelife_pro_monthly|MotiveLife Pro/i),
        buildNumber: (document.body?.innerText || "").match(/\b1\.0\.4\s*\((\d+)\)/)?.[1] || null,
        privacyTermsInDescriptionHint: hasText(/Terms of Use \(EULA\)|mymotivelife\.com\/terms/i),
      },
    };
  };
})();
