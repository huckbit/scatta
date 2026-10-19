// Runs the real full-page measuring script (MEASURE_SCRIPT in popup.js)
// against a fake page. The popup tests replace its result with a fake,
// and coverage can't see it because it is sent to the page as a string.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { loadPopup } = require("./helpers");

// box: { scrollHeight, clientHeight, overflowY }
function fakePage({ width = 1280, height = 800, docHeight = height, bodyHeight = docHeight, boxes = [], noBody = false }) {
  const documentElement = { scrollHeight: docHeight, clientHeight: height };
  const body = noBody ? null : { scrollHeight: bodyHeight, clientHeight: height };
  const elements = [documentElement, ...(body ? [body] : []), ...boxes];
  return {
    window: { innerWidth: width, innerHeight: height },
    document: { documentElement, body, querySelectorAll: () => elements },
    getComputedStyle: (el) => ({ overflowY: el.overflowY || "visible" }),
    JSON,
    Math
  };
}

async function measure(page) {
  const { popup } = await loadPopup();
  const script = vm.runInContext("MEASURE_SCRIPT", popup);
  return JSON.parse(vm.runInNewContext(script, page));
}

describe("Full page measuring script", () => {
  test("returns the page size for a normal long page", async () => {
    assert.deepEqual(await measure(fakePage({ docHeight: 3000 })), { width: 1280, height: 3000 });
  });

  test("uses the body when it is taller than the document element", async () => {
    assert.deepEqual(await measure(fakePage({ docHeight: 800, bodyHeight: 2500 })), { width: 1280, height: 2500 });
  });

  test("never returns less than the window height", async () => {
    assert.deepEqual(await measure(fakePage({ docHeight: 300 })), { width: 1280, height: 800 });
  });

  test("adds the hidden part of an app's own scrolling area", async () => {
    // Fixed sidebar layout: the page itself doesn't scroll, the main panel does.
    const main = { overflowY: "auto", clientHeight: 700, scrollHeight: 4700 };
    assert.deepEqual(await measure(fakePage({ boxes: [main] })), { width: 1280, height: 4800 });
  });

  test("uses the tallest scrolling area when there are several", async () => {
    const boxes = [
      { overflowY: "scroll", clientHeight: 700, scrollHeight: 1700 },
      { overflowY: "auto", clientHeight: 600, scrollHeight: 3600 }
    ];
    assert.deepEqual(await measure(fakePage({ boxes })), { width: 1280, height: 3800 });
  });

  test("ignores small scrolling widgets like dropdowns", async () => {
    const dropdown = { overflowY: "auto", clientHeight: 200, scrollHeight: 2000 };
    assert.deepEqual(await measure(fakePage({ boxes: [dropdown] })), { width: 1280, height: 800 });
  });

  test("ignores boxes that don't scroll", async () => {
    const boxes = [
      { overflowY: "hidden", clientHeight: 700, scrollHeight: 4700 },
      { overflowY: "visible", clientHeight: 700, scrollHeight: 4700 },
      { overflowY: "auto", clientHeight: 700, scrollHeight: 700 }
    ];
    assert.deepEqual(await measure(fakePage({ boxes })), { width: 1280, height: 800 });
  });

  test("works on a page with no body", async () => {
    assert.deepEqual(await measure(fakePage({ docHeight: 1500, noBody: true })), { width: 1280, height: 1500 });
  });
});
