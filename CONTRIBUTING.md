# Contributing

## Setup

```bash
pnpm install
```

## Local Testing

```bash
pnpm run build
```

The build needs the `zip` binary on `PATH`.

- Chrome: `chrome://extensions` → enable Developer mode → Load unpacked →
  select `dist/chrome/`
- Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
  select `dist/firefox/manifest.json`

## Validation

```bash
pnpm run check
pnpm run build
```

Repo invariants live in the [Agent guide](./AGENTS.md#rules).

## Pull Requests

- When behavior changes, exercise the right-click flow in the affected
  browser and name it in the PR.
- Tests mock OAuth. When sign-in or recovery changes, also run the real flow
  in an isolated test profile; [the tests](./tests/background.test.mjs) state
  the expected behavior.
