/**
 * Page-aware pointer: reads live controls, highlights the exact next click/fill.
 * No page dimming — ASC stays fully visible.
 */
(function () {
  const LAYER_ID = "motivelife-asc-coach-layer";
  let coachIndex = 0;
  let lastPlan = [];
  let lastPlanSig = "";
  let lockedEl = null;
  let lockedStep = null;
  let raf = 0;
  let following = false;
  let mo = null;
  let moTimer = 0;

  function ensureLayer() {
    let layer = document.getElementById(LAYER_ID);
    if (layer) return layer;
    layer = document.createElement("div");
    layer.id = LAYER_ID;
    layer.innerHTML = `
      <div class="ml-coach-outline" hidden></div>
      <div class="ml-coach-pointer" aria-hidden="true" hidden>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M5 3.5 17.5 12l-5 1.6L16 21.5 13.7 22.5 10 13.5 4 15.2 5 3.5Z"
            fill="#2563eb" stroke="#fff" stroke-width="1.25"/>
        </svg>
      </div>
      <div class="ml-coach-chip" hidden>
        <div class="ml-coach-chip-do"></div>
        <button type="button" class="ml-coach-chip-fill" hidden></button>
        <div class="ml-coach-chip-actions">
          <button type="button" class="ml-coach-chip-next">Skip →</button>
        </div>
      </div>
    `;
    document.documentElement.appendChild(layer);
    layer.querySelector(".ml-coach-chip-next")?.addEventListener("click", () => {
      window.__MOTIVELIFE_ASC_COACH_NEXT__?.();
    });
    return layer;
  }

  function resolve(coach) {
    const find = window.__MOTIVELIFE_ASC_FIND__;
    if (!find || !coach) return null;
    return find(coach);
  }

  function pickLiveStep(plan, startIdx) {
    if (!plan.length) return null;
    // Forward only — do not wrap (wrapping caused Description ↔ Build loops)
    for (let idx = startIdx; idx < plan.length; idx++) {
      const st = plan[idx];
      const hit = resolve(st.coach);
      if (hit?.el) return { idx, step: st, hit };
    }
    // If nothing from startIdx, try earlier incomplete steps once
    for (let idx = 0; idx < startIdx; idx++) {
      const st = plan[idx];
      const hit = resolve(st.coach);
      if (hit?.el) return { idx, step: st, hit };
    }
    return null;
  }

  function copyFill(btn, text) {
    btn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "Copied — paste now";
        setTimeout(() => {
          btn.textContent = text;
        }, 1400);
      } catch {
        /* ignore */
      }
    };
  }

  function paint(hit, step) {
    const layer = ensureLayer();
    layer.style.display = "block";
    const el = hit.el;
    lockedEl = el;
    lockedStep = step;
    const r = el.getBoundingClientRect();
    const outline = layer.querySelector(".ml-coach-outline");
    const pointer = layer.querySelector(".ml-coach-pointer");
    const chip = layer.querySelector(".ml-coach-chip");
    const doEl = layer.querySelector(".ml-coach-chip-do");
    const fillBtn = layer.querySelector(".ml-coach-chip-fill");

    const pad = 3;
    outline.hidden = false;
    outline.style.top = `${Math.max(0, r.top - pad)}px`;
    outline.style.left = `${Math.max(0, r.left - pad)}px`;
    outline.style.width = `${Math.min(window.innerWidth, r.width + pad * 2)}px`;
    outline.style.height = `${Math.min(window.innerHeight, r.height + pad * 2)}px`;

    const cx = r.left + r.width * 0.55;
    const cy = r.top + r.height * 0.55;
    pointer.hidden = false;
    pointer.style.left = `${cx}px`;
    pointer.style.top = `${cy}px`;

    const action = step.coach?.action || "click";
    const verb =
      action === "fill" ? "Paste here" : action === "close" ? "Close this" : "Click";
    const name = hit.text || hit.label || step.title;
    doEl.textContent = `${verb}: ${name}`;

    if (step.coach?.fill) {
      fillBtn.hidden = false;
      fillBtn.textContent = step.coach.fill;
      copyFill(fillBtn, step.coach.fill);
    } else {
      fillBtn.hidden = true;
      fillBtn.textContent = "";
    }

    const chipW = 260;
    let left = r.right + 10;
    let top = Math.max(8, r.top);
    if (left + chipW > window.innerWidth - 8) left = Math.max(8, r.left - chipW - 10);
    if (top + 120 > window.innerHeight) top = Math.max(8, window.innerHeight - 130);
    if (left > window.innerWidth - 450 && top > window.innerHeight - 280) {
      top = Math.max(8, r.top - 90);
    }
    chip.hidden = false;
    chip.style.left = `${left}px`;
    chip.style.top = `${top}px`;
  }

  function hideVisual() {
    const layer = document.getElementById(LAYER_ID);
    if (!layer) return;
    layer.querySelector(".ml-coach-outline").hidden = true;
    layer.querySelector(".ml-coach-pointer").hidden = true;
    layer.querySelector(".ml-coach-chip").hidden = true;
  }

  function hide() {
    lockedEl = null;
    lockedStep = null;
    hideVisual();
    const layer = document.getElementById(LAYER_ID);
    if (layer) layer.style.display = "none";
  }

  function tick() {
    if (!lockedEl || !lockedStep) return;
    if (!document.documentElement.contains(lockedEl)) {
      window.__MOTIVELIFE_ASC_COACH_SHOW__(lastPlan);
      return;
    }
    paint(
      {
        el: lockedEl,
        text: lockedEl.innerText || lockedEl.getAttribute("aria-label") || "",
        label: lockedStep.title,
      },
      lockedStep
    );
  }

  function startFollow() {
    if (!following) {
      following = true;
      const loop = () => {
        tick();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    if (!mo) {
      mo = new MutationObserver(() => {
        clearTimeout(moTimer);
        moTimer = setTimeout(() => {
          window.__MOTIVELIFE_ASC_COACH_SHOW__(lastPlan);
        }, 350);
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  window.__MOTIVELIFE_ASC_COACH_NEXT__ = function () {
    coachIndex += 1;
    window.__MOTIVELIFE_ASC_COACH_SHOW__(lastPlan);
  };

  window.__MOTIVELIFE_ASC_COACH_SHOW__ = function showCoach(steps) {
    const next = Array.isArray(steps) ? steps.filter((s) => s && s.coach) : [];
    const sig = next.map((s) => s.id).join("|");
    if (sig !== lastPlanSig) {
      lastPlanSig = sig;
      coachIndex = 0;
    }
    lastPlan = next;
    if (!lastPlan.length) {
      hide();
      return null;
    }

    const picked = pickLiveStep(lastPlan, coachIndex);
    if (!picked) {
      hideVisual();
      ensureLayer().style.display = "block";
      const chip = document.querySelector("#motivelife-asc-coach-layer .ml-coach-chip");
      const doEl = document.querySelector("#motivelife-asc-coach-layer .ml-coach-chip-do");
      const fillBtn = document.querySelector("#motivelife-asc-coach-layer .ml-coach-chip-fill");
      if (chip && doEl) {
        chip.hidden = false;
        chip.style.left = "16px";
        chip.style.top = "16px";
        doEl.textContent = `Looking for: ${lastPlan[0].title}`;
        if (fillBtn) fillBtn.hidden = true;
      }
      lockedEl = null;
      lockedStep = null;
      return null;
    }

    const same = lockedEl === picked.hit.el && coachIndex === picked.idx;
    coachIndex = picked.idx;
    if (!same) {
      try {
        picked.hit.el.scrollIntoView({ block: "center", behavior: "smooth", inline: "nearest" });
      } catch {
        /* ignore */
      }
    }
    paint(picked.hit, picked.step);
    startFollow();
    return picked;
  };

  window.__MOTIVELIFE_ASC_COACH_HIDE__ = hide;
  window.__MOTIVELIFE_ASC_COACH_VERSION__ = "1.5.6";

  window.addEventListener(
    "scroll",
    () => {
      if (lockedEl) tick();
    },
    true
  );
  window.addEventListener("resize", () => {
    if (lastPlan.length) window.__MOTIVELIFE_ASC_COACH_SHOW__(lastPlan);
  });
})();
