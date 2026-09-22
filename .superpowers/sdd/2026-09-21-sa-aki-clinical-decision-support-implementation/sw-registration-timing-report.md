# Service-worker registration timing report

## CI #4 evidence

CI run `35702747637` reported a Chromium cross-world service-worker/modulepreload resource-mismatch warning during first installation and byte-changed service-worker activation. The two desktop offline cases consequently failed console-health checks before a successful fidelity-artifact upload.

The pinned Workbox implementation documents `immediate: true` registration as occurring before window load and as not recommended. Before this change, application startup called `registerSW({ immediate: true })`.

## CI #5 confirmation — run 35704571691

GitHub CI run `35704571691` passed full verification and all 16 Playwright cases, including the offline navigation and service-worker update scenarios. The earlier cross-world service-worker/modulepreload warning did not recur, and the run completed the fidelity artifact upload. This browser result supports the `immediate: false` mitigation for this CI environment and run; it does not prove that the timing issue is eliminated universally across browsers, versions, or deployment conditions.

## Working hypothesis and mitigation

Pre-window-load registration is a plausible timing mechanism for the observed modulepreload/service-worker warning; it is not a proven root cause. `src/main.tsx` now delegates to `registerServiceWorker()`, which calls `registerSW({ immediate: false })`. This requests the documented window-load timing while preserving the Vite PWA `autoUpdate` configuration and existing update/reload behavior.

No console-health exception, warning filter, or modulepreload/build optimization removal was introduced. At the time of CI #4, only a subsequent browser CI run could confirm whether this mitigation eliminated the Chromium warning; CI #5 later confirmed that the warning did not recur in that run, with the scope limits recorded above.

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

The pinned Playwright Chromium browser remains unavailable locally (`ms-playwright/.links` is absent), so browser E2E was not run in this environment. This was the pre-CI #5 local state: CI subsequently reran all 16 browser cases, uploaded the required fidelity captures, and passed the visual-release gate for the reviewed commit. Local browser unavailability remains a reproducibility limitation, not an unresolved CI #5 gate.

## Implementation reference

The runtime change is commit `a4960a7d9ad19a91c970c81c14614158e6fb6263` (`fix: defer service worker registration`). This report supersedes the earlier repository-root report and records the evidence/hypothesis distinction required before browser confirmation.
