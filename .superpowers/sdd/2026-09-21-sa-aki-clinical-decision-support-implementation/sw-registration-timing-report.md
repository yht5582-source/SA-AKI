# Service-worker registration timing report

## CI #4 evidence

CI run `35702747637` reported a Chromium cross-world service-worker/modulepreload resource-mismatch warning during first installation and byte-changed service-worker activation. The two desktop offline cases consequently failed console-health checks before a successful fidelity-artifact upload.

The pinned Workbox implementation documents `immediate: true` registration as occurring before window load and as not recommended. Before this change, application startup called `registerSW({ immediate: true })`.

## Working hypothesis and mitigation

Pre-window-load registration is a plausible timing mechanism for the observed modulepreload/service-worker warning; it is not a proven root cause. `src/main.tsx` now delegates to `registerServiceWorker()`, which calls `registerSW({ immediate: false })`. This requests the documented window-load timing while preserving the Vite PWA `autoUpdate` configuration and existing update/reload behavior.

No console-health exception, warning filter, or modulepreload/build optimization removal was introduced. Only a subsequent browser CI run can confirm whether this mitigation eliminates the Chromium warning.

## TDD evidence

The focused `src/serviceWorkerRegistration.test.ts` was added before the wrapper and initially failed because the wrapper module did not exist. It now verifies that the application registrar receives exactly `{ immediate: false }`.

## Local verification

| Check | Result |
|---|---|
| Focused Vitest regression | 1 passed |
| TypeScript application check | passed |
| TypeScript test check | passed |
| ESLint | passed |
| Full Vitest suite | 26 files, 926 tests passed |
| Production build | passed |
| Delivery tests | 10 passed |
| Playwright discovery | 16 tests listed |

The pinned Playwright Chromium browser is not installed locally (`ms-playwright/.links` is absent), so browser E2E was not run in this environment. CI must rerun the 16 browser cases and upload the required fidelity captures. The visual-release gate remains blocked because CI #4 failed before a successful capture-artifact upload.

## Implementation reference

The runtime change is commit `a4960a7d9ad19a91c970c81c14614158e6fb6263` (`fix: defer service worker registration`). This report supersedes the earlier repository-root report and records the evidence/hypothesis distinction required before browser confirmation.
