# Agent Guide

Browser extension that sends links and pages to put.io from the context menu.
Code lives in `src/`; `scripts/build.mjs` is the only packaging step.

## Start Here

- [Overview](./README.md): install and use
- [Contributing](./CONTRIBUTING.md): setup, build output, browser load steps, and validation
- [Security](https://github.com/putdotio/.github/blob/main/SECURITY.md)

## Commands

The `scripts` block in [package.json](./package.json) defines `check`,
`format`, and `build`. CI runs `check` and `build` on pull requests and `main`;
[Links](./.github/workflows/links.yml) checks relative Markdown links and
anchors there too.

## Rules

- `package.json` `version` is the single version source. `scripts/build.mjs`
  stamps it into the emitted manifests; the tracked `src/manifest.*.json`
  files carry no version.
- Keep `src/manifest.chrome.json` and `src/manifest.firefox.json` aligned when
  metadata or permissions change.
- Chrome uses MV3 (`background.service_worker`, `action`); Firefox stays on
  MV2 (`background.scripts`, `browser_action`). `src/background.js` must work
  in both: register listeners at top level and keep state in
  `browser.storage`, not globals.
- Prefer simple background-script changes over adding build tooling.
- Keep `README.md` user-facing and contributor workflow in `CONTRIBUTING.md`.
- Update docs when install paths, store links, or local testing steps change.

## Validation

- `pnpm run check` for any change; docs-only changes need nothing else.
- When behavior changes, also run `pnpm run build` and load the built
  extension in the affected browser
  ([load steps](./CONTRIBUTING.md#local-testing)).

## Delivery

Pull requests squash-merge to `main`, and a merge runs CI only; nothing in
this repository publishes. Users get a change when someone bumps the
`package.json` version and uploads the `dist/*.zip` packages to the Chrome Web
Store and Firefox Add-ons. Those store submissions are manual, go through
store review, and burn the version number.
