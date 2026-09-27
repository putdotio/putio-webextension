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

CI runs both on pull requests and `main`. `pnpm run format` applies the
formatter. When runtime behavior changes, load the built extension and
exercise the right-click flow in the affected browser.

Repo invariants (version stamping, manifest alignment, MV3/MV2 split) live in
the [Agent guide](./AGENTS.md#rules).

## Pull Requests

- Update both browser manifests when extension metadata changes.
- Name the browser flow you checked manually when behavior changes.
