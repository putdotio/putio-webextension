# Agent Guide

Browser extension that sends links and pages to put.io from the context menu.
Code lives in `src/`; [scripts/build.mjs](./scripts/build.mjs) packages it.
Setup and browser load steps live in [CONTRIBUTING](./CONTRIBUTING.md).

## Commands

```bash
pnpm install
pnpm run check
pnpm run format
pnpm run build
```

## Rules

- Keep `src/manifest.chrome.json` and `src/manifest.firefox.json` aligned when
  metadata or permissions change.
- `src/background.js` runs as a Chrome MV3 service worker and a Firefox MV2
  background script: register listeners at top level and keep state in
  `browser.storage`.
- Prefer simple background-script changes over adding build tooling.

## Validation

- Any change: `pnpm run check`. Docs-only changes need nothing else.
- Behavior changes: also `pnpm run build`, then load the built extension in
  the affected browser ([load steps](./CONTRIBUTING.md#local-testing)).

## Delivery

- Nothing in CI publishes. Store releases are manual: bump `version` in
  [package.json](./package.json), run `pnpm run build`, and upload the
  `dist/*.zip` files to the Chrome Web Store and Firefox Add-ons.
- Each store upload burns its version; never reuse one.
