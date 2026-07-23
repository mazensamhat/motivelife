/**
 * Reads App Store Connect: inventory of real clickable/fillable controls.
 * Coach uses findControl() so it points at what is actually on the page.
 */
(function () {
  function norm(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }

  function normKey(s) {
    return norm(s).toLowerCase();
  }

  function visible(el) {
    if (!el || !(el instanceof Element)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = window.getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none" || Number(st.opacity) === 0) return false;
    return true;
  }

  function labelFor(el) {
    const aria = el.getAttribute("aria-label");
    if (aria) return norm(aria);
    if (el.id) {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab) return norm(lab.innerText || lab.textContent);
    }
    const wrapped = el.closest("label");
    if (wrapped) return norm(wrapped.innerText || wrapped.textContent);
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const parts = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map((n) => norm(n.innerText || n.textContent))
        .filter(Boolean);
      if (parts.length) return parts.join(" ");
    }
    // ASC often puts the field name in a sibling / parent row
    const row = el.closest("[class*='row'], [class*='Row'], [class*='field'], [class*='Field'], li, section, div");
    if (row) {
      const heading = row.querySelector("label, h1, h2, h3, h4, legend, [class*='label'], [class*='Label']");
      if (heading && heading !== el) {
        const t = norm(heading.innerText || heading.textContent);
        if (t && t.length < 80) return t;
      }
    }
    return norm(el.getAttribute("placeholder") || el.getAttribute("name") || "");
  }

  function ownText(el) {
    // Prefer direct / leaf text, not huge containers
    if (el.matches("input, textarea, select")) return labelFor(el) || norm(el.value);
    const clone = el.cloneNode(true);
    clone.querySelectorAll("script, style, svg").forEach((n) => n.remove());
    let t = norm(clone.innerText || clone.textContent);
    if (t.length > 100) {
      // Try first text child only
      t = norm(
        Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent)
          .join(" ")
      );
    }
    return t || labelFor(el);
  }

  function kindOf(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "textarea") return "textarea";
    if (tag === "select") return "select";
    if (tag === "input") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (type === "checkbox" || type === "radio") return type;
      return "input";
    }
    if (tag === "a") return "link";
    if (tag === "button" || el.getAttribute("role") === "button") return "button";
    if (el.getAttribute("role") === "tab") return "tab";
    if (el.getAttribute("role") === "menuitem") return "menuitem";
    return "clickable";
  }

  /**
   * Live inventory of interactive controls currently on screen (or in DOM).
   * @returns {Array<{el: Element, kind: string, label: string, text: string, disabled: boolean, rect: DOMRect}>}
   */
  function inventory({ inViewOnly = false } = {}) {
    const sels = [
      "button",
      "a[href]",
      "[role='button']",
      "[role='tab']",
      "[role='link']",
      "[role='menuitem']",
      "input:not([type='hidden'])",
      "textarea",
      "select",
      "summary",
    ].join(",");

    const out = [];
    const seen = new Set();

    for (const el of document.querySelectorAll(sels)) {
      if (!visible(el) || seen.has(el)) continue;
      seen.add(el);
      const r = el.getBoundingClientRect();
      if (inViewOnly) {
        if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth)
          continue;
      }
      const text = ownText(el);
      const label = labelFor(el) || text;
      if (!text && !label) continue;
      // Skip giant nav wrappers mistaken as buttons
      if ((text || "").length > 90 && kindOf(el) !== "textarea" && kindOf(el) !== "input") continue;

      out.push({
        el,
        kind: kindOf(el),
        label: label || text,
        text: text || label,
        disabled: !!(el.disabled || el.getAttribute("aria-disabled") === "true"),
        rect: r,
      });
    }
    return out;
  }

  /**
   * @param {{
   *   texts?: string[],
   *   text?: string,
   *   exact?: boolean,
   *   kinds?: string[],
   *   find?: string,
   *   action?: string,
   * }} spec
   */
  function findControl(spec) {
    if (!spec) return null;
    if (spec.find === "close-drawer") return findCloseDrawer();

    const wants = [spec.text, ...(spec.texts || [])]
      .filter(Boolean)
      .map(normKey)
      .filter(Boolean);
    if (!wants.length) return null;

    const preferFill = spec.action === "fill";
    const kinds = spec.kinds ||
      (preferFill
        ? ["input", "textarea", "select"]
        : ["button", "link", "tab", "menuitem", "clickable"]);

    const items = inventory({ inViewOnly: false });
    let best = null;
    let bestScore = -1;

    for (const item of items) {
      if (item.disabled && spec.action !== "fill") continue;
      if (kinds.length && !kinds.includes(item.kind)) continue;

      const hay = normKey(`${item.label} ${item.text}`);
      if (!hay) continue;

      for (const w of wants) {
        let score = 0;
        if (hay === w) score = 200;
        else if (normKey(item.text) === w) score = 190;
        else if (normKey(item.label) === w) score = 180;
        else if (spec.exact) continue;
        else if (hay.includes(w)) score = 100 + Math.min(40, w.length);
        else continue;

        // Prefer compact leaf controls
        score -= Math.min(50, Math.floor(hay.length / 8));
        // Prefer in viewport
        const r = item.rect;
        if (r.top >= 0 && r.bottom <= window.innerHeight) score += 25;
        else if (r.top < window.innerHeight && r.bottom > 0) score += 10;
        // Prefer real buttons for clicks
        if (!preferFill && (item.kind === "button" || item.kind === "link")) score += 20;
        if (preferFill && (item.kind === "input" || item.kind === "textarea")) score += 30;

        if (score > bestScore) {
          bestScore = score;
          best = item;
        }
      }
    }

    // Fill fallback: find a label node, then nearest input
    if (!best && preferFill) {
      for (const w of wants) {
        const labels = Array.from(document.querySelectorAll("label, h1, h2, h3, h4, span, div")).filter(
          (el) => visible(el) && normKey(el.innerText || "").includes(w) && (el.innerText || "").length < 80
        );
        for (const lab of labels) {
          const root = lab.closest("section, li, [class*='field'], [class*='Field'], div") || lab.parentElement;
          const field = root?.querySelector("input:not([type='hidden']), textarea, select");
          if (field && visible(field)) {
            return {
              el: field,
              kind: kindOf(field),
              label: norm(lab.innerText),
              text: norm(lab.innerText),
              disabled: !!field.disabled,
              rect: field.getBoundingClientRect(),
            };
          }
        }
      }
    }

    return best;
  }

  function findCloseDrawer() {
    const closes = inventory().filter((i) => {
      const t = normKey(i.label + " " + i.text);
      return (
        i.kind === "button" &&
        (t === "close" ||
          t === "dismiss" ||
          t === "×" ||
          t === "x" ||
          t === "✕" ||
          /close|dismiss/.test(t) ||
          /close/i.test(i.el.getAttribute("aria-label") || ""))
      );
    });
    if (closes.length) {
      // Prefer close near Draft Submission
      const draft = Array.from(document.querySelectorAll("h1,h2,h3,div,span")).find(
        (el) => visible(el) && /draft submission/i.test(el.textContent || "") && (el.textContent || "").length < 40
      );
      if (draft) {
        const root = draft.closest('[role="dialog"], aside, section, div') || document.body;
        const near = closes.find((c) => root.contains(c.el));
        if (near) return near;
      }
      return closes[closes.length - 1];
    }
    return findControl({ text: "Cancel", texts: ["Cancel"], action: "click" });
  }

  function banners() {
    return Array.from(
      document.querySelectorAll(
        "[role='alert'], .banner, .alert, [class*='Banner'], [class*='alert'], [class*='Warning']"
      )
    )
      .map((el) => norm(el.innerText || el.textContent))
      .filter((t) => t.length > 12 && t.length < 500)
      .slice(0, 12);
  }

  function headings() {
    return Array.from(document.querySelectorAll("h1, h2, h3"))
      .map((el) => norm(el.innerText || el.textContent))
      .filter(Boolean)
      .slice(0, 20);
  }

  function hasText(re) {
    return re.test(document.body?.innerText || "");
  }

  window.__MOTIVELIFE_ASC_INVENTORY__ = inventory;
  window.__MOTIVELIFE_ASC_FIND__ = findControl;

  window.__MOTIVELIFE_ASC_READ__ = function readAscPage() {
    const url = location.href;
    const path = location.pathname + location.search + location.hash;
    const controls = inventory({ inViewOnly: false }).slice(0, 60).map((c) => ({
      kind: c.kind,
      label: c.label,
      text: c.text,
      disabled: c.disabled,
    }));

    return {
      capturedAt: new Date().toISOString(),
      url,
      path,
      title: document.title || "",
      headings: headings(),
      buttons: controls.filter((c) => c.kind === "button" || c.kind === "link").map((c) => c.text || c.label),
      controls,
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
        controlCount: controls.length,
      },
    };
  };
})();
