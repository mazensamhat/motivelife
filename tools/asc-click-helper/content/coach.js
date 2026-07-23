/**
 * Finds ASC controls by visible text and drives a floating mouse coach.
 */
(function () {
  const LAYER_ID = "motivelife-asc-coach-layer";

  function visible(el) {
    if (!el || !(el instanceof Element)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = window.getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none" || Number(st.opacity) === 0)
      return false;
    return true;
  }

  function norm(s) {
    return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function findByTexts(texts, { preferButton = true } = {}) {
    const wants = (texts || []).map(norm).filter(Boolean);
    if (!wants.length) return null;

    const candidates = Array.from(
      document.querySelectorAll(
        "button, a, [role='button'], input, textarea, select, label, h1, h2, h3, span, div"
      )
    ).filter(visible);

    let best = null;
    let bestScore = -1;

    for (const el of candidates) {
      const t = norm(el.innerText || el.textContent || el.getAttribute("aria-label") || el.value);
      if (!t || t.length > 120) continue;
      for (const w of wants) {
        if (!t.includes(w) && t !== w) continue;
        let score = w.length;
        if (preferButton && /^(BUTTON|A)$/.test(el.tagName)) score += 50;
        if (el.getAttribute("role") === "button") score += 40;
        if (t === w) score += 30;
        // Prefer smaller leaf-ish nodes
        score -= Math.min(40, Math.floor((el.innerText || "").length / 20));
        if (score > bestScore) {
          bestScore = score;
          best = el;
        }
      }
    }
    return best;
  }

  function findCloseOnDrawer() {
    // Draft Submission / modal close controls
    const closes = Array.from(
      document.querySelectorAll(
        "button[aria-label*='Close' i], button[aria-label*='Dismiss' i], [aria-label*='Close' i]"
      )
    ).filter(visible);
    if (closes.length) return closes[closes.length - 1];

    // X-looking buttons near "Draft Submission"
    const headings = Array.from(document.querySelectorAll("h1,h2,h3,div,span")).filter(
      (el) => visible(el) && /draft submission/i.test(el.textContent || "")
    );
    for (const h of headings) {
      const root = h.closest('[role="dialog"], aside, section, div') || h.parentElement;
      if (!root) continue;
      const btn = Array.from(root.querySelectorAll("button")).find((b) => {
        const t = (b.innerText || b.getAttribute("aria-label") || "").trim();
        return t === "×" || t === "X" || t === "✕" || /close/i.test(t) || t.length === 0;
      });
      if (btn && visible(btn)) return btn;
    }
    return findByTexts(["Cancel"]);
  }

  function ensureLayer() {
    let layer = document.getElementById(LAYER_ID);
    if (layer) return layer;
    layer = document.createElement("div");
    layer.id = LAYER_ID;
    layer.innerHTML = `
      <div class="ml-coach-dim"></div>
      <div class="ml-coach-hole"></div>
      <div class="ml-coach-ring"></div>
      <div class="ml-coach-cursor" aria-hidden="true">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <path d="M4 3l11 7.5-4.2 1.3L14.5 21 12 22l-3.7-9.2L3 15.5 4 3z" fill="#fbbf24" stroke="#0f172a" stroke-width="1.2"/>
        </svg>
      </div>
      <div class="ml-coach-bubble">
        <div class="ml-coach-bubble-action"></div>
        <div class="ml-coach-bubble-title"></div>
        <button type="button" class="ml-coach-bubble-fill" hidden></button>
        <button type="button" class="ml-coach-next">Next target →</button>
      </div>
    `;
    document.documentElement.appendChild(layer);
    layer.querySelector(".ml-coach-next")?.addEventListener("click", () => {
      window.__MOTIVELIFE_ASC_COACH_NEXT__?.();
    });
    return layer;
  }

  function place(el, coach, stepTitle) {
    const layer = ensureLayer();
    layer.style.display = "block";
    const r = el.getBoundingClientRect();
    const pad = 10;
    const hole = layer.querySelector(".ml-coach-hole");
    const ring = layer.querySelector(".ml-coach-ring");
    const cursor = layer.querySelector(".ml-coach-cursor");
    const bubble = layer.querySelector(".ml-coach-bubble");
    const action = layer.querySelector(".ml-coach-bubble-action");
    const title = layer.querySelector(".ml-coach-bubble-title");
    const fill = layer.querySelector(".ml-coach-bubble-fill");

    const top = Math.max(8, r.top - pad);
    const left = Math.max(8, r.left - pad);
    const width = Math.min(window.innerWidth - left - 8, r.width + pad * 2);
    const height = Math.min(window.innerHeight - top - 8, r.height + pad * 2);

    [hole, ring].forEach((node) => {
      node.style.top = `${top}px`;
      node.style.left = `${left}px`;
      node.style.width = `${width}px`;
      node.style.height = `${height}px`;
    });

    const cx = r.left + r.width * 0.65;
    const cy = r.top + r.height * 0.65;
    cursor.style.left = `${cx}px`;
    cursor.style.top = `${cy}px`;

    const bubbleW = 300;
    let bLeft = r.right + 16;
    let bTop = Math.max(12, r.top);
    if (bLeft + bubbleW > window.innerWidth - 12) bLeft = Math.max(12, r.left - bubbleW - 16);
    if (bTop + 160 > window.innerHeight) bTop = window.innerHeight - 170;
    bubble.style.left = `${bLeft}px`;
    bubble.style.top = `${bTop}px`;

    const kind = (coach?.action || "click").toUpperCase();
    action.textContent = kind === "FILL" ? "TYPE / PASTE HERE" : kind === "CLOSE" ? "CLICK TO CLOSE" : "CLICK HERE";
    title.textContent = stepTitle || coach?.label || "Do this";
    if (coach?.fill) {
      fill.hidden = false;
      fill.textContent = coach.fill;
      fill.onclick = async () => {
        try {
          await navigator.clipboard.writeText(coach.fill);
          fill.textContent = "Copied ✓ — paste into the field";
          setTimeout(() => {
            fill.textContent = coach.fill;
          }, 1500);
        } catch {
          /* ignore */
        }
      };
    } else {
      fill.hidden = true;
      fill.textContent = "";
    }

    el.scrollIntoView({ block: "center", behavior: "smooth", inline: "nearest" });
  }

  function hide() {
    const layer = document.getElementById(LAYER_ID);
    if (layer) layer.style.display = "none";
  }

  function resolveTarget(coach) {
    if (!coach) return null;
    if (coach.find === "close-drawer") return findCloseOnDrawer();
    const texts = [coach.text, ...(coach.texts || [])].filter(Boolean);
    return findByTexts(texts, { preferButton: coach.action !== "fill" });
  }

  let coachIndex = 0;
  let lastPlan = [];

  window.__MOTIVELIFE_ASC_COACH_NEXT__ = function () {
    coachIndex += 1;
    window.__MOTIVELIFE_ASC_COACH_SHOW__(lastPlan);
  };

  /**
   * @param {Array<{title:string, coach?: object}>} steps
   */
  window.__MOTIVELIFE_ASC_COACH_SHOW__ = function showCoach(steps) {
    lastPlan = Array.isArray(steps) ? steps.filter((s) => s && s.coach) : [];
    if (!lastPlan.length) {
      hide();
      return null;
    }
    if (coachIndex >= lastPlan.length) coachIndex = 0;

    // Try current and following steps until a target exists on this page
    for (let i = 0; i < lastPlan.length; i++) {
      const idx = (coachIndex + i) % lastPlan.length;
      const st = lastPlan[idx];
      const el = resolveTarget(st.coach);
      if (el) {
        coachIndex = idx;
        place(el, st.coach, st.title);
        return { step: st, el };
      }
    }
    hide();
    return null;
  };

  window.__MOTIVELIFE_ASC_COACH_HIDE__ = hide;
  window.addEventListener("resize", () => {
    if (lastPlan.length) window.__MOTIVELIFE_ASC_COACH_SHOW__(lastPlan);
  });
})();
