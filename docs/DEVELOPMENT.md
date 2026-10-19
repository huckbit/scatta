# Development

## Tests

Tests use Node's built-in test runner, so there's nothing to install apart from Node 20 or newer (`brew install node` on a Mac).

```sh
npm test
```

- [`test/popup.test.js`](../test/popup.test.js) runs `popup.js` against fake Chrome APIs and a fake popup, and checks both capture modes, the Save as file toggle and the error messages.
- [`test/extension.test.js`](../test/extension.test.js) checks that `manifest.json`, `popup.html` and `popup.js` fit together (files exist, permissions match the code, Copy visible area is the default).

## CI

GitHub Actions runs the tests on every pull request into `main` ([.github/workflows/test.yml](../.github/workflows/test.yml)).

To make passing tests required before merging, add a branch protection rule on GitHub: Settings → Branches → add a rule for `main` → turn on **Require status checks to pass** and pick **test**. The check only appears in that list after the workflow has run once.
