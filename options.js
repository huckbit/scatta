// Tab Selfie settings page. The popup reads these from chrome.storage.

const DEFAULTS = { autoClose: false, autoCloseDelay: 2 };

const autoCloseToggle = document.getElementById("auto-close");
const delaySelect = document.getElementById("auto-close-delay");
const delayRow = document.getElementById("delay-row");
const savedEl = document.getElementById("saved");

// The delay only matters when auto-close is on.
function updateDelayState() {
  delaySelect.disabled = !autoCloseToggle.checked;
  delayRow.className = autoCloseToggle.checked ? "row" : "row disabled";
}

chrome.storage.local.get(DEFAULTS).then(({ autoClose, autoCloseDelay }) => {
  autoCloseToggle.checked = autoClose;
  delaySelect.value = String(autoCloseDelay);
  updateDelayState();
});

async function save() {
  updateDelayState();
  await chrome.storage.local.set({
    autoClose: autoCloseToggle.checked,
    autoCloseDelay: Number(delaySelect.value)
  });
  savedEl.textContent = "Saved.";
}

autoCloseToggle.addEventListener("change", save);
delaySelect.addEventListener("change", save);
