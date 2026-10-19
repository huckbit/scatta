# Development

## Tests

Tests use Node's built-in test runner, so there's nothing to install apart from Node 22 or newer (`brew install node` on a Mac).

```sh
npm test
```

- [`test/popup.test.js`](../test/popup.test.js) runs `popup.js` against fake Chrome APIs and a fake popup, and checks both capture modes, the Save as file toggle and the error messages.
- [`test/measure.test.js`](../test/measure.test.js) runs the script that measures a page for **Copy full page** against fake pages, including apps that scroll inside their own panel.
- [`test/extension.test.js`](../test/extension.test.js) checks that `manifest.json`, `popup.html` and `popup.js` fit together (files exist, icons are the right size, permissions match the code, Copy visible area is the default).

## Coverage

```sh
npm run coverage
node scripts/coverage-report.js
open coverage/html/index.html
```

The first command runs the tests and writes `coverage/lcov.info`. The second turns it into a one-page report: each line of `popup.js` is marked as run, partly run (a branch never ran) or never run.

The measuring script is sent to the page as text, so coverage can't see inside it. `test/measure.test.js` covers it instead.

## CI

GitHub Actions runs the tests on every pull request into `main` ([.github/workflows/test.yml](../.github/workflows/test.yml)).

After each push to `main` it also publishes the coverage report to [huckbit.github.io/tab-selfie](https://huckbit.github.io/tab-selfie/), which the Coverage badge in the README reads. This needs GitHub Pages turned on once: Settings → Pages → **Source: GitHub Actions**.

To make passing tests required before merging, add a branch protection rule on GitHub: Settings → Branches → add a rule for `main` → turn on **Require status checks to pass** and pick **test**. The check only appears in that list after the workflow has run once.
