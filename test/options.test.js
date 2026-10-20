const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { loadOptions } = require("./helpers");

describe("Settings page", () => {
  test("defaults to visible area as the main button", async () => {
    const { elements } = await loadOptions();
    assert.equal(elements["default-mode"].value, "visible");
  });

  test("saves the main button choice", async () => {
    const { elements, calls } = await loadOptions();
    elements["default-mode"].value = "full";
    await elements["default-mode"].dispatch("change");
    assert.deepEqual(calls.storageSet, [{ defaultMode: "full", autoClose: false, autoCloseDelay: 2 }]);
  });

  test("defaults to not closing, with a 2 second delay", async () => {
    const { elements } = await loadOptions();
    assert.equal(elements["auto-close"].checked, false);
    assert.equal(elements["auto-close-delay"].value, "2");
    assert.equal(elements["auto-close-delay"].disabled, true, "delay is greyed out while auto-close is off");
    assert.equal(elements["delay-row"].className, "row disabled");
  });

  test("restores saved settings", async () => {
    const { elements } = await loadOptions({ autoClose: true, autoCloseDelay: 5 });
    assert.equal(elements["auto-close"].checked, true);
    assert.equal(elements["auto-close-delay"].value, "5");
    assert.equal(elements["auto-close-delay"].disabled, false);
  });

  test("saves when auto-close is switched on", async () => {
    const { elements, calls } = await loadOptions();
    elements["auto-close"].checked = true;
    await elements["auto-close"].dispatch("change");

    assert.deepEqual(calls.storageSet, [{ defaultMode: "visible", autoClose: true, autoCloseDelay: 2 }]);
    assert.equal(elements["auto-close-delay"].disabled, false);
    assert.equal(elements.saved.textContent, "Saved.");
  });

  test("saves the delay as a number", async () => {
    const { elements, calls } = await loadOptions({ autoClose: true });
    elements["auto-close-delay"].value = "3";
    await elements["auto-close-delay"].dispatch("change");
    assert.deepEqual(calls.storageSet, [{ defaultMode: "visible", autoClose: true, autoCloseDelay: 3 }]);
  });
});
