# Contributing

## Setup

```bash
pnpm install
```

## Local Testing

```bash
pnpm run build
```

This emits loadable `dist/chrome/` and `dist/firefox/` directories plus a
store zip per browser under `dist/`. Zipping needs the `zip` binary on `PATH`
(preinstalled on macOS and the Ubuntu CI runners).

- Chrome: `chrome://extensions` → enable Developer mode → Load unpacked →
  select `dist/chrome/`
- Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
  select `dist/firefox/manifest.json`

## Validation

```bash
pnpm run check
pnpm run build
```

CI runs both on pull requests and `main`. `check` includes the background-flow
tests in `tests/`, which mock the browser and HTTP boundaries; `pnpm test` runs
only those. `pnpm run format` applies the formatter. When runtime behavior
changes, load the built extension and exercise the right-click flow in the
affected browser.

Repo invariants (version stamping, manifest alignment, MV3/MV2 split) live in
the [Agent guide](./AGENTS.md#rules).

## Pull Requests

- Update both browser manifests when extension metadata changes.
- Name the browser flow you checked manually when behavior changes.

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
