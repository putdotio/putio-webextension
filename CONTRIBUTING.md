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
store zip per browser under `dist/`. Zipping needs the `zip` binary on `PATH`.

- Chrome: `chrome://extensions` → enable Developer mode → Load unpacked →
  select `dist/chrome/`
- Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
  select `dist/firefox/manifest.json`

## Validation

```bash
pnpm run check
pnpm run build
```

`check` runs format and lint checks plus the background-flow tests in
`tests/`, which mock the browser and HTTP boundaries. `pnpm test` runs only
the tests; `pnpm run format` auto-fixes format and lint issues. Repo
invariants live in the [Agent guide](./AGENTS.md#rules).

## Pull Requests

- Update both browser manifests when extension metadata changes.
- When behavior changes, exercise the right-click flow in the affected
  browser and name it in the PR.

## Authentication Recovery Checks

The tests mock OAuth; these checks cover the real browser. Use an isolated
test profile. Select a link while signed out and confirm that completing
sign-in sends that link once. Then check:

- Cancelling sign-in, or a rejected credential, clears the saved link and
  starts nothing.
- A second click during sign-in keeps the first link saved and shows the
  pending notification.
- A validation outage after OAuth keeps the saved link and its provisional
  token; clicking the notification retries validation without reopening
  sign-in.
- Signed-in downloads can overlap. Only a link waiting on sign-in is saved,
  and it expires after 15 minutes.
- A transfer interrupted mid-request is never resent: its notification opens
  the transfers page and clears the saved link.
