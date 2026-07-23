/**
 * Floating overlay: live steps + continuous reports to MotiveLife for Cursor.
 */
(function () {
  const ROOT_ID = "motivelife-asc-helper-root";
  const DEAD_MSG =
    "EXTENSION DEAD — you Reloaded the extension. Hard-refresh this tab (Ctrl+Shift+R), then open Options and paste the secret.";
  let lastAutoKey = "";
  let lastStatus = "";
  let lastLiveKey = "";
  let lastHeartbeatAt = 0;
  let lastShotAt = 0;
  let reportInFlight = false;
  let bootReported = false;
  let contextDead = false;

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      document.documentElement.appendChild(root);
    }
    return root;
  }

  function isContextDead(err) {
    const msg = String(err?.message || err || "");
    return /Extension context invalidated|context invalidated/i.test(msg);
  }

  function markDead(err) {
    contextDead = true;
    lastStatus = DEAD_MSG;
    renderStatusOnly();
    console.warn("[motivelife-helper]", err || DEAD_MSG);
  }

  /** Safe chrome.storage.sync.get — never throws after extension reload. */
  function storageGet(keys, cb) {
    if (contextDead) return;
    try {
      if (!chrome?.storage?.sync) {
        markDead("no chrome.storage");
        return;
      }
      chrome.storage.sync.get(keys, (cfg) => {
        try {
          if (chrome.runtime?.lastError) {
            if (isContextDead(chrome.runtime.lastError)) markDead(chrome.runtime.lastError);
            return;
          }
          cb(cfg || {});
        } catch (e) {
          if (isContextDead(e)) markDead(e);
        }
      });
    } catch (e) {
      if (isContextDead(e)) markDead(e);
    }
  }

  function sendMessage(msg, cb) {
    if (contextDead) return;
    try {
      chrome.runtime.sendMessage(msg, (response) => {
        try {
          if (chrome.runtime?.lastError) {
            const err = chrome.runtime.lastError;
            if (isContextDead(err)) {
              markDead(err);
              return;
            }
            cb(null, err.message);
            return;
          }
          cb(response, null);
        } catch (e) {
          if (isContextDead(e)) markDead(e);
          else cb(null, String(e?.message || e));
        }
      });
    } catch (e) {
      if (isContextDead(e)) markDead(e);
      else cb(null, String(e?.message || e));
    }
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

  function extensionVersion() {
    try {
      return chrome.runtime.getManifest?.()?.version || "?";
    } catch (e) {
      if (isContextDead(e)) markDead(e);
      return "?";
    }
  }

  function render() {
    if (contextDead) {
      paintDeadPanel();
      return;
    }
    const read = window.__MOTIVELIFE_ASC_READ__;
    const stepsFn = window.__MOTIVELIFE_ASC_STEPS__;
    if (!read || !stepsFn) return;

    const snapshot = read();
    const steps = stepsFn(snapshot);
    const stuck = detectStuckLocal(snapshot.signals);
    const root = ensureRoot();
    const pointing = pointingFrom(steps);
    const seen = (snapshot.controls || [])
      .slice(0, 8)
      .map((c) => c.text || c.label)
      .filter(Boolean);

    snapshot.extensionVersion = extensionVersion();
    snapshot.pointing = pointing;
    snapshot.signals = {
      ...(snapshot.signals || {}),
      pointingLabel: pointing?.label || null,
      pointingStep: pointing?.stepId || null,
    };

    root.innerHTML = `
      <div class="ml-asc-panel" data-collapsed="false">
        <div class="ml-asc-header">
          <strong>MotiveLife Click Helper <span class="ml-asc-ver" id="ml-asc-ver"></span></strong>
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
                : `<b>Looking…</b> next control`
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
          <p class="ml-asc-status" id="ml-asc-status">${escapeHtml(lastStatus || "Connecting live report…")}</p>
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
            After Reloading the extension, always <b>Ctrl+Shift+R</b> this tab.
            Secret goes in <button type="button" class="ml-asc-linkish" id="ml-asc-options">Options</button>
            (Vercel alone is not enough).
          </p>
        </div>
        <div class="ml-asc-toast" id="ml-asc-toast" hidden></div>
      </div>
    `;

    root.querySelector("#ml-asc-refresh")?.addEventListener("click", () => render());
    root.querySelector("#ml-asc-report")?.addEventListener("click", () =>
      reportNow(snapshot, stuck || "manual", { forceShot: true })
    );
    root.querySelector("#ml-asc-options")?.addEventListener("click", () => {
      sendMessage({ type: "ASC_OPEN_OPTIONS" }, () => {});
    });
    root.querySelector("#ml-asc-min")?.addEventListener("click", () => {
      const panel = root.querySelector(".ml-asc-panel");
      const collapsed = panel?.getAttribute("data-collapsed") === "true";
      panel?.setAttribute("data-collapsed", collapsed ? "false" : "true");
    });

    const verEl = root.querySelector("#ml-asc-ver");
    if (verEl) verEl.textContent = `v${extensionVersion()}`;

    maybeAutoReport(snapshot, stuck);
    maybeLiveReport(snapshot, pointing, stuck);
    if (!bootReported) {
      bootReported = true;
      reportNow(snapshot, stuck || "boot", { forceShot: true });
    }

    try {
      if (typeof window.__MOTIVELIFE_ASC_COACH_SHOW__ === "function") {
        window.__MOTIVELIFE_ASC_COACH_SHOW__(steps);
      }
    } catch (e) {
      lastStatus = `Coach error: ${e?.message || e}`;
      renderStatusOnly();
    }
  }

  function paintDeadPanel() {
    const root = ensureRoot();
    root.innerHTML = `
      <div class="ml-asc-panel">
        <div class="ml-asc-header"><strong>MotiveLife Click Helper</strong></div>
        <div class="ml-asc-body">
          <p class="ml-asc-stuck">${escapeHtml(DEAD_MSG)}</p>
          <p class="ml-asc-foot">1) chrome://extensions → Reload helper<br/>2) This ASC tab → Ctrl+Shift+R<br/>3) Options → paste secret → Test</p>
        </div>
      </div>
    `;
  }

  function maybeAutoReport(snapshot, stuck) {
    if (!stuck || contextDead) return;
    const key = `${stuck}|${snapshot.url}`;
    if (key === lastAutoKey) return;
    storageGet(["autoReport"], (cfg) => {
      if (cfg.autoReport === false) return;
      lastAutoKey = key;
      reportNow(snapshot, stuck, { forceShot: true });
    });
  }

  function maybeLiveReport(snapshot, pointing, stuck) {
    if (contextDead) return;
    storageGet(["liveReport"], (cfg) => {
      if (cfg.liveReport === false) return;
      const now = Date.now();
      const key = [
        snapshot.url,
        snapshot.signals?.pageMode,
        pointing?.stepId,
        pointing?.label,
        stuck || "",
        snapshot.signals?.privacyUrlOk,
        snapshot.signals?.iapAttachedOnVersion,
        snapshot.signals?.iapSectionOnVersionForm,
      ].join("|");
      const changed = key !== lastLiveKey;
      const due = now - lastHeartbeatAt > 8000;
      if (!changed && !due) return;
      lastLiveKey = key;
      lastHeartbeatAt = now;
      const forceShot = changed || now - lastShotAt > 25000;
      if (forceShot) lastShotAt = now;
      reportNow(snapshot, stuck || `live:${pointing?.stepId || snapshot.signals?.pageMode || "tick"}`, {
        skipScreenshot: !forceShot,
      });
    });
  }

  function reportNow(snapshot, note, opts = {}) {
    if (contextDead) return;
    if (reportInFlight && !opts.forceShot) return;
    reportInFlight = true;
    lastStatus = "Reporting to Cursor…";
    renderStatusOnly();
    sendMessage(
      {
        type: "ASC_CAPTURE_AND_REPORT",
        snapshot,
        note,
        skipScreenshot: !!opts.skipScreenshot && !opts.forceShot,
      },
      (response, err) => {
        reportInFlight = false;
        if (err) {
          lastStatus = `LIVE FAIL: ${err}`;
          renderStatusOnly();
          return;
        }
        if (!response?.ok) {
          lastStatus = `LIVE FAIL: ${response?.error || "Report failed"}`;
          renderStatusOnly();
          toast(lastStatus);
          return;
        }
        if (response.stored === false) {
          lastStatus = `LIVE WARN: received but not stored (${response.storeError || "blob"})`;
        } else {
          lastStatus = `LIVE OK → Cursor ✓ ${new Date().toLocaleTimeString()}${
            response.screenshotUrl ? " · screenshot" : ""
          }`;
        }
        renderStatusOnly();
      }
    );
  }

  function renderStatusOnly() {
    const el = document.querySelector("#motivelife-asc-helper-root #ml-asc-status");
    if (el) {
      el.textContent = lastStatus;
      el.style.color = /FAIL|DEAD/i.test(lastStatus)
        ? "#fca5a5"
        : /WARN/i.test(lastStatus)
          ? "#fde68a"
          : "#86efac";
    }
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
    }, 3200);
  }

  function boot() {
    render();
    let last = location.href;
    let lastSig = "";
    setInterval(() => {
      if (contextDead) {
        paintDeadPanel();
        return;
      }
      const read = window.__MOTIVELIFE_ASC_READ__;
      if (!read) return;
      let snap;
      try {
        snap = read();
      } catch (e) {
        if (isContextDead(e)) markDead(e);
        return;
      }
      const sig = JSON.stringify(snap.signals || {});
      if (location.href !== last) {
        last = location.href;
        lastAutoKey = "";
        lastSig = sig;
        bootReported = false;
        render();
        return;
      }
      if (sig !== lastSig) {
        lastSig = sig;
        render();
      } else {
        const steps = window.__MOTIVELIFE_ASC_STEPS__?.(snap) || [];
        maybeLiveReport(snap, pointingFrom(steps), detectStuckLocal(snap.signals));
      }
    }, 2000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
