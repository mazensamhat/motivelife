const siteEl = document.getElementById("site");
const toggleEl = document.getElementById("toggle");
const hintEl = document.getElementById("hint");
const errEl = document.getElementById("err");

function paint(state) {
  errEl.hidden = true;
  if (!state?.ok) {
    siteEl.textContent = "Unavailable";
    toggleEl.disabled = true;
    toggleEl.textContent = "OFF";
    toggleEl.className = "toggle off";
    errEl.hidden = false;
    errEl.textContent = state?.error || "Could not read tab";
    return;
  }
  if (!state.origin) {
    siteEl.textContent = "This page cannot run the helper";
    toggleEl.disabled = true;
    toggleEl.textContent = "OFF";
    toggleEl.className = "toggle off";
    hintEl.textContent = "Open a normal https site, then turn it on.";
    return;
  }
  siteEl.textContent = state.origin;
  toggleEl.disabled = false;
  if (state.enabled) {
    toggleEl.textContent = "ON — click to turn OFF";
    toggleEl.className = "toggle on";
    hintEl.textContent = "Helper is active on this site. Click again to stop it.";
  } else {
    toggleEl.textContent = "OFF — click to turn ON";
    toggleEl.className = "toggle off";
    hintEl.textContent = "Off by default. Turn on only when you need the coach.";
  }
}

function refresh() {
  chrome.runtime.sendMessage({ type: "ASC_GET_SITE_STATE" }, (state) => {
    if (chrome.runtime.lastError) {
      paint({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }
    paint(state);
  });
}

toggleEl.addEventListener("click", () => {
  toggleEl.disabled = true;
  chrome.runtime.sendMessage({ type: "ASC_TOGGLE_SITE" }, (result) => {
    if (chrome.runtime.lastError) {
      paint({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }
    if (!result?.ok) {
      paint({ ok: false, error: result?.error || "Toggle failed" });
      return;
    }
    paint({
      ok: true,
      origin: result.origin,
      enabled: result.enabled,
    });
  });
});

refresh();
