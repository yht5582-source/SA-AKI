# SA-AKI Clinical Navigator

SA-AKI Clinical Navigator 是成人醫護人員使用的本機優先漸進式網頁應用程式，用來整理 sepsis-associated acute kidney injury 的匿名病例觀察、資料缺口、證據、決策支援與重評提示。

這是臨床決策支援工具，不是醫療器材、緊急服務、自動醫囑或臨床判斷的替代品。不適用於兒科、孕婦或新生兒；所有內容仍須由合格成人照護團隊依床邊狀況、機構流程及適用法規覆核。

Clinical content version: **0.1.0**. Evidence registry checked through **2026-09-21**.

## GitHub Pages target

Planned deployment URL: <https://yht5582-source.github.io/SA-AKI/>

The app, manifest, service worker, routes, and bundled fonts are scoped to `/SA-AKI/`. Deployment and production verification are separate release steps.

## Development

Requires Node.js 22.12+ (verified with Node.js 24.19.0) and npm. Dependencies are pinned in `package.json` and `package-lock.json`.

```sh
npm ci
npm run dev -- --host 127.0.0.1
npm run typecheck
npm run test:typecheck
npm run lint
npm test -- --run
npm run build
npm run preview -- --host 127.0.0.1
```

For the complete delivery gate, install the browser once and run:

```sh
npx playwright install --with-deps chromium
npm run verify
```

`verify` runs application and test-contract typechecking, lint, all unit/component tests, the production build, build/workflow checks, and Playwright desktop Chromium plus mobile Chrome tests. The mobile viewport is 390 × 844. `npm run test:e2e -- --list` lists the browser checks without claiming they ran. The screenshot capture test records desktop 1586 × 992 and mobile 390 × 844 / 430 × 764 review surfaces; screenshots alone do not establish visual fidelity. See `docs/design/fidelity-ledger.md` for the current signoff status.

Every branch push and pull request runs non-production CI, which installs Chromium on Node 22 and executes the same gate. After a successful run, CI uploads `fidelity-screenshots-<commit SHA>` containing the exact 1586 × 992 desktop and 390 × 844 / 430 × 764 mobile captures for human inspection; missing captures fail the artifact step. Browser traces, reports, videos and failure screenshots are retained for seven days when a job fails.

The pre-release sequence is deliberate: push the feature branch, wait for green CI, download that commit's fidelity artifact, and inspect all three images against `docs/design/concepts/`. Only after this review should the reviewed commit be integrated and pushed to `main`. A main push starts the separate Pages workflow, which reruns the complete gate, uploads only its successfully verified `dist`, and deploys only through a job that depends on verification. Pages must be configured to use GitHub Actions and the `github-pages` environment before release; this code does not change repository settings or deploy on its own.

Cold deep links on GitHub Pages use `dist/404.html`, an exact copy of the built app shell with absolute `/SA-AKI/` asset paths. The URL is preserved (no query rewriting or redirects); the initial response remains HTTP 404 because GitHub Pages is a static host. Offline navigation then uses the service worker's precached app shell. Browser tests use a local static-server fixture that reproduces these 404 semantics instead of relying only on Vite preview's permissive SPA fallback, and a byte-changed built service worker to verify automatic update activation and local-data retention.

Open the printed development URL under `/SA-AKI/`. Production navigation uses NetworkFirst with a precached app-shell fallback; same-origin static assets use CacheFirst. The PWA registers for automatic updates in production, while the development server does not install a service worker.

Navigation caches are scoped to the precached index-shell revision and retired navigation caches are removed on activation. A two-build delivery regression executes the real bundled service worker and Workbox against simulated CacheStorage/event/network I/O: after changed hashed assets are precached, offline revisits and previously unseen routes return the current shell. This is not a substitute for the real-browser update and visual release gates above.

## Current scope

Version 0.1.0 contains:

- anonymous adult case creation, IndexedDB storage for confirmed cases/snapshots, current-tab sessionStorage for unconfirmed assessment drafts, validated JSON import/export, and deletion;
- an eight-step longitudinal assessment workflow;
- explainable AKI/SA-AKI, fluid stewardship, KRT indication/modality/ECMO, CRRT prescription and anticoagulation, HA review, CRRT liberation, and descriptive trajectory decision modules;
- a decision dashboard, 0–72-hour trend views, evidence-linked decision cards, and allowlisted bedside handoff summary;
- evidence, privacy, governance, changelog, and offline-information pages.

Unknown, conflicting, stale, malformed, or unverified inputs fail closed. Local thresholds and time ceilings are conservative operational conventions, not independently validated treatment thresholds. HA is opt-in and not a routine pathway; SSC 2026 conditionally suggests against routine blood purification and polymyxin B hemoperfusion in adult sepsis/septic shock. HA remains a restricted experimental adjunct in research, registry, or approved-protocol contexts.

The app does not control medical devices, issue orders, transmit data to a care system, or provide individualized mortality or renal-recovery predictions.

### Manual review inputs and longitudinal HA documentation

The prescription step accepts an optional, backward-compatible `prescriptionAssessment` in schema version 1: explicit adult confirmation, weight-basis rationale, delivered target, dialysate/pre/post/PBP flows, blood flow, fractional hematocrit, perfusion assessment, citrate risk/protocol availability, bleeding/systemic-anticoagulation review, device, and five independent confirmations. Nothing is pre-approved. Complete inputs can reach the existing arithmetic and conditional RCA review; unknown or unsupported inputs retain the existing safety blocks. Calculated flows remain non-executable discussion aids.

The wizard also accepts respiratory support, P/F, numeric VExUS, signed interval fluid balance, multi-select uremic manifestations (unknown is distinct from explicitly assessed absent), and ECMO anticoagulation. HA remains opt-in. One documented exposure per new observation can be entered with ordinary device/target/start/stop/flow/volume/response controls. Repeatable cartridge times, drug administrations, TDM and adverse events use explicitly labeled strict JSON-array editors with schema help and examples; no numeric coercion or extra keys are accepted. Validated imports can contain multiple exposures, and immutable read-only snapshots retain all arrays/objects and expose the full exposure record. Do not enter direct identifiers in any field or free text.

An HA exposure is reconciled from same-case observations at or before the selected time and remains documented as active until an explicit valid stop. A missing current record is not treated as discontinuation. Missing documentation, duplicates, inconsistent device/target/stop records, re-opened stopped episodes, or conflicting subrecords produce an immediate visible uncertainty review. Factual drug/TDM/adverse-event histories are retained without counting the same timestamped record twice; historical records never substitute for current safety, phenotype or governance confirmations. An empty later event list does not establish that a prior adverse event has resolved. No HA continuation or treatment authorization is generated.

Conflicting revisions of one event, administration or TDM sample count as one logical record. The reconciled record retains only its shared identity, leaving disputed severity, dose and concentration unknown; original variants remain in the immutable source snapshots for review. Repeating a disputed revision does not resolve that conflict. Historical drug/TDM/cartridge monitoring stays visible alongside the uncertainty card, even when current exposure or opt-in documentation is missing; it cannot authorize HA or automatic dose changes.

## Privacy model

Confirmed anonymous cases and snapshots are stored in IndexedDB inside the current browser profile. Unconfirmed assessment draft values are stored separately in the current tab's `sessionStorage`; they have not yet been written to a case or snapshot. There is no application backend, account, analytics, or telemetry. Use anonymous case codes only; direct identifiers are prohibited.

An assessment draft usually survives reloads in the same tab. Closing the tab/browser session, clearing site data, browser cleanup, private browsing, or storage failure can remove it; restoration after browser session recovery depends on browser policy. A successful snapshot save attempts to clear that case's draft in the current tab. Successful case deletion removes that case and its snapshots from IndexedDB and attempts to clear that case's current-tab draft. Successful “clear all local data” removes all cases/snapshots from IndexedDB and attempts to clear all SA-AKI assessment drafts in the current tab. Each `sessionStorage` cleanup is best-effort: browser or storage errors can leave a current-tab draft behind. On shared devices, close the tab/browser session after use and, under institutional policy, verify or clear site data as needed; clearing site data can also remove IndexedDB cases and snapshots. Leaving the assessment, returning to the case list, or cancelling a deletion/clear confirmation does not clear a draft; there is currently no separate discard-draft control. Other open tabs have separate `sessionStorage`, so this tab cannot clear their drafts.

Anyone with access to the device, browser profile, or an open tab/session may be able to read confirmed cases, unconfirmed drafts, and exports. Exported JSON can contain sensitive health information and is the user's responsibility to store, transmit, import, and delete safely. Deleting a case inside the app does not delete downloaded, copied, backed-up, or shared exports. Clearing site data, private browsing, browser eviction, or profile loss can permanently remove local data. The app does not claim application-level encryption; use a managed, encrypted device with appropriate access controls.

## Evidence update process

Evidence is declared in `src/clinical/sources.ts`. For every addition or update:

1. verify the primary publication, guideline, DOI, publication type, date, and version;
2. record the source status, verification date, scope, uncertainty, and exact rule IDs it may support;
3. keep drafts, inaccessible primary publications, and context-only studies non-executable;
4. add or update focused tests for provenance, status, scope, eligibility, and the clinical rule boundary;
5. update the in-app evidence page, `CHANGELOG.md`, clinical content version/date, and obtain clinical/governance review before release.

Never use secondary reports to activate a threshold or treatment-effect claim. A source may execute only for its explicitly listed, verified rule scope. The KDIGO 2026 Public Review Draft and unverified TIGRIS record are visible but non-executable.

## Structure

- `src/app/`: routing and shared application shell.
- `src/clinical/`: typed decision engines, units, and evidence registry.
- `src/data/`: schema validation, IndexedDB database, and repository boundary.
- `src/features/`: case, assessment, dashboard, HA, and governance surfaces.
- `src/components/`: reusable workflow and decision presentation components.
- `src/styles/`: clinical design tokens and responsive layouts.
- `tests/`: clinical, data, component, build-artifact and workflow-graph behavior tests.
- `e2e/`: real browser clinical workflows, mobile, cold deep links, offline and service-worker update checks.
- `public/`: install manifest and compass-based app icons.
- `docs/`: authoritative specifications, implementation plan, and approved visual references.

All UI text and controls are code-native. Traditional Chinese font assets are bundled locally under their package's SIL Open Font License; no remote font or analytics request is required. The repository license is preserved.
