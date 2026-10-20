// Tab Selfie: copies a screenshot of the current tab to the clipboard.

const fullBtn = document.getElementById("full");
const visibleBtn = document.getElementById("visible");
const statusEl = document.getElementById("status");
const saveToggle = document.getElementById("save-file");
const toggleHint = document.getElementById("toggle-hint");
const settingsLink = document.getElementById("settings");

// Pages taller than this (in image pixels) get a gentle warning,
// because big images are shrunk when pasted into a chat.
const TALL_WARNING_PX = 5000;

// Set on the settings page (options.html).
const settings = { autoClose: false, autoCloseDelay: 2 };
let closeTimer = null;

function updateLabels() {
  const save = saveToggle.checked;
  document.querySelectorAll(".action").forEach((el) => {
    el.textContent = save ? "Save" : "Copy";
  });
  toggleHint.textContent = save ? "On: saves a PNG to Downloads" : "Off: copies to the clipboard";
}

chrome.storage.local.get({ saveFile: false, ...settings }).then(({ saveFile, autoClose, autoCloseDelay }) => {
  saveToggle.checked = saveFile;
  settings.autoClose = autoClose;
  settings.autoCloseDelay = autoCloseDelay;
  updateLabels();
});

settingsLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// Any click or key press means the user wants to do something else,
// so don't close the popup on them.
function cancelClose() {
  clearTimeout(closeTimer);
  closeTimer = null;
}
document.addEventListener("pointerdown", cancelClose);
document.addEventListener("keydown", cancelClose);

saveToggle.addEventListener("change", () => {
  chrome.storage.local.set({ saveFile: saveToggle.checked });
  updateLabels();
  setStatus("");
});

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = kind;
}

function setBusy(busy) {
  fullBtn.disabled = busy;
  visibleBtn.disabled = busy;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab found.");
  return tab;
}

function base64ToPngBlob(base64) {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: "image/png" });
}

async function copyBlob(blob) {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

function makeFileName(tab) {
  let host = "page";
  try { host = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (_) {}
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  return `tab-selfie/${host}_${stamp}.png`;
}

async function saveBlob(blob, tab) {
  const url = URL.createObjectURL(blob);
  try {
    return await chrome.downloads.download({ url, filename: makeFileName(tab), saveAs: false });
  } finally {
    // Give Chrome time to read the file before freeing it.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

// Resolves with the download's final state ("complete" or "interrupted").
// Closing the popup frees the image, so a big file must finish first.
function waitForDownload(id) {
  return new Promise((resolve) => {
    const finish = (state) => {
      chrome.downloads.onChanged.removeListener(onChanged);
      resolve(state);
    };
    const onChanged = (delta) => {
      if (delta.id === id && delta.state && delta.state.current !== "in_progress") {
        finish(delta.state.current);
      }
    };
    chrome.downloads.onChanged.addListener(onChanged);
    // It may already be done before the listener was added.
    chrome.downloads.search({ id }).then(([item]) => {
      if (item && item.state !== "in_progress") finish(item.state);
    });
  });
}

async function closeWhenDone(downloadId) {
  if (downloadId !== undefined) {
    const state = await waitForDownload(downloadId);
    if (state !== "complete") {
      setStatus(friendlyError("Download interrupted"), "error");
      return;
    }
  }
  cancelClose();
  closeTimer = setTimeout(() => window.close(), settings.autoCloseDelay * 1000);
}

async function describeSize(blob) {
  const img = await createImageBitmap(blob);
  const size = { width: img.width, height: img.height };
  img.close();
  return size;
}

// Runs in the page. Works out how tall the page would be if nothing
// scrolled inside its own box (like an app with a fixed sidebar).
const MEASURE_SCRIPT = `(() => {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  let extra = 0;
  for (const el of document.querySelectorAll("*")) {
    if (el === document.documentElement || el === document.body) continue;
    const style = getComputedStyle(el);
    if (!/(auto|scroll)/.test(style.overflowY)) continue;
    const hidden = el.scrollHeight - el.clientHeight;
    if (hidden <= 0) continue;
    // Only count boxes that are a real part of the layout, not small widgets.
    if (el.clientHeight < vh * 0.4) continue;
    extra = Math.max(extra, hidden);
  }
  const docHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body ? document.body.scrollHeight : 0
  );
  return JSON.stringify({ width: vw, height: Math.max(docHeight, vh + extra) });
})()`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function measurePage(target) {
  const res = await chrome.debugger.sendCommand(target, "Runtime.evaluate", {
    expression: MEASURE_SCRIPT,
    returnByValue: true
  });
  return JSON.parse(res.result.value);
}

// Full page: makes the browser window "pretend" to be as tall as the
// whole page, takes the screenshot, then puts the window back.
async function captureFullPage(tab) {
  const target = { tabId: tab.id };
  await chrome.debugger.attach(target, "1.3");
  let overridden = false;
  try {
    let { width, height } = await measurePage(target);

    await chrome.debugger.sendCommand(target, "Emulation.setDeviceMetricsOverride", {
      width, height, deviceScaleFactor: 0, mobile: false
    });
    overridden = true;
    await sleep(400); // let the page lay itself out at the new size

    // Measure again: some pages grow once they have more room.
    const after = await measurePage(target);
    if (after.height > height) {
      height = after.height;
      await chrome.debugger.sendCommand(target, "Emulation.setDeviceMetricsOverride", {
        width, height, deviceScaleFactor: 0, mobile: false
      });
      await sleep(400);
    }

    const result = await chrome.debugger.sendCommand(target, "Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height, scale: 1 }
    });
    return base64ToPngBlob(result.data);
  } finally {
    if (overridden) {
      try { await chrome.debugger.sendCommand(target, "Emulation.clearDeviceMetricsOverride"); } catch (_) {}
    }
    // Always detach, so the yellow "debugging" bar goes away.
    try { await chrome.debugger.detach(target); } catch (_) { /* already detached */ }
  }
}

// Visible area: a normal screenshot of what is on screen.
async function captureVisible(tab) {
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  return base64ToPngBlob(dataUrl.split(",")[1]);
}

function friendlyError(err) {
  const msg = String(err && err.message ? err.message : err);
  if (/chrome:\/\/|cannot access|Cannot attach|chrome-extension/i.test(msg)) {
    return "Chrome doesn't allow screenshots of this page (for example chrome:// pages or the Web Store).";
  }
  if (/Another debugger/i.test(msg)) {
    return "DevTools or another tool is already debugging this tab. Close DevTools and try again.";
  }
  if (/download/i.test(msg)) {
    return "Couldn't save the file. Check Chrome's download settings and try again.";
  }
  if (/Document is not focused|clipboard/i.test(msg)) {
    return "Couldn't copy to the clipboard. Click the Tab Selfie icon again and retry.";
  }
  return "Something went wrong: " + msg;
}

async function run(mode) {
  cancelClose();
  setBusy(true);
  setStatus(mode === "full" ? "Capturing the full page..." : "Capturing the visible area...");
  let closeAfter = false;
  let downloadId;
  try {
    const tab = await getActiveTab();
    const blob = mode === "full" ? await captureFullPage(tab) : await captureVisible(tab);

    const saving = saveToggle.checked;
    if (saving) {
      downloadId = await saveBlob(blob, tab);
    } else {
      // Bring focus back to the popup before writing to the clipboard.
      window.focus();
      await copyBlob(blob);
    }

    const { width, height } = await describeSize(blob);
    const done = saving
      ? `Saved to Downloads/tab-selfie (${width} × ${height} px).`
      : `Copied (${width} × ${height} px). Ready to paste.`;
    if (mode === "full" && height > TALL_WARNING_PX) {
      setStatus(
        `${done} This is a long page, so small text may be hard to read in a chat. Try the visible area for detail.`,
        "warn"
      );
    } else {
      setStatus(done, "ok");
      // Only close on a plain success: warnings and errors need reading.
      closeAfter = settings.autoClose;
    }
  } catch (err) {
    console.error(err);
    setStatus(friendlyError(err), "error");
  } finally {
    setBusy(false);
  }
  if (closeAfter) await closeWhenDone(downloadId);
}

fullBtn.addEventListener("click", () => run("full"));
visibleBtn.addEventListener("click", () => run("visible"));
