/**
 * MotiveLife Click Helper — off by default.
 * Enable per-site via the toolbar popup (icon click).
 * Injects content scripts only when a site is turned ON.
 */

const CONTENT_JS = [
  "content/page-reader.js",
  "content/steps.js",
  "content/coach.js",
  "content/overlay.js",
];
const CONTENT_CSS = ["content/overlay.css"];

function originFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

async function getEnabledOrigins() {
  const cfg = await chrome.storage.local.get(["enabledOrigins"]);
  return Array.isArray(cfg.enabledOrigins) ? cfg.enabledOrigins : [];
}

async function setEnabledOrigins(origins) {
  const unique = [...new Set(origins.filter(Boolean))];
  await chrome.storage.local.set({ enabledOrigins: unique });
  return unique;
}

async function isOriginEnabled(origin) {
  if (!origin) return false;
  const list = await getEnabledOrigins();
  return list.includes(origin);
}

async function setOriginEnabled(origin, enabled) {
  const list = await getEnabledOrigins();
  const next = enabled
    ? list.includes(origin)
      ? list
      : [...list, origin]
    : list.filter((o) => o !== origin);
  await setEnabledOrigins(next);
  return enabled;
}

async function updateBadgeForTab(tabId, enabled) {
  try {
    await chrome.action.setBadgeText({
      tabId,
      text: enabled ? "ON" : "",
    });
    await chrome.action.setBadgeBackgroundColor({
      tabId,
      color: enabled ? "#16a34a" : "#64748b",
    });
    await chrome.action.setTitle({
      tabId,
      title: enabled
        ? "MotiveLife Click Helper — ON for this site (click icon to turn off)"
        : "MotiveLife Click Helper — OFF (click icon to turn on for this site)",
    });
  } catch {
    /* tab may be gone */
  }
}

async function injectHelper(tabId) {
  // Idempotent: content script sets a window flag; we always try inject
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: CONTENT_CSS,
    });
  } catch (error) {
    console.warn("[asc-helper] insertCSS", error);
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: CONTENT_JS,
    });
  } catch (error) {
    console.warn("[asc-helper] executeScript", error);
    throw error;
  }
}

async function disableHelper(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "ASC_SHUTDOWN" });
  } catch {
    /* not injected */
  }
}

async function syncTab(tab) {
  if (!tab?.id || !tab.url) return;
  const origin = originFromUrl(tab.url);
  if (!origin) {
    await updateBadgeForTab(tab.id, false);
    return;
  }
  const enabled = await isOriginEnabled(origin);
  await updateBadgeForTab(tab.id, enabled);
  if (enabled) {
    try {
      await injectHelper(tab.id);
    } catch {
      /* inject fails on chrome:// etc. */
    }
  }
}

async function toggleActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    return { ok: false, error: "No active tab" };
  }
  const origin = originFromUrl(tab.url);
  if (!origin) {
    return { ok: false, error: "Cannot run on this page (chrome://, store, etc.)" };
  }
  const currently = await isOriginEnabled(origin);
  const enabled = !currently;
  await setOriginEnabled(origin, enabled);
  if (enabled) {
    await injectHelper(tab.id);
  } else {
    await disableHelper(tab.id);
  }
  await updateBadgeForTab(tab.id, enabled);
  return { ok: true, enabled, origin, tabId: tab.id };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ASC_OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "ASC_TOGGLE_SITE") {
    toggleActiveTab().then(sendResponse).catch((error) =>
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
    );
    return true;
  }

  if (message?.type === "ASC_GET_SITE_STATE") {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const origin = tab?.url ? originFromUrl(tab.url) : null;
      const enabled = origin ? await isOriginEnabled(origin) : false;
      sendResponse({
        ok: true,
        origin,
        enabled,
        tabId: tab?.id ?? null,
        url: tab?.url || "",
      });
    })().catch((error) =>
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
    );
    return true;
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
    return true;
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    syncTab(tab);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await syncTab(tab);
  } catch {
    /* ignore */
  }
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
    };
  }

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
    };
  }

  return {
    ok: true,
    steps: data.steps || [],
    stuckReason: data.stuckReason || null,
    screenshotUrl: data.screenshotUrl || null,
    stored: data.stored === true,
    storeError: data.storeError || (data.stored === true ? null : "Server did not confirm blob store"),
    id: data.id,
    message: data.message,
  };
}
