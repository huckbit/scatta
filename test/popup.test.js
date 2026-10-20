const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { loadPopup, pngBase64, pngSize, flush } = require("./helpers");

describe("Save as file toggle", () => {
  test("defaults to copying", async () => {
    const { elements, actionLabels } = await loadPopup();
    assert.equal(elements["save-file"].checked, false);
    assert.deepEqual(actionLabels.map((el) => el.textContent), ["Copy", "Copy"]);
    assert.equal(elements["toggle-hint"].textContent, "Off: copies to the clipboard");
  });

  test("restores the saved setting", async () => {
    const { elements, actionLabels } = await loadPopup({ saveFile: true });
    assert.equal(elements["save-file"].checked, true);
    assert.deepEqual(actionLabels.map((el) => el.textContent), ["Save", "Save"]);
    assert.equal(elements["toggle-hint"].textContent, "On: saves a PNG to Downloads");
  });

  test("remembers a change and updates the labels", async () => {
    const { elements, actionLabels, calls } = await loadPopup();
    elements.status.textContent = "old message";
    elements["save-file"].checked = true;
    await elements["save-file"].dispatch("change");

    assert.deepEqual(calls.storageSet, [{ saveFile: true }]);
    assert.deepEqual(actionLabels.map((el) => el.textContent), ["Save", "Save"]);
    assert.equal(elements.status.textContent, "");
  });
});

describe("makeFileName", () => {
  test("uses the host without www and a timestamp", async () => {
    const { popup } = await loadPopup();
    const name = popup.makeFileName({ url: "https://www.example.com/a?b=c" });
    assert.match(name, /^tab-selfie\/example\.com_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/);
  });

  test("falls back to 'page' when the URL is missing or invalid", async () => {
    const { popup } = await loadPopup();
    assert.match(popup.makeFileName({}), /^tab-selfie\/page_/);
    assert.match(popup.makeFileName({ url: "not a url" }), /^tab-selfie\/page_/);
  });
});

describe("base64ToPngBlob", () => {
  test("decodes to a PNG blob with the same bytes", async () => {
    const { popup } = await loadPopup();
    const blob = popup.base64ToPngBlob(pngBase64(10, 20));
    assert.equal(blob.type, "image/png");
    assert.deepEqual(await pngSize(blob), { width: 10, height: 20 });
  });
});

describe("friendlyError", () => {
  const cases = [
    ["Cannot access contents of url \"chrome://settings\"", /doesn't allow screenshots/],
    ["Cannot attach to this target.", /doesn't allow screenshots/],
    ["Another debugger is already attached to the tab", /DevTools or another tool/],
    ["Download failed", /Couldn't save the file/],
    ["Document is not focused.", /Couldn't copy to the clipboard/],
    ["Something odd", /^Something went wrong: Something odd$/]
  ];
  for (const [message, expected] of cases) {
    test(`maps "${message}"`, async () => {
      const { popup } = await loadPopup();
      assert.match(popup.friendlyError(new Error(message)), expected);
    });
  }

  test("handles errors that are plain strings", async () => {
    const { popup } = await loadPopup();
    assert.equal(popup.friendlyError("boom"), "Something went wrong: boom");
  });
});

describe("Copy visible area", () => {
  test("copies a screenshot of the current window", async () => {
    const { elements, calls } = await loadPopup({ visible: { width: 1440, height: 900 } });
    await elements.visible.dispatch("click");

    assert.equal(calls.captureVisible.windowId, 3);
    assert.equal(calls.focus, 1);
    assert.equal(calls.clipboard.length, 1);
    assert.deepEqual(await pngSize(calls.clipboard[0].data["image/png"]), { width: 1440, height: 900 });
    assert.equal(elements.status.textContent, "Copied (1440 × 900 px). Ready to paste.");
    assert.equal(elements.status.className, "ok");
    assert.equal(calls.debugger.length, 0, "visible capture should not use the debugger");
  });

  test("re-enables the buttons when done", async () => {
    const { elements } = await loadPopup();
    await elements.visible.dispatch("click");
    assert.equal(elements.full.disabled, false);
    assert.equal(elements.visible.disabled, false);
  });

  test("saves to Downloads when Save as file is on", async () => {
    const { elements, calls } = await loadPopup({ saveFile: true });
    await elements.visible.dispatch("click");

    assert.equal(calls.clipboard.length, 0);
    assert.equal(calls.downloads.length, 1);
    assert.match(calls.downloads[0].filename, /^tab-selfie\/example\.com_.*\.png$/);
    assert.equal(calls.downloads[0].saveAs, false);
    assert.match(elements.status.textContent, /^Saved to Downloads\/tab-selfie \(1280 × 800 px\)\.$/);
  });

  test("shows a friendly error on pages Chrome blocks", async () => {
    const { elements } = await loadPopup({
      failVisible: new Error("Cannot access contents of url \"chrome://extensions/\"")
    });
    await elements.visible.dispatch("click");

    assert.equal(elements.status.className, "error");
    assert.match(elements.status.textContent, /doesn't allow screenshots/);
    assert.equal(elements.visible.disabled, false);
  });

  test("shows a friendly error when the clipboard write fails", async () => {
    const { elements } = await loadPopup({ failClipboard: new Error("Document is not focused.") });
    await elements.visible.dispatch("click");
    assert.match(elements.status.textContent, /Couldn't copy to the clipboard/);
  });

  test("shows an error when there is no active tab", async () => {
    const { elements } = await loadPopup({ tab: null });
    await elements.visible.dispatch("click");
    assert.equal(elements.status.textContent, "Something went wrong: No active tab found.");
  });
});

describe("Copy full page", () => {
  const methods = (calls) => calls.debugger.map((c) => c[0]);

  test("resizes, captures the whole page, then restores the tab", async () => {
    const { elements, calls } = await loadPopup({ pages: [{ width: 1280, height: 3000 }] });
    await elements.full.dispatch("click");

    assert.deepEqual(methods(calls), [
      "attach",
      "Runtime.evaluate",
      "Emulation.setDeviceMetricsOverride",
      "Runtime.evaluate",
      "Page.captureScreenshot",
      "Emulation.clearDeviceMetricsOverride",
      "detach"
    ]);
    const shot = calls.debugger.find((c) => c[0] === "Page.captureScreenshot")[1];
    assert.deepEqual(shot.clip, { x: 0, y: 0, width: 1280, height: 3000, scale: 1 });
    assert.equal(shot.captureBeyondViewport, true);

    assert.deepEqual(await pngSize(calls.clipboard[0].data["image/png"]), { width: 1280, height: 3000 });
    assert.equal(elements.status.textContent, "Copied (1280 × 3000 px). Ready to paste.");
    assert.equal(elements.status.className, "ok");
  });

  test("measures again when the page grows after resizing", async () => {
    const { elements, calls } = await loadPopup({
      pages: [{ width: 1280, height: 3000 }, { width: 1280, height: 3600 }]
    });
    await elements.full.dispatch("click");

    const overrides = calls.debugger.filter((c) => c[0] === "Emulation.setDeviceMetricsOverride");
    assert.deepEqual(overrides.map((c) => c[1].height), [3000, 3600]);
    const shot = calls.debugger.find((c) => c[0] === "Page.captureScreenshot")[1];
    assert.equal(shot.clip.height, 3600);
  });

  test("warns that very long pages may be hard to read", async () => {
    const { elements } = await loadPopup({ pages: [{ width: 1280, height: 9000 }] });
    await elements.full.dispatch("click");

    assert.equal(elements.status.className, "warn");
    assert.match(elements.status.textContent, /This is a long page/);
  });

  test("does not warn for a long visible area", async () => {
    const { elements } = await loadPopup({ visible: { width: 1280, height: 9000 } });
    await elements.visible.dispatch("click");
    assert.equal(elements.status.className, "ok");
  });

  test("tells the user to close DevTools when it is attached", async () => {
    const { elements, calls } = await loadPopup({
      failDebugger: new Error("Another debugger is already attached to the tab with id: 7.")
    });
    await elements.full.dispatch("click");

    assert.match(elements.status.textContent, /Close DevTools/);
    assert.ok(!methods(calls).includes("detach"), "should not detach a debugger it never attached");
  });

  test("always detaches, even when the screenshot fails", async () => {
    const { elements, calls } = await loadPopup({ failDownload: new Error("Download failed"), saveFile: true });
    await elements.full.dispatch("click");

    assert.equal(methods(calls).at(-1), "detach");
    assert.ok(methods(calls).includes("Emulation.clearDeviceMetricsOverride"));
    assert.match(elements.status.textContent, /Couldn't save the file/);
  });
});

describe("Main button setting", () => {
  test("keeps visible area as the main button by default", async () => {
    const { elements } = await loadPopup();
    assert.equal(elements.visible.className, "btn primary");
    assert.equal(elements.full.className, "btn");
    assert.equal(elements.visible.movedBefore, undefined);
    assert.equal(elements.full.focused, false);
  });

  test("moves full page first, highlights and focuses it", async () => {
    const { elements } = await loadPopup({ defaultMode: "full" });
    assert.equal(elements.visible.movedBefore, elements.full, "full page should be placed before visible area");
    assert.equal(elements.full.className, "btn primary");
    assert.equal(elements.visible.className, "btn");
    assert.equal(elements.full.focused, true);
  });
});

describe("Settings link", () => {
  test("opens the settings page", async () => {
    const { elements, calls } = await loadPopup();
    let prevented = false;
    await elements.settings.dispatch("click", { preventDefault() { prevented = true; } });
    assert.equal(calls.openOptionsPage, 1);
    assert.ok(prevented, "should not also follow the link");
  });
});

describe("Auto-close", () => {
  const closeTimers = (calls) => calls.timers.filter((t) => t.ms !== 60000);

  test("stays open when the setting is off", async () => {
    const { elements, calls } = await loadPopup();
    await elements.visible.dispatch("click");
    assert.equal(closeTimers(calls).length, 0);
    assert.equal(calls.close, 0);
  });

  test("closes after the chosen delay once copied", async () => {
    const { elements, calls } = await loadPopup({ autoClose: true, autoCloseDelay: 3 });
    await elements.visible.dispatch("click");

    const [timer] = closeTimers(calls);
    assert.equal(timer.ms, 3000);
    timer.fn();
    assert.equal(calls.close, 1);
  });

  test("waits for the download to finish before counting down", async () => {
    const { elements, calls, finishDownload } = await loadPopup({
      autoClose: true, saveFile: true, downloadState: "in_progress"
    });
    const clicked = elements.full.dispatch("click");
    await flush();
    await flush();
    assert.equal(closeTimers(calls).length, 0, "should not start while the file is still saving");

    finishDownload("complete");
    await clicked;
    assert.equal(closeTimers(calls)[0].ms, 2000);
  });

  test("stays open with an error if the download is interrupted", async () => {
    const { elements, calls } = await loadPopup({ autoClose: true, saveFile: true, downloadState: "interrupted" });
    await elements.visible.dispatch("click");

    assert.equal(closeTimers(calls).length, 0);
    assert.equal(elements.status.className, "error");
    assert.match(elements.status.textContent, /Couldn't save the file/);
  });

  test("stays open when there is a long-page warning", async () => {
    const { elements, calls } = await loadPopup({ autoClose: true, pages: [{ width: 1280, height: 9000 }] });
    await elements.full.dispatch("click");
    assert.equal(elements.status.className, "warn");
    assert.equal(closeTimers(calls).length, 0);
  });

  test("stays open on an error", async () => {
    const { elements, calls } = await loadPopup({ autoClose: true, failClipboard: new Error("Document is not focused.") });
    await elements.visible.dispatch("click");
    assert.equal(closeTimers(calls).length, 0);
  });

  for (const type of ["pointerdown", "keydown"]) {
    test(`is cancelled by a ${type} in the popup`, async () => {
      const { elements, calls, document } = await loadPopup({ autoClose: true });
      await elements.visible.dispatch("click");
      await document.dispatch(type);
      assert.equal(closeTimers(calls)[0].cleared, true);
    });
  }
});
