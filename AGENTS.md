# Agent Guide

Keep this repo simple and browser-aware.

## Start Here

- [Overview](./README.md)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)

## Repo Shape

- Source lives under [`src/`](./src)
- Chrome and Firefox manifests are maintained separately
- There is no repo-local build pipeline or dedicated verify script yet

## Working Rules

- Keep [Overview](./README.md) consumer-facing
- Keep contributor workflow and manual validation in [Contributing](./CONTRIBUTING.md)
- Prefer the smallest possible manifest and permission changes

## Verification

Use the lightweight checks that exist:

```bash
npx prettier --check "src/**/*.{js,json}" "*.md"
```

Then smoke test the changed flow in a real browser.
