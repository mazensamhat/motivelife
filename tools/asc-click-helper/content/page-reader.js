/**
 * Reads App Store Connect: inventory + precise findControl.
 * Supports where:"main"|"rail" so version steps never hit Monetization sidebar.
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

  /** Left ASC rail / nav — must not be used for version-page IAP attach targets. */
  function isRail(el) {
    if (!el || !(el instanceof Element)) return false;
    if (el.closest("nav, [role='navigation'], aside, [class*='sidebar'], [class*='Sidebar']"))
      return true;
    const r = el.getBoundingClientRect();
    // ASC left column is typically under ~300px wide
    if (r.left < 280 && r.right < 340 && r.width < 320) return true;
    return false;
  }

  function isMain(el) {
    return !isRail(el);
  }

  function whereOk(el, where) {
    if (!where || where === "any") return true;
    if (where === "main") return isMain(el);
    if (where === "rail") return isRail(el);
    return true;
  }

  function labelFor(el) {
    const aria = el.getAttribute("aria-label");
    if (aria) return norm(aria);
    if (el.id) {
      try {
        const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lab) return norm(lab.innerText || lab.textContent);
      } catch {
        /* ignore */
      }
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
    const row = el.closest(
      "[class*='row'], [class*='Row'], [class*='field'], [class*='Field'], li, section, div"
    );
    if (row) {
      const heading = row.querySelector(
        "label, h1, h2, h3, h4, legend, [class*='label'], [class*='Label']"
      );
      if (heading && heading !== el) {
        const t = norm(heading.innerText || heading.textContent);
        if (t && t.length < 80) return t;
      }
    }
    return norm(el.getAttribute("placeholder") || el.getAttribute("name") || "");
  }

  function ownText(el) {
    if (el.matches("input, textarea, select")) return labelFor(el) || norm(el.value);
    const clone = el.cloneNode(true);
    clone.querySelectorAll("script, style, svg").forEach((n) => n.remove());
    let t = norm(clone.innerText || clone.textContent);
    if (t.length > 100) {
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
    if (/^h[1-6]$/.test(tag) || tag === "legend") return "heading";
    if (tag === "a") return "link";
    if (tag === "button" || el.getAttribute("role") === "button") return "button";
    if (el.getAttribute("role") === "tab") return "tab";
    if (el.getAttribute("role") === "menuitem") return "menuitem";
    return "clickable";
  }

  function pageMode(url) {
    const u = url || location.href;
    if (/\/ios\/version\//i.test(u) || /\/version\//i.test(u)) return "version";
    if (/\/iaps\b/i.test(u) || /\/in-app-purchases/i.test(u)) return "iap-catalog";
    if (/subscription-groups|\/subscriptions/i.test(u)) return "subscriptions";
    return "other";
  }

  function draftDrawerOpen() {
    const nodes = Array.from(document.querySelectorAll("h1,h2,h3,[role='heading'],div,span"));
    return nodes.some((el) => {
      if (!visible(el)) return false;
      const t = norm(el.textContent || "");
      return /^Draft Submission$/i.test(t) || (t.length < 40 && /^Draft Submission/i.test(t));
    });
  }

  function inventory({ inViewOnly = false, includeHeadings = false } = {}) {
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
    ];
    if (includeHeadings) sels.push("h1", "h2", "h3", "h4", "legend");

    const out = [];
    const seen = new Set();

    for (const el of document.querySelectorAll(sels.join(","))) {
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
      if ((text || "").length > 90 && kindOf(el) !== "textarea" && kindOf(el) !== "input") continue;

      out.push({
        el,
        kind: kindOf(el),
        label: label || text,
        text: text || label,
        disabled: !!(el.disabled || el.getAttribute("aria-disabled") === "true"),
        rail: isRail(el),
        rect: r,
      });
    }
    return out;
  }

  function scoreMatch(item, w, spec, preferFill) {
    const hay = normKey(`${item.label} ${item.text}`);
    const text = normKey(item.text);
    const label = normKey(item.label);
    let score = 0;
    if (hay === w || text === w) score = 200;
    else if (label === w) score = 180;
    else if (spec.exact) return -1;
    else if (text.includes(w) && text.length < w.length + 24) score = 140;
    else if (hay.includes(w)) score = 100 + Math.min(40, w.length);
    else return -1;

    score -= Math.min(50, Math.floor(hay.length / 8));
    const r = item.rect;
    if (r.top >= 0 && r.bottom <= window.innerHeight) score += 25;
    else if (r.top < window.innerHeight && r.bottom > 0) score += 10;
    if (!preferFill && (item.kind === "button" || item.kind === "link")) score += 20;
    if (preferFill && (item.kind === "input" || item.kind === "textarea")) score += 30;
    if (spec.where === "main" && !item.rail) score += 40;
    if (spec.where === "rail" && item.rail) score += 40;
    // Strongly prefer exact longer phrases
    if (w.length > 20 && (hay === w || text === w)) score += 50;
    return score;
  }

  /**
   * Version page: section "In-App Purchases and Subscriptions" in MAIN only (+ nearby).
   * Never the left-rail Monetization → In-App Purchases link (that causes the loop).
   */
  function findVersionIapAttach() {
    const heads = Array.from(document.querySelectorAll("h1,h2,h3,h4,legend,div,span")).filter((el) => {
      if (!visible(el) || isRail(el)) return false;
      const t = norm(el.innerText || el.textContent || "");
      return (
        t === "In-App Purchases and Subscriptions" ||
        /^In-App Purchases and Subscriptions$/i.test(t)
      );
    });
    if (!heads.length) return null;
    const head = heads.sort((a, b) => (a.innerText || "").length - (b.innerText || "").length)[0];
    const root =
      head.closest("section, article, [class*='section'], [class*='Section']") ||
      head.parentElement ||
      head;
    const plus = Array.from(root.querySelectorAll("button, a, [role='button']")).find((b) => {
      if (!visible(b) || isRail(b)) return false;
      const t = norm(b.getAttribute("aria-label") || b.innerText || "");
      return t === "+" || /^add$/i.test(t) || /add.*in-app|add.*subscription/i.test(t);
    });
    if (plus) {
      return {
        el: plus,
        kind: kindOf(plus),
        label: "Add In-App Purchase on version",
        text: norm(plus.getAttribute("aria-label") || plus.innerText || "+"),
        disabled: !!plus.disabled,
        rail: false,
        rect: plus.getBoundingClientRect(),
      };
    }
    return {
      el: head,
      kind: "heading",
      label: "In-App Purchases and Subscriptions",
      text: "In-App Purchases and Subscriptions",
      disabled: false,
      rail: false,
      rect: head.getBoundingClientRect(),
    };
  }

  function findControl(spec) {
    if (!spec) return null;
    if (spec.find === "close-drawer") return findCloseDrawer();
    if (spec.find === "version-iap-attach") return findVersionIapAttach();

    const wants = [spec.text, ...(spec.texts || [])]
      .filter(Boolean)
      .map(normKey)
      .filter(Boolean);
    if (!wants.length) return null;

    const preferFill = spec.action === "fill";
    const kinds =
      spec.kinds ||
      (preferFill
        ? ["input", "textarea", "select"]
        : ["button", "link", "tab", "menuitem", "clickable", "heading"]);

    const items = inventory({
      inViewOnly: false,
      includeHeadings: kinds.includes("heading"),
    });
    let best = null;
    let bestScore = -1;

    for (const item of items) {
      if (item.disabled && spec.action !== "fill") continue;
      if (!whereOk(item.el, spec.where)) continue;
      if (kinds.length && !kinds.includes(item.kind)) continue;
      // Never let version-page "In-App Purchases" match the rail catalog link
      if (
        spec.where === "main" &&
        item.rail &&
        /in-app purchases/i.test(item.text || item.label || "")
      ) {
        continue;
      }

      for (const w of wants) {
        const score = scoreMatch(item, w, spec, preferFill);
        if (score > bestScore) {
          bestScore = score;
          best = item;
        }
      }
    }

    if (!best && preferFill) {
      for (const w of wants) {
        const labels = Array.from(
          document.querySelectorAll("label, h1, h2, h3, h4, span, div")
        ).filter(
          (el) =>
            visible(el) &&
            whereOk(el, spec.where || "main") &&
            normKey(el.innerText || "").includes(w) &&
            (el.innerText || "").length < 80
        );
        for (const lab of labels) {
          const root =
            lab.closest("section, li, [class*='field'], [class*='Field'], div") || lab.parentElement;
          const field = root?.querySelector("input:not([type='hidden']), textarea, select");
          if (field && visible(field) && whereOk(field, spec.where || "main")) {
            return {
              el: field,
              kind: kindOf(field),
              label: norm(lab.innerText),
              text: norm(lab.innerText),
              disabled: !!field.disabled,
              rail: isRail(field),
              rect: field.getBoundingClientRect(),
            };
          }
        }
      }
    }

    return best;
  }

  function findCloseDrawer() {
    if (!draftDrawerOpen()) return null;
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
    const draft = Array.from(document.querySelectorAll("h1,h2,h3,div,span")).find(
      (el) =>
        visible(el) &&
        /draft submission/i.test(el.textContent || "") &&
        (el.textContent || "").length < 40
    );
    if (draft) {
      const root = draft.closest('[role="dialog"], aside, section, div') || document.body;
      const near = closes.find((c) => root.contains(c.el));
      if (near) return near;
    }
    return closes[closes.length - 1] || null;
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
  window.__MOTIVELIFE_ASC_PAGE_MODE__ = pageMode;

  window.__MOTIVELIFE_ASC_READ__ = function readAscPage() {
    const url = location.href;
    const path = location.pathname + location.search + location.hash;
    const mode = pageMode(url);
    const drawer = draftDrawerOpen();
    const controls = inventory({ inViewOnly: false }).slice(0, 60).map((c) => ({
      kind: c.kind,
      label: c.label,
      text: c.text,
      disabled: c.disabled,
      rail: c.rail,
    }));

    return {
      capturedAt: new Date().toISOString(),
      url,
      path,
      title: document.title || "",
      headings: headings(),
      buttons: controls
        .filter((c) => c.kind === "button" || c.kind === "link")
        .map((c) => c.text || c.label),
      controls,
      banners: banners(),
      signals: {
        pageMode: mode,
        addForReview: hasText(/Add for Review/i),
        submitForReview: hasText(/Submit for Review/i),
        updateReview: !!findControl({
          text: "Update Review",
          texts: ["Update Review"],
          exact: true,
          where: "main",
        }),
        unableToSubmit: hasText(/Unable to Submit for Review/i),
        // Catalog copy ≠ draft drawer. Only true when the drawer heading is open.
        mustSubmitWithVersion: drawer && hasText(/add an app version|submitted with a new app version/i),
        mustSubmitWithGroup: hasText(/submitted with its subscription group/i),
        draftSubmission: drawer,
        draftDrawerOpen: drawer,
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
