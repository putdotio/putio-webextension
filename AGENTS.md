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

## Repo-Specific Guidance

- Keep `README.md` user-facing and move contributor workflow to `CONTRIBUTING.md`
- Keep Chrome and Firefox manifests aligned when extension metadata or permissions change
- Prefer simple background-script changes over adding build tooling to this repo
- Update docs when install paths, store links, or local testing steps change

## Validation

- Run `pnpm run check` when changing docs, manifests, locale messages, or the background script
- Manually load the unpacked extension from `src/` in the affected browser when behavior changes
- CI runs the same check on pull requests and `main`
