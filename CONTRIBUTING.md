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

`check` includes deterministic background-flow tests using mocked browser and HTTP boundaries.
Use `pnpm test` for the focused suite.

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

With an isolated test browser profile, select a link while signed out and confirm that
successful sign-in sends that link once. Try cancellation, a second click during sign-in,
and an expired credential. Temporary validation failures must not open repeated sign-in
windows or discard an existing credential.

The background script retains at most one selected link while recovering. Additional clicks
leave it unchanged. Success, cancellation, and terminal failure clear it; abandoned records
expire before the next selected action after 15 minutes. A worker interrupted during a transfer POST
cannot know whether the transfer started, so its notification opens the transfers page for
checking and clears the saved action. It never automatically sends that uncertain request again.
