# CI browser root-cause fixes report

## Scope and root causes

This change resolves the two defects identified by GitHub CI run `35699516825`, job `106653941353`, without altering the E2E expectations or suppressing console diagnostics.

- Reselecting the current wizard step left `draft.step` unchanged. The heading focus effect depended only on `draft.step` and `review`, so the clicked stepper button retained focus. This affected the desktop, mobile, and retry flows.
- GitHub Pages responds to deep navigation routes with the generated `404.html` app shell. `NetworkFirst` treated that fulfilled `404 Response` as success, preventing `PrecacheFallbackPlugin` from returning the revision-matched precached shell.

## Test-first evidence

1. The new AssessmentWizard component regression initially failed with the expected focus mismatch: the current step button had focus rather than the `感染／休克` heading. It passes after `selectStep` increments a focus request consumed by the existing heading-focus effect. Normal step transitions and review focus still use that same effect.
2. The real bundled Workbox cache harness was extended to simulate an online GitHub Pages deep route returning a `404` app-shell response. It initially failed with `404 !== 200`. It now verifies a successful response whose body is the current revisioned precached shell. The existing two-build stale-shell regression remains intact.

## Implementation

- `AssessmentWizard` preserves the existing focus behavior for step changes and review state, while a stepper selection explicitly requests a heading focus even when the selected step is already current.
- A typed `fetchDidSucceed` Workbox plugin throws for a non-OK navigation response. Workbox therefore enters strategy error handling, and the existing `PrecacheFallbackPlugin` returns `/SA-AKI/index.html` from the revisioned precache. `NetworkFirst` caching and revision-scoped stale-shell protection are unchanged.

## Fresh verification

- Focused wizard regression: 12/12 Vitest tests passed after the observed RED failure.
- Focused bundled-service-worker harness: 2/2 Node tests passed after the observed RED failure.
- `npm run typecheck`, `npm run test:typecheck`, and `npm run lint`: passed.
- `npm test -- --run`: passed, 25 files / 925 tests.
- `npm run build`: passed; 116 precache entries generated.
- `npm run test:delivery`: passed, 10/10.
- `npm run test:e2e -- --list`: passed, 16 tests collected.
- Targeted desktop/mobile service-worker update run was attempted but could not launch because the Playwright Chromium headless-shell executable is absent at `/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`.

## Commit

Implementation commit: `6c41fe4049eebbe071d537c9b2806b6122509f6e` (`fix: restore wizard focus and Pages fallback`).
