const apiBaseEl = document.getElementById("apiBase");
const secretEl = document.getElementById("secret");
const autoEl = document.getElementById("autoReport");
const liveEl = document.getElementById("liveReport");
const statusEl = document.getElementById("status");

chrome.storage.sync.get(["apiBase", "secret", "autoReport", "liveReport"], (cfg) => {
  apiBaseEl.value = cfg.apiBase || "https://www.mymotivelife.com";
  secretEl.value = cfg.secret || "";
  autoEl.checked = cfg.autoReport !== false;
  if (liveEl) liveEl.checked = cfg.liveReport !== false;
});

function setStatus(msg, ok) {
  statusEl.textContent = msg;
  statusEl.style.color = ok === true ? "#15803d" : ok === false ? "#b91c1c" : "#334155";
}

document.getElementById("save").addEventListener("click", () => {
  chrome.storage.sync.set(
    {
      apiBase: apiBaseEl.value.trim() || "https://www.mymotivelife.com",
      secret: secretEl.value.trim(),
      autoReport: autoEl.checked,
      liveReport: liveEl ? liveEl.checked : true,
    },
    () => {
      setStatus("Saved in the browser extension. Now click Test connection.", true);
    }
  );
});

document.getElementById("test").addEventListener("click", async () => {
  const apiBase = (apiBaseEl.value.trim() || "https://www.mymotivelife.com").replace(/\/$/, "");
  const secret = secretEl.value.trim();
  if (!secret) {
    setStatus("FAIL: paste ASC_HELPER_SECRET here (from Vercel). Vercel alone is not enough.", false);
    return;
  }
  chrome.storage.sync.set({
    apiBase,
    secret,
    autoReport: autoEl.checked,
    liveReport: liveEl ? liveEl.checked : true,
  });
  setStatus("Testing…", null);
  try {
    const res = await fetch(`${apiBase}/api/asc-helper/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        snapshot: {
          url: "https://appstoreconnect.apple.com/options-test",
          path: "/options-test",
          title: "options-test",
          headings: [],
          buttons: [],
          banners: [],
          signals: { pageMode: "other", optionsTest: true },
        },
        note: "options-test",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(
        `FAIL ${res.status}: ${data.error || "unauthorized"} — secret must match Vercel ASC_HELPER_SECRET exactly.`,
        false
      );
      return;
    }
    setStatus(
      data.stored === false
        ? `WARN: server got it but did not store (${data.storeError || "blob"}).`
        : "LIVE OK — Cursor can see reports now. Go back to ASC and click Report now.",
      data.stored !== false
    );
  } catch (e) {
    setStatus(`FAIL: ${e?.message || e}`, false);
  }
});
