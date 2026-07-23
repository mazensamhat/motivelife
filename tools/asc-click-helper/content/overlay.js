/**
 * Floating overlay: live steps, auto-report with screenshot, server instructions.
 */
(function () {
  const ROOT_ID = "motivelife-asc-helper-root";
  let lastAutoKey = "";
  let lastServerSteps = null;
  let lastStatus = "";

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      document.documentElement.appendChild(root);
    }
    return root;
  }

  function detectStuckLocal(signals) {
    if (!signals) return null;
    if (signals.unableToSubmit) return "Unable to Submit for Review";
    if (signals.pageMode === "version") return null; // already on the right page
    if (signals.draftDrawerOpen) return "Draft Submission drawer open — close it, use version 1.0.4";
    if (signals.pageMode === "iap-catalog")
      return "On IAP catalog — open 1.0.4 (do not bounce back here)";
    if (signals.localizationModal) return "Localization modal open";
    return null;
  }

  function render() {
    const read = window.__MOTIVELIFE_ASC_READ__;
    const stepsFn = window.__MOTIVELIFE_ASC_STEPS__;
    if (!read || !stepsFn) return;

    const snapshot = read();
    const localSteps = stepsFn(snapshot);
    const steps =
      lastServerSteps && lastServerSteps.length
        ? lastServerSteps.map((st, i) => ({
            ...st,
            coach: st.coach || localSteps[i]?.coach || localSteps.find((l) => l.id === st.id)?.coach,
          }))
        : localSteps;
    const stuck = detectStuckLocal(snapshot.signals);
    const root = ensureRoot();
    const find = window.__MOTIVELIFE_ASC_FIND__;
    let pointing = null;
    if (find) {
      for (const st of steps) {
        if (!st.coach) continue;
        const hit = find(st.coach);
        if (hit?.el) {
          pointing = { title: st.title, label: hit.text || hit.label, action: st.coach.action || "click" };
          break;
        }
      }
    }
    const seen = (snapshot.controls || [])
      .slice(0, 8)
      .map((c) => c.text || c.label)
      .filter(Boolean);

    root.innerHTML = `
      <div class="ml-asc-panel" data-collapsed="false">
        <div class="ml-asc-header">
          <strong>MotiveLife ASC Helper <span class="ml-asc-ver" id="ml-asc-ver"></span></strong>
          <div class="ml-asc-header-actions">
            <button type="button" class="ml-asc-btn" id="ml-asc-refresh">Refresh</button>
            <button type="button" class="ml-asc-btn ml-asc-primary" id="ml-asc-report">Report now</button>
            <button type="button" class="ml-asc-icon" id="ml-asc-min" title="Minimize">–</button>
          </div>
        </div>
        <div class="ml-asc-body">
          <p class="ml-asc-url">${escapeHtml(shortUrl(snapshot.url))}</p>
          <p class="ml-asc-point">
            ${
              pointing
                ? `<b>Pointing at</b> ${escapeHtml(pointing.action)} → ${escapeHtml(pointing.label)}`
                : `<b>Reading page…</b> target not on this screen yet`
            }
          </p>
          ${
            seen.length
              ? `<p class="ml-asc-seen"><b>Seen:</b> ${escapeHtml(seen.join(" · "))}</p>`
              : ""
          }
          <p class="ml-asc-meta">
            ${stuck ? `<span class="ml-asc-stuck">STUCK: ${escapeHtml(stuck)}</span> · ` : ""}
            ${escapeHtml(signalSummary(snapshot.signals))}
          </p>
          ${lastStatus ? `<p class="ml-asc-status">${escapeHtml(lastStatus)}</p>` : ""}
          <ol class="ml-asc-steps">
            ${steps
              .map(
                (st, i) => `
              <li>
                <div class="ml-asc-step-title">${i + 1}. ${escapeHtml(st.title)}</div>
                <ul>
                  ${(st.clicks || []).map((c) => `<li>${escapeHtml(c)}</li>`).join("")}
                </ul>
                ${st.why ? `<p class="ml-asc-why">${escapeHtml(st.why)}</p>` : ""}
              </li>`
              )
              .join("")}
          </ol>
          <p class="ml-asc-foot">
            Blue outline + pointer = next real control on this page (no gray overlay).
            Paste chip copies text. Stay on <b>1.0.4</b>.
            <button type="button" class="ml-asc-linkish" id="ml-asc-options">Options</button>
          </p>
        </div>
        <div class="ml-asc-toast" id="ml-asc-toast" hidden></div>
      </div>
    `;

    root.querySelector("#ml-asc-refresh")?.addEventListener("click", () => {
      lastServerSteps = null;
      render();
    });
    root.querySelector("#ml-asc-report")?.addEventListener("click", () =>
      reportNow(snapshot, stuck || "manual")
    );
    root.querySelector("#ml-asc-options")?.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "ASC_OPEN_OPTIONS" });
    });
    root.querySelector("#ml-asc-min")?.addEventListener("click", () => {
      const panel = root.querySelector(".ml-asc-panel");
      const collapsed = panel?.getAttribute("data-collapsed") === "true";
      panel?.setAttribute("data-collapsed", collapsed ? "false" : "true");
    });

    try {
      const ver = chrome.runtime.getManifest?.()?.version || "?";
      const verEl = root.querySelector("#ml-asc-ver");
      if (verEl) verEl.textContent = `v${ver}`;
    } catch {
      /* ignore */
    }

    maybeAutoReport(snapshot, stuck);
    try {
      if (typeof window.__MOTIVELIFE_ASC_COACH_SHOW__ === "function") {
        window.__MOTIVELIFE_ASC_COACH_SHOW__(steps);
      } else {
        lastStatus = "Coach missing — re-download Desktop folder (need v1.3.2), then Reload";
        const st = root.querySelector(".ml-asc-status");
        if (st) st.textContent = lastStatus;
        else {
          const p = document.createElement("p");
          p.className = "ml-asc-status";
          p.textContent = lastStatus;
          root.querySelector(".ml-asc-body")?.prepend(p);
        }
      }
    } catch (e) {
      lastStatus = `Coach error: ${e?.message || e}`;
    }
  }

  function maybeAutoReport(snapshot, stuck) {
    if (!stuck) return;
    const key = `${stuck}|${snapshot.url}|${(snapshot.banners || []).join("|").slice(0, 120)}`;
    if (key === lastAutoKey) return;
    chrome.storage.sync.get(["autoReport"], (cfg) => {
      if (cfg.autoReport === false) return;
      lastAutoKey = key;
      reportNow(snapshot, stuck);
    });
  }

  function reportNow(snapshot, note) {
    lastStatus = "Reporting (screenshot + page)…";
    renderStatusOnly();
    chrome.runtime.sendMessage(
      { type: "ASC_CAPTURE_AND_REPORT", snapshot, note },
      (response) => {
        if (chrome.runtime.lastError) {
          lastStatus = chrome.runtime.lastError.message;
          toast(lastStatus);
          render();
          return;
        }
        if (!response?.ok) {
          lastStatus = response?.error || "Report failed";
          toast(lastStatus);
          render();
          return;
        }
        lastServerSteps = response.steps || [];
        lastStatus = response.screenshotUrl
          ? `Reported ✓ · screenshot saved · Cursor can fetch latest`
          : `Reported ✓ · Cursor can fetch latest`;
        toast("Reported to MotiveLife — follow steps below");
        render();
      }
    );
  }

  function renderStatusOnly() {
    const el = document.querySelector("#motivelife-asc-helper-root .ml-asc-status");
    if (el) el.textContent = lastStatus;
  }

  function signalSummary(signals) {
    if (!signals) return "";
    return Object.entries(signals)
      .filter(([, v]) => v === true || (typeof v === "string" && v))
      .map(([k, v]) => (v === true ? k : `${k}=${v}`))
      .join(", ");
  }

  function shortUrl(url) {
    try {
      const u = new URL(url);
      return u.pathname + u.search;
    } catch {
      return url;
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    const el = document.getElementById("ml-asc-toast");
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
    setTimeout(() => {
      el.hidden = true;
    }, 2800);
  }

  function boot() {
    render();
    let last = location.href;
    let lastSig = "";
    setInterval(() => {
      const read = window.__MOTIVELIFE_ASC_READ__;
      if (!read) return;
      const snap = read();
      const sig = JSON.stringify(snap.signals || {}) + (snap.banners || []).join("|");
      if (location.href !== last) {
        last = location.href;
        lastServerSteps = null;
        lastAutoKey = "";
        lastSig = sig;
        render();
        return;
      }
      if (sig !== lastSig) {
        lastSig = sig;
        render();
      }
    }, 2500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
