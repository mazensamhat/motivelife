/**
 * Captures visible tab screenshot + forwards reports to MotiveLife API.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ASC_OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "ASC_CAPTURE_AND_REPORT") {
    handleReport(message, sender)
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    return true; // async
  }

  if (message?.type === "ASC_GET_CONFIG") {
    chrome.storage.sync.get(["apiBase", "secret", "autoReport"], (cfg) => {
      sendResponse({
        apiBase: cfg.apiBase || "https://www.mymotivelife.com",
        secret: cfg.secret || "",
        autoReport: cfg.autoReport !== false,
      });
    });
    return true;
  }

  return false;
});

async function handleReport(message, sender) {
  const windowId = sender.tab?.windowId;
  let screenshotDataUrl = null;

  try {
    if (windowId != null && !message.skipScreenshot) {
      screenshotDataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: "jpeg",
        quality: 55,
      });
    }
  } catch (error) {
    console.warn("[asc-helper] captureVisibleTab failed", error);
  }

  const cfg = await chrome.storage.sync.get(["apiBase", "secret"]);
  const apiBase = (cfg.apiBase || "https://www.mymotivelife.com").replace(/\/$/, "");
  const secret = (cfg.secret || "").trim();
  if (!secret) {
    return {
      ok: false,
      error:
        "EXTENSION SECRET EMPTY — open Options, paste ASC_HELPER_SECRET (from Vercel), Save, Test. Redeploying Vercel does NOT fill the extension.",
      screenshotDataUrl,
    };
  }

  // Live heartbeats can skip screenshot to stay fast/light
  if (message.skipScreenshot) screenshotDataUrl = null;

  const res = await fetch(`${apiBase}/api/asc-helper/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      snapshot: message.snapshot,
      screenshotDataUrl,
      note: message.note || null,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: data.error || `Report failed (${res.status})`,
      screenshotDataUrl,
    };
  }

  return {
    ok: true,
    steps: data.steps || [],
    stuckReason: data.stuckReason || null,
    screenshotUrl: data.screenshotUrl || null,
    stored: data.stored !== false,
    storeError: data.storeError || null,
    id: data.id,
    message: data.message,
  };
}
