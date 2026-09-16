# Contributing

This repository contains the standalone browser extension for put.io.

## Setup

Install dependencies from the repository root:

```bash
pnpm install
```

## Local Testing

Build the per-browser directories first:

```bash
pnpm run build
```

This emits `dist/chrome/` and `dist/firefox/` (each with a `manifest.json`) plus a store
zip per browser under `dist/`. Zipping requires the external `zip` binary on PATH
(preinstalled on macOS and the Ubuntu CI runners).

- Chrome: `chrome://extensions` → enable Developer mode → Load unpacked → select `dist/chrome/`
- Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `dist/firefox/manifest.json`

`package.json` `version` is the single version source; the build stamps it into each
emitted `manifest.json`. Do not add a `version` field to `src/manifest.*.json`.

## Validation

Before opening a pull request:

```bash
pnpm run check
pnpm run build
```

`check` runs the background-flow tests in `tests/`, which mock the browser and HTTP
boundaries; `pnpm test` runs only those.

If the change affects runtime behavior, load the built extension from `dist/` and manually
exercise the right-click flow in the affected browser.
CI runs the same check and build on pull requests and `main`.

## Development Notes

- Keep end-user install and usage copy in [Overview](./README.md)
- Keep repo rules in [Agent guide](./AGENTS.md)
- Use `pnpm run format` to apply the Vite+ formatter before committing
- Keep security reporting in [Security](./SECURITY.md)

## Pull Requests

- Keep changes focused
- Update both browser manifests when extension metadata should stay aligned
- Include the browser flow you manually checked when behavior changes

## Authentication recovery checks

Use an isolated test browser profile. Select a link while signed out and confirm that
completing sign-in sends that link once. Then check:

- cancelling sign-in, or a rejected credential, clears the saved link and starts nothing
- a second click during sign-in leaves the first link saved and shows the pending notification
- a validation outage after OAuth keeps the saved link and its provisional token; clicking
  the notification retries validation without reopening sign-in
- signed-in downloads can overlap; only a link waiting on sign-in is saved, and it expires
  after 15 minutes
- a transfer interrupted mid-request is never resent: its notification opens the transfers
  page and clears the saved link
