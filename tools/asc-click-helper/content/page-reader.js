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
    if (el.closest("nav, [role='navigation'], aside, [class*='sidebar'], [class*='Sidebar'], [class*='SideNav']"))
      return true;
    const r = el.getBoundingClientRect();
    // ASC left column — allow a bit wider (some rows are ~300–380px)
    if (r.left < 360 && r.right < 420) return true;
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

  /**
   * Always find the left-rail 1.0.4 row so we can point the mouse there
   * when the user is on App Review / wrong page.
   */
  function findRailVersion104() {
    const sels =
      "a, button, [role='link'], [role='button'], [role='treeitem'], [role='menuitem'], li, span, div";
    let best = null;
    let bestScore = -1;

    for (const el of document.querySelectorAll(sels)) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      if (r.left > 420 || r.right < 8) continue;
      if (r.top < 48 || r.top > window.innerHeight) continue;

      const t = norm(el.innerText || el.getAttribute("aria-label") || "");
      if (!t || t.length > 70) continue;
      if (!/1\.0\.4/.test(t)) continue;
      if (/1\.0\.5|create new|new version/i.test(t)) continue;

      let score = 40;
      if (/ready for review/i.test(t)) score += 50;
      if (/rejected/i.test(t)) score += 25;
      if (/^1\.0\.4\b/i.test(t)) score += 20;
      if (/^(A|BUTTON)$/.test(el.tagName) || el.getAttribute("role") === "link") score += 35;
      if (r.left < 300) score += 15;
      score -= Math.min(25, Math.floor(t.length / 3));

      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }

    if (!best) return null;
    const clickable =
      best.closest("a, button, [role='link'], [role='button'], [role='treeitem'], [role='menuitem']") ||
      best;
    return {
      el: clickable,
      kind: kindOf(clickable),
      label: "1.0.4 Ready for Review",
      text: norm(clickable.innerText || clickable.getAttribute("aria-label") || "1.0.4"),
      disabled: false,
      rail: true,
      rect: clickable.getBoundingClientRect(),
    };
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
    if (buildPickerOpen()) return "build-picker";
    if (/\/reviewsubmissions/i.test(u) || /\/app-review/i.test(u)) return "review-submissions";
    // TestFlight / builds browser — user left the version form (often via a bad Build click)
    if (/\/testflight|\/builds\b|\/activity\b/i.test(u) && !/\/version\//i.test(u))
      return "off-version";
    if (/\/ios\/version\//i.test(u) || /\/version\//i.test(u)) return "version";
    if (looksLikeVersionForm()) return "version";
    if (/\/iaps\b/i.test(u) || /\/in-app-purchases/i.test(u)) return "iap-catalog";
    if (/subscription-groups|\/subscriptions/i.test(u)) return "subscriptions";
    return "other";
  }

  function looksLikeVersionForm() {
    const t = document.body?.innerText || "";
    return (
      /iOS App Version\s*1\.0\.4/i.test(t) ||
      (/Previews and Screenshots/i.test(t) && /Copyright/i.test(t) && /1\.0\.4/i.test(t))
    );
  }

  function buildPickerOpen() {
    const t = document.body?.innerText || "";
    if (/Select a Build|Choose a Build|Add Build/i.test(t) && /\(\d+\)/.test(t)) {
      const dlg = document.querySelector('[role="dialog"], [aria-modal="true"]');
      if (dlg && visible(dlg)) return true;
      // Some ASC build UIs are full-page sheets still under /version/
      if (/Builds?\b/i.test(t) && /1\.0\.4\s*\(\d+\)/i.test(t) && !/Previews and Screenshots/i.test(t))
        return true;
    }
    return false;
  }

  function fieldValueNearLabel(labelRe) {
    const labels = Array.from(document.querySelectorAll("label, h1, h2, h3, h4, span, div")).filter(
      (el) => {
        if (!visible(el) || isRail(el)) return false;
        const t = norm(el.innerText || "");
        return t.length < 60 && labelRe.test(t);
      }
    );
    for (const lab of labels) {
      const root =
        lab.closest("section, li, [class*='field'], [class*='Field'], div") || lab.parentElement;
      if (!root) continue;
      const field = root.querySelector("textarea, input:not([type='hidden']), [contenteditable='true']");
      if (field && visible(field) && isMain(field)) {
        const val =
          field.getAttribute("contenteditable") === "true"
            ? norm(field.innerText || field.textContent)
            : norm(field.value || field.innerText || "");
        return { el: field, value: val, label: norm(lab.innerText) };
      }
    }
    return null;
  }

  function descriptionHasTerms() {
    const f = fieldValueNearLabel(/^Description$/i);
    if (f?.value) {
      return /mymotivelife\.com\/terms|Terms of Use \(EULA\)/i.test(f.value);
    }
    return /mymotivelife\.com\/terms|Terms of Use \(EULA\)/i.test(document.body?.innerText || "");
  }

  function privacyUrlOk() {
    // Any main-content input already holding our privacy URL counts as done
    for (const input of document.querySelectorAll("input:not([type='hidden']), textarea")) {
      if (!visible(input) || isRail(input)) continue;
      const val = norm(input.value || "");
      if (/mymotivelife\.com\/privacy/i.test(val)) return true;
    }
    const f = fieldValueNearLabel(/^Privacy Policy URL$/i);
    if (f?.value && /mymotivelife\.com\/privacy/i.test(f.value)) return true;
    // Broader label, but require it looks like a URL field value
    const f2 = fieldValueNearLabel(/^Privacy Policy$/i);
    if (f2?.value && /^https?:\/\//i.test(f2.value) && /mymotivelife\.com\/privacy/i.test(f2.value))
      return true;
    return false;
  }

  function buildIs14() {
    const buildHeads = Array.from(document.querySelectorAll("h1,h2,h3,h4,div,span,label")).filter(
      (el) => {
        if (!visible(el) || isRail(el)) return false;
        const t = norm(el.innerText || "");
        return t === "Build" || t === "Builds";
      }
    );
    for (const h of buildHeads) {
      const root =
        h.closest("section, article, [class*='section'], [class*='Section'], div") || h.parentElement;
      const chunk = norm(root?.innerText || "").slice(0, 800);
      if (/1\.0\.4\s*\(14\)/.test(chunk)) return true;
    }
    // Ready for Review almost always means a build is already selected
    if (/\bReady for Review\b/i.test(document.body?.innerText || "") && /1\.0\.4/.test(document.body?.innerText || "")) {
      // Don't force build hunting if the version is already Ready for Review
      return /1\.0\.4\s*\(14\)/.test(document.body?.innerText || "");
    }
    return false;
  }

  function leavesVersionPage(el) {
    const a = el?.closest?.("a[href]");
    if (!a) return false;
    const href = a.href || "";
    if (!href || href === "#" || href.endsWith("#")) return false;
    if (/\/version\/|\/inflight/i.test(href)) return false;
    if (/testflight|\/builds\b|\/activity|\/metrics|\/crash|\/xcode|\/ci/i.test(href)) return true;
    // Absolute ASC link that is not the version form
    if (/appstoreconnect\.apple\.com/i.test(href) && !/\/version\/|\/inflight/i.test(href)) {
      // Allow same-page anchors
      try {
        const u = new URL(href);
        if (u.pathname === location.pathname) return false;
      } catch {
        /* ignore */
      }
      return true;
    }
    return false;
  }

  function iapAttachedOnVersion() {
    const heads = Array.from(document.querySelectorAll("h1,h2,h3,h4,div,span")).filter((el) => {
      if (!visible(el) || isRail(el)) return false;
      const t = norm(el.innerText || "");
      return t === "In-App Purchases and Subscriptions";
    });
    for (const h of heads) {
      const root =
        h.closest("section, article, [class*='section'], [class*='Section'], div") || h.parentElement;
      const chunk = norm(root?.innerText || "").slice(0, 1500);
      if (/MotiveLife Pro|motivelife_pro_monthly|\bMonthly\b/i.test(chunk)) return true;
    }
    return false;
  }

  function findBuild14() {
    const hit = findControl({
      text: "1.0.4 (14)",
      texts: ["1.0.4 (14)"],
      where: "main",
      exact: false,
      kinds: ["button", "link", "clickable", "menuitem", "heading"],
    });
    if (hit && !leavesVersionPage(hit.el)) return hit;
    const hit2 = findControl({
      text: "(14)",
      texts: ["(14)"],
      where: "main",
      kinds: ["button", "link", "clickable", "menuitem"],
    });
    if (hit2 && !leavesVersionPage(hit2.el) && /14/.test(hit2.text || hit2.label || "")) return hit2;
    return null;
  }

  function findVersionBuildEntry() {
    if (buildPickerOpen()) return findBuild14();
    // Only point at Add/Select Build if it won't navigate off the version form
    for (const label of ["Add Build", "Select a Build", "Choose a Build"]) {
      const add = findControl({
        text: label,
        texts: [label],
        where: "main",
        exact: false,
      });
      if (add && !leavesVersionPage(add.el)) return add;
    }
    const fourteen = findBuild14();
    if (fourteen) return fourteen;
    // Scroll target only: non-link heading "Build"
    const heads = Array.from(document.querySelectorAll("h1,h2,h3,h4")).filter((el) => {
      if (!visible(el) || isRail(el)) return false;
      if (el.closest("a[href]")) return false;
      const t = norm(el.innerText || "");
      return t === "Build" || t === "Builds";
    });
    if (heads[0]) {
      return {
        el: heads[0],
        kind: "heading",
        label: "Build section (scroll here — pick 1.0.4 (14))",
        text: "Build",
        disabled: false,
        rail: false,
        rect: heads[0].getBoundingClientRect(),
      };
    }
    return null;
  }

  function draftDrawerOpen() {
    // Must be a real sheet/dialog — never a stray string buried in the version page DOM.
    const roots = Array.from(
      document.querySelectorAll(
        '[role="dialog"], [aria-modal="true"], [class*="Modal"], [class*="modal"], [class*="Drawer"], [class*="drawer"], [class*="Sheet"], [class*="sheet"]'
      )
    );
    if (!roots.length) return false;

    for (const root of roots) {
      if (!visible(root)) continue;
      const r = root.getBoundingClientRect();
      // Real drawers cover a meaningful chunk of the viewport
      if (r.width < 240 || r.height < 160) continue;
      const labels = Array.from(root.querySelectorAll("h1,h2,h3,h4,[role='heading']"));
      for (const el of labels) {
        if (!visible(el)) continue;
        const t = norm(el.innerText || "");
        if (t === "Draft Submission") return true;
      }
    }
    return false;
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
    // Include off-screen nodes (ASC often virtualizes until you scroll)
    const nodes = Array.from(
      document.querySelectorAll("h1,h2,h3,h4,legend,div,span,button,a,label")
    );
    const heads = nodes.filter((el) => {
      if (isRail(el)) return false;
      const t = norm(el.innerText || el.textContent || "");
      if (!t || t.length > 90) return false;
      return (
        /^In-App Purchases and Subscriptions$/i.test(t) ||
        /^In-App Purchases$/i.test(t) ||
        /In-App Purchases and Subscriptions/i.test(t)
      );
    });
    if (!heads.length) {
      // Nudge the page down so lazy sections mount, then retry once next render
      try {
        const main =
          document.querySelector("main, [role='main'], .main, #main") || document.scrollingElement;
        if (main) main.scrollBy?.(0, Math.min(900, window.innerHeight * 0.8));
        else window.scrollBy(0, Math.min(900, window.innerHeight * 0.8));
      } catch {
        /* ignore */
      }
      return null;
    }
    const head = heads.sort((a, b) => (a.innerText || "").length - (b.innerText || "").length)[0];
    try {
      head.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch {
      /* ignore */
    }
    const root =
      head.closest("section, article, [class*='section'], [class*='Section']") ||
      head.parentElement ||
      head;
    const plus = Array.from(root.querySelectorAll("button, a, [role='button']")).find((b) => {
      if (isRail(b)) return false;
      const r = b.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) return false;
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
      text: norm(head.innerText || "In-App Purchases and Subscriptions"),
      disabled: false,
      rail: false,
      rect: head.getBoundingClientRect(),
    };
  }

  function findControl(spec) {
    if (!spec) return null;
    if (spec.find === "close-drawer") return findCloseDrawer();
    if (spec.find === "version-iap-attach") return findVersionIapAttach();
    if (spec.find === "version-build-select") return findVersionBuildEntry();
    if (spec.find === "build-14") return findBuild14();
    if (spec.find === "rail-version-104") return findRailVersion104();

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
    const descTerms = descriptionHasTerms();
    const privacyOk = privacyUrlOk();
    const build14 = buildIs14();
    const iapOnVersion = iapAttachedOnVersion();
    const controls = inventory({ inViewOnly: false }).slice(0, 60).map((c) => ({
      kind: c.kind,
      label: c.label,
      text: c.text,
      disabled: c.disabled,
      rail: c.rail,
    }));

    const submitBtn = findControl({
      text: "Add for Review",
      texts: ["Add for Review", "Update Review", "Submit for Review"],
      where: "main",
    });

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
        addForReview: !!findControl({
          text: "Add for Review",
          texts: ["Add for Review"],
          exact: true,
          where: "main",
        }),
        submitForReview: hasText(/Submit for Review/i),
        updateReview: !!findControl({
          text: "Update Review",
          texts: ["Update Review"],
          exact: true,
          where: "main",
        }),
        submitButtonLabel: submitBtn?.text || submitBtn?.label || null,
        unableToSubmit: hasText(/Unable to Submit for Review/i),
        mustSubmitWithVersion:
          drawer && hasText(/add an app version|submitted with a new app version/i),
        mustSubmitWithGroup: hasText(/submitted with its subscription group/i),
        draftSubmission: drawer,
        draftDrawerOpen: drawer,
        localizationModal: hasText(/Add App Store Localization/i),
        iapSection: hasText(/In-App Purchases and Subscriptions/i),
        iapAttachedOnVersion: iapOnVersion,
        prepareForSubmission: hasText(/Prepare for Submission/i),
        readyForReview: hasText(/Ready for Review/i),
        rejected: hasText(/\bRejected\b/i),
        monthlyProduct: hasText(/motivelife_pro_monthly|MotiveLife Pro/i),
        buildNumber: build14 ? "14" : null,
        buildIs14: build14,
        buildPickerOpen: mode === "build-picker",
        privacyTermsInDescriptionHint: descTerms,
        descriptionHasTerms: descTerms,
        privacyUrlOk: privacyOk,
        controlCount: controls.length,
        done:
          descTerms &&
          privacyOk &&
          build14 &&
          iapOnVersion &&
          !!(submitBtn || hasText(/Waiting for Review|In Review/i)),
      },
    };
  };
})();
