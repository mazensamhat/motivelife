/**
 * Floating overlay: live steps + continuous reports to MotiveLife for Cursor.
 */
(function () {
  const ROOT_ID = "motivelife-asc-helper-root";
  let lastAutoKey = "";
  let lastServerSteps = null;
  let lastStatus = "";
  let lastLiveKey = "";
  let lastHeartbeatAt = 0;
  let lastShotAt = 0;
  let reportInFlight = false;

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
    if (signals.pageMode === "build-picker") return null;
    if (signals.pageMode === "version") return null;
    if (signals.pageMode === "off-version") return "Left version form — return via 1.0.4 in the rail";
    if (signals.draftDrawerOpen) return "Draft Submission drawer open — close it";
    if (signals.pageMode === "iap-catalog") return "On IAP catalog — open 1.0.4 version form";
    if (signals.localizationModal) return "Localization modal open";
    return null;
  }

  function pointingFrom(steps) {
    const find = window.__MOTIVELIFE_ASC_FIND__;
    if (!find) return null;
    for (const st of steps) {
      if (!st.coach) continue;
      const hit = find(st.coach);
      if (hit?.el) {
        return {
          stepId: st.id,
          title: st.title,
          label: hit.text || hit.label,
          action: st.coach.action || "click",
        };
      }
    }
    return null;
  }

  function render() {
    const read = window.__MOTIVELIFE_ASC_READ__;
    const stepsFn = window.__MOTIVELIFE_ASC_STEPS__;
    if (!read || !stepsFn) return;

    const snapshot = read();
    const localSteps = stepsFn(snapshot);
    // Prefer local coach targets; server steps are advisory only for titles
    const steps = localSteps;
    if (lastServerSteps?.length) {
      /* keep lastServerSteps for status only */
    }
    const stuck = detectStuckLocal(snapshot.signals);
    const root = ensureRoot();
    const pointing = pointingFrom(steps);
    const seen = (snapshot.controls || [])
      .slice(0, 8)
      .map((c) => c.text || c.label)
      .filter(Boolean);

    // Enrich snapshot for Cursor live feed
    snapshot.extensionVersion = chrome.runtime.getManifest?.()?.version || "?";
    snapshot.pointing = pointing;
    snapshot.signals = {
      ...(snapshot.signals || {}),
      pointingLabel: pointing?.label || null,
      pointingStep: pointing?.stepId || null,
    };

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
            Live reports go to Cursor every few seconds. One next action only. Stay on <b>1.0.4</b>.
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
      reportNow(snapshot, stuck || "manual", { forceShot: true })
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
    maybeLiveReport(snapshot, pointing, stuck);

    try {
      if (typeof window.__MOTIVELIFE_ASC_COACH_SHOW__ === "function") {
        window.__MOTIVELIFE_ASC_COACH_SHOW__(steps);
      } else {
        lastStatus = "Coach missing — re-download Desktop folder (need v1.4.1), then Reload";
        const st = root.querySelector(".ml-asc-status");
        if (st) st.textContent = lastStatus;
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
      reportNow(snapshot, stuck, { forceShot: true });
    });
  }

  /** Continuous feed so Cursor can pull GET /api/asc-helper/latest while you work. */
  function maybeLiveReport(snapshot, pointing, stuck) {
    chrome.storage.sync.get(["liveReport", "autoReport"], (cfg) => {
      if (cfg.liveReport === false) return;
      if (cfg.autoReport === false && cfg.liveReport !== true) {
        // Default: live on unless explicitly disabled
      }
      const now = Date.now();
      const key = [
        snapshot.url,
        snapshot.signals?.pageMode,
        pointing?.stepId,
        pointing?.label,
        stuck || "",
        snapshot.signals?.privacyUrlOk,
        snapshot.signals?.buildIs14,
        snapshot.signals?.descriptionHasTerms,
      ].join("|");
      const changed = key !== lastLiveKey;
      const due = now - lastHeartbeatAt > 10000;
      if (!changed && !due) return;
      lastLiveKey = key;
      lastHeartbeatAt = now;
      const forceShot = changed && now - lastShotAt > 20000;
      if (forceShot) lastShotAt = now;
      reportNow(snapshot, stuck || `live:${pointing?.stepId || snapshot.signals?.pageMode || "tick"}`, {
        skipScreenshot: !forceShot,
        quiet: true,
      });
    });
  }

  function reportNow(snapshot, note, opts = {}) {
    if (reportInFlight && opts.quiet) return;
    reportInFlight = true;
    if (!opts.quiet) {
      lastStatus = "Reporting (screenshot + page)…";
      renderStatusOnly();
    }
    chrome.runtime.sendMessage(
      {
        type: "ASC_CAPTURE_AND_REPORT",
        snapshot,
        note,
        skipScreenshot: !!opts.skipScreenshot && !opts.forceShot,
      },
      (response) => {
        reportInFlight = false;
        if (chrome.runtime.lastError) {
          if (!opts.quiet) {
            lastStatus = chrome.runtime.lastError.message;
            toast(lastStatus);
            renderStatusOnly();
          }
          return;
        }
        if (!response?.ok) {
          if (!opts.quiet) {
            lastStatus = response?.error || "Report failed";
            toast(lastStatus);
            renderStatusOnly();
          }
          return;
        }
        lastServerSteps = response.steps || [];
        lastStatus = opts.quiet
          ? `Live → Cursor ✓ ${new Date().toLocaleTimeString()}`
          : response.screenshotUrl
            ? `Reported ✓ · screenshot saved · Cursor can fetch latest`
            : `Reported ✓ · Cursor can fetch latest`;
        if (!opts.quiet) toast("Reported to MotiveLife");
        renderStatusOnly();
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
      } else {
        // Heartbeat even when signals stable
        maybeLiveReport(snap, pointingFrom(window.__MOTIVELIFE_ASC_STEPS__?.(snap) || []), null);
      }
    }, 2500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
