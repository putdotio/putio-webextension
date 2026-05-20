# Contributing

This repository contains the standalone browser extension for put.io.

## Setup

Install dependencies from the repository root:

```bash
pnpm install
```

## Local Testing

This repo does not build artifacts. Load the unpacked extension directly from `src/`.

- Chrome: load `src/manifest.chrome.json` through the unpacked-extension flow
- Firefox: load `src/manifest.firefox.json` through temporary add-on loading

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
