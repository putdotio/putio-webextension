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

- `npm install`
- `npx prettier --check README.md src/background.js src/manifest.chrome.json src/manifest.firefox.json`

## Repo-Specific Guidance

- Keep `README.md` user-facing and move contributor workflow to `CONTRIBUTING.md`
- Keep Chrome and Firefox manifests aligned when extension metadata or permissions change
- Prefer simple background-script changes over adding build tooling to this repo
- Update docs when install paths, store links, or local testing steps change

## Validation

- Run the Prettier check when changing the README, manifests, or background script
- Manually load the unpacked extension from `src/` in the affected browser when behavior changes
