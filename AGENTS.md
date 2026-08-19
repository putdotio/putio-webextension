# Agent Guide

## Repo

- Browser extension for sending supported links to put.io
- Main files live in `src/`
- Chrome and Firefox manifests live in `src/manifest.chrome.json` and `src/manifest.firefox.json`

## Start Here

- [Overview](./README.md)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)

## Commands

- `pnpm install`
- `pnpm run check`
- `pnpm run format`
- `pnpm run build` — emit loadable `dist/chrome/` and `dist/firefox/` plus store zips

## Repo-Specific Guidance

- Keep `README.md` user-facing and move contributor workflow to `CONTRIBUTING.md`
- Keep Chrome and Firefox manifests aligned when extension metadata or permissions change
- `package.json` `version` is the single version source; `scripts/build.mjs` stamps it
  into the emitted manifests, so the tracked `src/manifest.*.json` files carry no version
- Chrome uses MV3 (`background.service_worker`, `action`); Firefox stays MV2
  (`background.scripts`, `browser_action`). `src/background.js` must keep working in both:
  register listeners at top level and keep state in `browser.storage`, not globals
- Keep packaging limited to `scripts/build.mjs`; prefer simple background-script changes
  over adding heavier build tooling
- Update docs when install paths, store links, or local testing steps change

## Validation

- Run `pnpm run check` when changing docs, manifests, locale messages, or the background script
- Run `pnpm run build`, then load the built extension in the affected browser when behavior changes:
  - Chrome: `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome/`
  - Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `dist/firefox/manifest.json`
- CI runs the same check and build on pull requests and `main`
