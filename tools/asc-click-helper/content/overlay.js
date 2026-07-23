/**
 * Floating overlay: live steps + copy report for Cursor.
 */
(function () {
  const ROOT_ID = "motivelife-asc-helper-root";

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;
    root = document.createElement("div");
    root.id = ROOT_ID;
    document.documentElement.appendChild(root);
    return root;
  }

  function render() {
    const read = window.__MOTIVELIFE_ASC_READ__;
    const stepsFn = window.__MOTIVELIFE_ASC_STEPS__;
    if (!read || !stepsFn) return;

    const snapshot = read();
    const steps = stepsFn(snapshot);
    const root = ensureRoot();

    root.innerHTML = `
      <div class="ml-asc-panel" data-collapsed="false">
        <div class="ml-asc-header">
          <strong>MotiveLife ASC Helper</strong>
          <div class="ml-asc-header-actions">
            <button type="button" class="ml-asc-btn" id="ml-asc-refresh">Refresh</button>
            <button type="button" class="ml-asc-btn ml-asc-primary" id="ml-asc-copy">Copy for Cursor</button>
            <button type="button" class="ml-asc-icon" id="ml-asc-min" title="Minimize">–</button>
          </div>
        </div>
        <div class="ml-asc-body">
          <p class="ml-asc-url">${escapeHtml(shortUrl(snapshot.url))}</p>
          <p class="ml-asc-meta">Signals: ${escapeHtml(signalSummary(snapshot.signals))}</p>
          <ol class="ml-asc-steps">
            ${steps
              .map(
                (st, i) => `
              <li>
                <div class="ml-asc-step-title">${i + 1}. ${escapeHtml(st.title)}</div>
                <ul>
                  ${st.clicks.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}
                </ul>
                ${st.why ? `<p class="ml-asc-why">${escapeHtml(st.why)}</p>` : ""}
              </li>`
              )
              .join("")}
          </ol>
          <p class="ml-asc-foot">Stay on <b>1.0.4</b>. Do not create 1.0.5. Paste “Copy for Cursor” into Cursor when stuck.</p>
        </div>
        <div class="ml-asc-toast" id="ml-asc-toast" hidden></div>
      </div>
    `;

    root.querySelector("#ml-asc-refresh")?.addEventListener("click", () => render());
    root.querySelector("#ml-asc-copy")?.addEventListener("click", async () => {
      const report = buildReport(snapshot, steps);
      try {
        await navigator.clipboard.writeText(report);
        toast("Copied — paste into Cursor chat");
      } catch {
        // fallback
        const ta = document.createElement("textarea");
        ta.value = report;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        toast("Copied — paste into Cursor chat");
      }
    });
    root.querySelector("#ml-asc-min")?.addEventListener("click", () => {
      const panel = root.querySelector(".ml-asc-panel");
      const collapsed = panel?.getAttribute("data-collapsed") === "true";
      panel?.setAttribute("data-collapsed", collapsed ? "false" : "true");
    });
  }

  function buildReport(snapshot, steps) {
    return [
      "MOTIVELIFE_ASC_HELPER_REPORT",
      `time: ${snapshot.capturedAt}`,
      `url: ${snapshot.url}`,
      `title: ${snapshot.title}`,
      `headings: ${(snapshot.headings || []).join(" | ")}`,
      `buttons: ${(snapshot.buttons || []).slice(0, 25).join(" · ")}`,
      `banners: ${(snapshot.banners || []).join(" || ")}`,
      `signals: ${JSON.stringify(snapshot.signals)}`,
      "next_steps:",
      ...steps.map(
        (st, i) =>
          `${i + 1}. ${st.title}\n` +
          st.clicks.map((c) => `   - ${c}`).join("\n") +
          (st.why ? `\n   why: ${st.why}` : "")
      ),
      "",
      "Please tell me the exact next click based on this page.",
    ].join("\n");
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
    }, 2500);
  }

  function boot() {
    render();
    // Re-read when ASC is a heavy SPA
    let last = location.href;
    setInterval(() => {
      if (location.href !== last) {
        last = location.href;
        render();
      }
    }, 1200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
