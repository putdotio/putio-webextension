# Agent Guide

## Repo

- Browser extension for sending supported links to put.io
- Main files live in `src/`
- Chrome and Firefox manifests live in `src/manifest.chrome.json` and `src/manifest.firefox.json`

## Start Here

- [Overview](./README.md)
- [Contributing](./CONTRIBUTING.md) — setup, build output, browser load steps, and validation
- [Security](./SECURITY.md)

## Commands

The `scripts` block in [package.json](./package.json) defines `pnpm run check`,
`pnpm run format`, and `pnpm run build` (emits loadable `dist/chrome/` and
`dist/firefox/` plus store zips). CI runs the same check and build on pull
requests and on the `main` branch.

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
- Run `pnpm run build`, then load the built extension in the affected browser when behavior changes; the load steps are in [Contributing](./CONTRIBUTING.md#local-testing)
