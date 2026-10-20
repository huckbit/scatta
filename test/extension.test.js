// Checks that the extension files fit together, so Chrome can load it.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT } = require("./helpers");

const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const manifest = JSON.parse(read("manifest.json"));
const html = read("popup.html");
const js = read("popup.js");
const optionsHtml = read("options.html");
const optionsJs = read("options.js");

describe("manifest.json", () => {
  test("is Manifest V3 with a name and description", () => {
    assert.equal(manifest.manifest_version, 3);
    assert.ok(manifest.name);
    assert.ok(manifest.description);
    // The Web Store rejects descriptions over 132 characters.
    assert.ok(manifest.description.length <= 132);
  });

  test("has a version Chrome accepts", () => {
    assert.match(manifest.version, /^\d+(\.\d+){0,3}$/);
  });

  test("points at files that exist", () => {
    const files = [
      manifest.action.default_popup,
      manifest.options_ui.page,
      ...Object.values(manifest.icons),
      ...Object.values(manifest.action.default_icon)
    ];
    for (const file of files) {
      assert.ok(fs.existsSync(path.join(ROOT, file)), `missing ${file}`);
    }
  });

  test("has PNG icons that match their declared sizes", () => {
    const icons = { ...manifest.icons, ...manifest.action.default_icon };
    for (const [size, file] of Object.entries(icons)) {
      const bytes = fs.readFileSync(path.join(ROOT, file));
      assert.equal(bytes.toString("hex", 0, 8), "89504e470d0a1a0a", `${file} is not a PNG`);
      const width = bytes.readUInt32BE(16);
      const height = bytes.readUInt32BE(20);
      assert.deepEqual([width, height], [Number(size), Number(size)], `${file} should be ${size}×${size}`);
    }
  });

  test("asks for every permission the code uses, and no others", () => {
    const used = {
      debugger: /chrome\.debugger\./,
      downloads: /chrome\.downloads\./,
      storage: /chrome\.storage\./,
      clipboardWrite: /navigator\.clipboard\.write/,
      activeTab: /chrome\.tabs\.captureVisibleTab/
    };
    assert.deepEqual([...manifest.permissions].sort(), Object.keys(used).sort());
    for (const [permission, pattern] of Object.entries(used)) {
      assert.match(js, pattern, `${permission} is requested but not used`);
    }
  });

  test("has a keyboard shortcut to open the popup", () => {
    assert.ok(manifest.commands._execute_action.suggested_key.default);
  });

  test("links to the GitHub repo", () => {
    assert.equal(manifest.homepage_url, "https://github.com/huckbit/tab-selfie");
  });
});

describe("popup.html", () => {
  test("has every element popup.js looks up", () => {
    const ids = [...js.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
    assert.ok(ids.length > 0);
    for (const id of ids) {
      assert.match(html, new RegExp(`id="${id}"`), `popup.html is missing #${id}`);
    }
  });

  test("loads popup.js", () => {
    assert.match(html, /<script src="popup\.js"><\/script>/);
  });

  test("has Copy visible area as the default action", () => {
    const buttons = [...html.matchAll(/<button ([^>]*)>/g)].map((m) => m[1]);
    assert.match(buttons[0], /id="visible"/, "visible area should be the first button");
    assert.match(buttons[0], /\bautofocus\b/);
    assert.match(buttons[0], /\bprimary\b/);
    assert.equal(buttons.filter((b) => /\bautofocus\b/.test(b)).length, 1);
  });

  test("has no inline scripts (blocked by the extension security policy)", () => {
    assert.doesNotMatch(html, /<script>(?!\s*<\/script>)/);
    assert.doesNotMatch(html, /\son[a-z]+="/i);
  });
});

describe("options.html", () => {
  test("has every element options.js looks up", () => {
    const ids = [...optionsJs.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
    assert.ok(ids.length > 0);
    for (const id of ids) {
      assert.match(optionsHtml, new RegExp(`id="${id}"`), `options.html is missing #${id}`);
    }
  });

  test("loads options.js", () => {
    assert.match(optionsHtml, /<script src="options\.js"><\/script>/);
  });

  test("has no inline scripts (blocked by the extension security policy)", () => {
    assert.doesNotMatch(optionsHtml, /<script>(?!\s*<\/script>)/);
    assert.doesNotMatch(optionsHtml, /\son[a-z]+="/i);
  });

  test("links to GitHub issues in a new tab", () => {
    // The page is embedded in chrome://extensions, so a plain link would navigate the dialog.
    assert.match(optionsHtml, /<a href="https:\/\/github\.com\/huckbit\/tab-selfie\/issues" target="_blank" rel="noopener">/);
  });
});

describe("site/index.html", () => {
  const siteHtml = read("site/index.html");

  test("download button falls back to the latest release page", () => {
    assert.match(siteHtml, /id="download" href="https:\/\/github\.com\/huckbit\/tab-selfie\/releases\/latest"/);
  });

  test("shows the same shortcut as the manifest", () => {
    const keys = manifest.commands._execute_action.suggested_key.default.split("+");
    const shown = keys.map((key) => `<kbd>${key}</kbd>`).join(" + ");
    assert.ok(siteHtml.includes(shown), `site should show ${shown}`);
  });

  test("lists every permission the manifest asks for", () => {
    for (const permission of manifest.permissions) {
      assert.match(siteHtml, new RegExp(`<code>${permission}</code>`), `site is missing ${permission}`);
    }
  });
});
