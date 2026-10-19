// Loads popup.js in a sandbox with a fake popup DOM and fake Chrome APIs,
// so tests run in plain Node with no browser and no dependencies.

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const POPUP_JS = fs.readFileSync(path.join(ROOT, "popup.js"), "utf8");

// Just enough of a PNG (signature + IHDR) for the size to be read back.
function pngBase64(width, height) {
  const buf = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf.toString("base64");
}

async function pngSize(blob) {
  const bytes = Buffer.from(await blob.arrayBuffer());
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function fakeElement(props = {}) {
  const listeners = {};
  return {
    textContent: "",
    className: "",
    checked: false,
    disabled: false,
    ...props,
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
    // Fires the event and returns whatever the handlers return,
    // so tests can await the async work a click starts.
    dispatch(type) {
      return Promise.all((listeners[type] || []).map((fn) => fn()));
    }
  };
}

const flush = () => new Promise((r) => setImmediate(r));

// Objects made inside the sandbox have the sandbox's Object prototype,
// which strict deep-equal treats as different. Copy them into ours.
const own = (value) => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

// options:
//   saveFile       initial stored "Save as file" setting
//   tab            the active tab (or null for none)
//   visible        { width, height } of the visible-area capture
//   pages          list of page measurements returned in turn by the
//                  in-page measure script (the last one repeats)
//   failVisible / failDebugger / failClipboard / failDownload: Error to throw
async function loadPopup(options = {}) {
  const {
    saveFile = false,
    tab = { id: 7, windowId: 3, url: "https://www.example.com/some/page" },
    visible = { width: 1280, height: 800 },
    pages = [{ width: 1280, height: 3000 }],
    failVisible,
    failDebugger,
    failClipboard,
    failDownload
  } = options;

  const calls = {
    storageSet: [],
    clipboard: [],
    downloads: [],
    debugger: [],
    focus: 0
  };

  const elements = {
    full: fakeElement(),
    visible: fakeElement(),
    status: fakeElement(),
    "save-file": fakeElement(),
    "toggle-hint": fakeElement()
  };
  const actionLabels = [fakeElement({ textContent: "Copy" }), fakeElement({ textContent: "Copy" })];

  let measureIndex = 0;
  const chrome = {
    storage: {
      local: {
        get: async (defaults) => ({ ...defaults, saveFile }),
        set: async (value) => { calls.storageSet.push(own(value)); }
      }
    },
    tabs: {
      query: async () => (tab ? [tab] : []),
      captureVisibleTab: async (windowId, opts) => {
        if (failVisible) throw failVisible;
        calls.captureVisible = { windowId, opts };
        return "data:image/png;base64," + pngBase64(visible.width, visible.height);
      }
    },
    debugger: {
      attach: async (target, version) => {
        calls.debugger.push(["attach", target, version]);
        if (failDebugger) throw failDebugger;
      },
      detach: async (target) => { calls.debugger.push(["detach", target]); },
      sendCommand: async (target, method, params) => {
        calls.debugger.push([method, own(params)]);
        if (method === "Runtime.evaluate") {
          const page = pages[Math.min(measureIndex++, pages.length - 1)];
          return { result: { value: JSON.stringify(page) } };
        }
        if (method === "Page.captureScreenshot") {
          return { data: pngBase64(params.clip.width, params.clip.height) };
        }
        return {};
      }
    },
    downloads: {
      download: async (opts) => {
        if (failDownload) throw failDownload;
        calls.downloads.push(own(opts));
        return 1;
      }
    }
  };

  const sandbox = {
    chrome,
    document: {
      getElementById: (id) => elements[id],
      querySelectorAll: (sel) => (sel === ".action" ? actionLabels : [])
    },
    window: { focus: () => { calls.focus++; } },
    navigator: {
      clipboard: {
        write: async (items) => {
          if (failClipboard) throw failClipboard;
          calls.clipboard.push(...items);
        }
      }
    },
    ClipboardItem: class {
      constructor(data) { this.data = data; }
    },
    createImageBitmap: async (blob) => ({ ...(await pngSize(blob)), close() {} }),
    // Short waits (the page re-layout pause) run at once; long ones
    // (freeing the download URL after a minute) are skipped.
    setTimeout: (fn, ms) => (ms >= 1000 ? 0 : setImmediate(fn)),
    Blob,
    URL,
    atob,
    JSON,
    Promise,
    console: { ...console, error: () => {} }
  };

  vm.createContext(sandbox);
  vm.runInContext(POPUP_JS, sandbox, { filename: "popup.js" });
  await flush(); // let the stored setting load

  return { popup: sandbox, elements, actionLabels, calls };
}

module.exports = { ROOT, loadPopup, pngBase64, pngSize, flush };
