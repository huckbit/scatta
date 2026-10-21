// Scatta settings page. The popup reads these from chrome.storage.

const DEFAULTS = { defaultMode: "visible", autoClose: false, autoCloseDelay: 2 };

const defaultModeSelect = document.getElementById("default-mode");
const autoCloseToggle = document.getElementById("auto-close");
const delaySelect = document.getElementById("auto-close-delay");
const delayRow = document.getElementById("delay-row");
const savedEl = document.getElementById("saved");

// The delay only matters when auto-close is on.
function updateDelayState() {
  delaySelect.disabled = !autoCloseToggle.checked;
  delayRow.className = autoCloseToggle.checked ? "row" : "row disabled";
}

chrome.storage.local.get(DEFAULTS).then(({ defaultMode, autoClose, autoCloseDelay }) => {
  defaultModeSelect.value = defaultMode;
  autoCloseToggle.checked = autoClose;
  delaySelect.value = String(autoCloseDelay);
  updateDelayState();
});

async function save() {
  updateDelayState();
  await chrome.storage.local.set({
    defaultMode: defaultModeSelect.value,
    autoClose: autoCloseToggle.checked,
    autoCloseDelay: Number(delaySelect.value)
  });
  savedEl.textContent = "Saved.";
}

defaultModeSelect.addEventListener("change", save);
autoCloseToggle.addEventListener("change", save);
delaySelect.addEventListener("change", save);
