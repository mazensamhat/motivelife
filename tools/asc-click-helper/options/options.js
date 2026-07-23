const apiBaseEl = document.getElementById("apiBase");
const secretEl = document.getElementById("secret");
const autoEl = document.getElementById("autoReport");
const statusEl = document.getElementById("status");

chrome.storage.sync.get(["apiBase", "secret", "autoReport"], (cfg) => {
  apiBaseEl.value = cfg.apiBase || "https://www.mymotivelife.com";
  secretEl.value = cfg.secret || "";
  autoEl.checked = cfg.autoReport !== false;
});

document.getElementById("save").addEventListener("click", () => {
  chrome.storage.sync.set(
    {
      apiBase: apiBaseEl.value.trim() || "https://www.mymotivelife.com",
      secret: secretEl.value.trim(),
      autoReport: autoEl.checked,
    },
    () => {
      statusEl.textContent = "Saved.";
      setTimeout(() => (statusEl.textContent = ""), 2000);
    }
  );
});
