# Scatta

[![Tests](https://github.com/huckbit/scatta/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/huckbit/scatta/actions/workflows/test.yml)
[![Coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fscatta.sooko.uk%2Fcoverage%2Fcoverage.json)](https://scatta.sooko.uk/coverage/)
[![Version](https://img.shields.io/github/manifest-json/v/huckbit/scatta)](manifest.json)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![License: MIT](https://img.shields.io/github/license/huckbit/scatta)](LICENSE)

A Chrome extension that takes a screenshot of the current tab, either the visible area or the full page, and copies it to your clipboard or saves it as a PNG.

<img src="docs/popup.png" alt="Scatta popup" width="301">

**[Download and install guide: scatta.sooko.uk](https://scatta.sooko.uk/)**

## Install

Scatta isn't on the Chrome Web Store, so you load it yourself:

1. Go to the [latest release](https://github.com/huckbit/scatta/releases/latest), download the `scatta-v….zip` file under **Assets** and unzip it.
2. In Chrome, go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped `scatta` folder (the one with `manifest.json` in it).
5. Click the puzzle icon in the toolbar and pin **Scatta** so it's easy to reach.

Keep the folder somewhere permanent (not Downloads): Chrome loads the extension from it every time it starts.

<!-- Screenshot: chrome://extensions with Developer mode and Load unpacked highlighted -->

### Updating

Download the zip from the [latest release](https://github.com/huckbit/scatta/releases/latest), replace the old `scatta` folder with the new one, then go to `chrome://extensions` and click the reload icon on the Scatta card.

If you're working from a clone of this repo, pull or edit the code and click the same reload icon.

**Coming from Tab Selfie?** Scatta is the same extension with a new name (*scatta* is Italian for "snap"). Chrome sees the new folder as a different extension, so click **Remove** on the Tab Selfie card in `chrome://extensions`, then install Scatta as above. Your settings start fresh.

## Use

1. Open the page you want to capture.
2. Click the Scatta icon, or press **Alt+Shift+S** (**Option+Shift+S** on a Mac).
3. Choose one:
   - **Copy visible area** (default, so you can just press Enter): what you can see on screen right now.
   - **Copy full page**: the whole page, top to bottom.
4. Paste it wherever you need it (Cmd+V / Ctrl+V).

### Save as a file instead

Switch on **Save as file** to save a PNG instead of copying it. Files are saved to `Downloads/scatta/` and named after the site and the time, for example `example.com_2026-10-19_14-05-32.png`. Chrome remembers this setting.

### Make full page the main button

If you mostly capture whole pages, open the settings (⚙ in the popup) and set **Main button** to **Full page**. It then comes first and is highlighted, so **Alt+Shift+S** then **Enter** takes a full page screenshot.

### Close the popup automatically

Click the ⚙ icon in the popup (or right-click the Scatta icon and choose **Options**) and switch on **Close after the screenshot**. The popup then closes 1 to 5 seconds after a successful capture (you pick the delay). When saving a file, it waits until the download has finished. It stays open if there's a warning or an error, or if you click or press a key in it. This is off by default.

### Change the shortcut

Go to `chrome://extensions/shortcuts` and set a different key for Scatta.

## Good to know

- **Yellow "debugging" bar:** a full page capture briefly shows a bar saying Scatta started debugging the browser. This is normal: Chrome needs that access to render the whole page in one go. The bar goes away once the screenshot is taken.
- **DevTools open:** full page capture won't work while DevTools is open on that tab. Close it and try again.
- **Pages you can't capture:** Chrome blocks screenshots of `chrome://` pages, other extension pages and the Chrome Web Store.
- **Very long pages:** big images get shrunk when pasted into chats, so small text can be hard to read. For detail, use the visible area.

## Permissions

| Permission | Why |
| --- | --- |
| `activeTab` | Capture the tab you're on, only when you click the icon |
| `debugger` | Render the full page for a full page screenshot |
| `clipboardWrite` | Copy the image to your clipboard |
| `downloads` | Save the PNG when **Save as file** is on |
| `storage` | Remember your **Save as file** choice and your settings |

Nothing is sent anywhere: screenshots stay on your computer.

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for running the tests and how CI works.

## License

[MIT](LICENSE)
