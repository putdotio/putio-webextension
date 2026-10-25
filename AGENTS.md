# Agent Guide

Browser extension that sends links and pages to put.io from the context menu.
Code lives in `src/`; `scripts/build.mjs` is the only packaging step.
Setup and browser load steps live in [CONTRIBUTING](./CONTRIBUTING.md).

## Commands

```bash
pnpm install
pnpm run check   # format, lint, and tests/
pnpm run format  # auto-fix format and lint issues
pnpm run build   # dist/<browser>/ and store zips
```

## Rules

- `package.json` `version` is the single version source. The build stamps it
  into the emitted manifests; never add `version` to `src/manifest.*.json`.
- Keep `src/manifest.chrome.json` and `src/manifest.firefox.json` aligned when
  metadata or permissions change.
- Chrome uses MV3 (`background.service_worker`, `action`); Firefox stays on
  MV2 (`background.scripts`, `browser_action`). `src/background.js` must work
  in both: register listeners at top level and keep state in
  `browser.storage`, not globals.
- Prefer simple background-script changes over adding build tooling.

## Validation

- Any change: `pnpm run check`. Docs-only changes need nothing else.
- Behavior changes: also `pnpm run build`, then load the built extension in
  the affected browser ([load steps](./CONTRIBUTING.md#local-testing)).

## Delivery

Pull requests squash-merge to `main`; nothing in this repository publishes.
Users get a change only after someone bumps the `package.json` version and
uploads the `dist/*.zip` packages to the Chrome Web Store and Firefox Add-ons.
Store submissions are manual, go through store review, and burn the version
number.
