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
zip per browser under `dist/`.

- Chrome: `chrome://extensions` → enable Developer mode → Load unpacked → select `dist/chrome/`
- Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `dist/firefox/manifest.json`

`package.json` `version` is the single version source; the build stamps it into each
emitted `manifest.json`. Do not add a `version` field to `src/manifest.*.json`.

## Validation

Before opening a pull request:

```bash
pnpm run check
```

If the change affects runtime behavior, manually exercise the right-click flow in the affected browser.
CI runs the same check on pull requests and `main`.

## Development Notes

- Keep end-user install and usage copy in [Overview](./README.md)
- Keep repo rules in [Agent guide](./AGENTS.md)
- Use `pnpm run format` to apply the Vite+ formatter before committing
- Keep security reporting in [Security](./SECURITY.md)

## Pull Requests

- Keep changes focused
- Update both browser manifests when extension metadata should stay aligned
- Include the browser flow you manually checked when behavior changes
