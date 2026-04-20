# Contributing

This repository contains the source for the put.io browser extension.

## Setup

Install the repository dependencies before running formatting checks:

```bash
npm install
```

## Working in the repo

- extension source lives under [`src/`](./src)
- browser-specific manifests live in [`src/manifest.chrome.json`](./src/manifest.chrome.json) and [`src/manifest.firefox.json`](./src/manifest.firefox.json)
- keep behavior changes aligned across both target browsers unless the difference is intentional

## Validation

There is no dedicated repo-local verify script yet.

Before opening a pull request:

- run `npx prettier --check "src/**/*.{js,json}" "*.md"`
- make sure both manifest files remain valid JSON
- smoke test the affected right-click flow in at least one target browser

If the change is browser-specific, call that out clearly in the pull request.

## Pull Requests

Helpful pull requests usually include:

- screenshots or a short recording when the browser UI changes
- the browser and version used for the smoke test
- notes about any manifest permission or store-submission impact
