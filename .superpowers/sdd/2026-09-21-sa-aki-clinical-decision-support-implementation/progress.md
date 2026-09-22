# SDD ledger — plan: docs/superpowers/plans/2026-09-21-sa-aki-clinical-decision-support-implementation.md

## Setup

- Worktree: `/workspace/scratch/64a2d1135413/repo-inspect/.worktrees/sa-aki-app`
- Branch: `feature/sa-aki-app`
- Starting commit: `82daa86`
- Spec: `docs/superpowers/specs/2026-09-21-sa-aki-clinical-decision-support-design.md`
- Baseline: documentation-only repository; no package manifest or runnable test suite exists before Task 1.

## Preflight consistency scan

| Tasks / interface | Producer → consumer or shared file | Finding |
|---|---|---|
| 1 | Scaffold files, commands, router, PWA, design tokens | Internally consistent; visual concept approval is a hard gate before UI code. |
| 2 | Clinical contracts, evidence registry, units | Internally consistent; `unverified` source status protects rules from unverifiable citations. |
| 3 | Zod/Dexie schemas and repository | Internally consistent; depends on Task 2 types and Task 1 fake IndexedDB setup. |
| 4 | Diagnosis engine | Internally consistent; consumes Task 2 case/snapshot contracts. |
| 5 | Fluid engine | Internally consistent; consumes Task 2 snapshots and produces `DecisionResult`. |
| 6 | KRT/modality/ECMO engines | Internally consistent; consumes Tasks 2 and 4 outputs. |
| 7 | CRRT prescription engine | Internally consistent; consumes Task 2 weight/unit helpers and Task 6 modality output. |
| 8 | HA engine | Internally consistent; consumes Task 2 evidence/contracts and Task 6 CRRT-indication status. |
| 9 | Liberation/prognosis engines | Internally consistent; consumes longitudinal snapshots and CRRT data from Tasks 2/7. |
| 10 | Case management/wizard | Internally consistent; consumes Tasks 1–3 and writes shared `src/app/routes.tsx`. |
| 11 | Dashboard/HA/trends/handoff | Internally consistent; consumes Tasks 4–9 and writes shared `src/app/routes.tsx`. |
| 12 | Governance/evidence/offline pages | Internally consistent; consumes Task 2 evidence registry and writes shared `src/app/routes.tsx`. |
| 13 | E2E/CI/Pages | Internally consistent; consumes all UI routes and package commands; deploy workflow verifies before deploy. |
| 14 | Push/production/release | Internally consistent; depends on Task 13 green gates and is an external side-effect checkpoint. |
| 1 → 2–13 | `package.json`, test config, app shell | Commands and dependencies required downstream are named in Task 1. |
| 1 → 10–12 | `src/app/routes.tsx` | Task 1 creates it; Tasks 10–12 explicitly modify it. |
| 2 → 3–11 | `ClinicalSnapshot`, `DecisionResult`, evidence IDs, units | Shared contract is defined before all clinical and UI consumers. |
| 3 → 10–13 | IndexedDB repository and import/export | Persistence precedes case UI and end-to-end testing. |
| 4–9 → 11 | Pure decision engines | Dashboard consumes results; React components do not duplicate thresholds. |
| 6 → 8 | KRT indication and modality | HA must fail closed; oXiris cannot create a CRRT indication. |
| 7 → 9/11 | CRRT prescription and delivered-dose data | Liberation, trajectory, and trends can consume the same longitudinal fields. |
| 10–12 → 13 | Routes and user flows | E2E scenarios are defined after screens exist. |
| 13 → 14 | Verified deploy workflow | Production push/release remains outside the implementation worktree until explicit external-action approval. |

Ruling: Treat the user’s selection of Subagent-driven execution as consent to create the required isolated worktree — this adds only a local feature branch and worktree; if wrong, the cost is removable local git metadata.

Ruling: Split Task 1 at its mandatory visual approval gate: concept generation may proceed, but no UI implementation begins until the user explicitly approves a concept — this delays coding by one review turn but preserves the frontend skill’s design-spec requirement.

Task 1: design phase complete; desktop and mobile concepts generated and inspected at native size; user explicitly approved both concepts on 2026-09-21. They are now the binding visual specification for scaffold/UI implementation.

Task 1 Ruling: allow a scoped checkpoint commit without a rendered-browser screenshot because Browser blocks localhost, Playwright CDN download times out, and the available Chromium binary cannot spawn under current permissions — typecheck, lint, unit tests, and production build must still be green; Task 13 retains the mandatory rendered desktop/mobile fidelity gate before final handoff — if wrong, visual drift could persist until Task 13 and require later CSS rework.

Task 1 Ruling: the binding clinical-safety requirement to visibly exclude pediatric/pregnancy use and state that the app does not replace clinical judgment overrides the approved concept's shorter safety copy; add the minimum wording inside existing safety regions without changing hierarchy — if wrong, the accepted concept gains two unapproved strings, but omitting them creates a higher-risk scope ambiguity.

Task 1: fix round 1/5 (2 addressed, 0 open; commits 0a823c8..12e18e0).

Task 1: deferred verification — browser CSS reflow, contrast, offline runtime, and concept fidelity remain mandatory in Task 13 because the current environment could not execute a permitted browser.

Task 1: complete (commits 82daa86..12e18e0, review clean after fix round 1).

Task 2 Ruling: add `observational` to `SourceStatus` because primary-source verification identifies PHIND as an observational cohort rather than a trial — this departs from the plan's closed union but prevents false evidence-design labeling; if wrong, one extra enum value would need removal and the PHIND record remapping.

Task 2: minor (deferred): compile-time contract assertions require a separate TypeScript command and are not yet part of routine `npm test`/`npm run typecheck`; integrate a repeatable test-typecheck command in Task 13 verification.

Task 2: complete (commits 12e18e0..3c8726b, review clean with 1 deferred minor).

Task 3: complete (commits 3c8726b..7469c03, review clean).

Task 4: minor (deferred): add a combined unordered timeline regression containing an earlier nonqualifying and later qualifying snapshot during final hardening.

Task 4: minor (deferred): existing npm configuration and PWA build-deprecation warnings should be triaged in Task 13.

Task 4: fix round 1/5 (2 addressed, 0 open; commits f052e82..e5a39b8).

Task 4: complete (commits 7469c03..e5a39b8, review clean after fix round 1).

Task 5: minor (deferred): add direct regressions for exactly 6 hours, just beyond 6 hours, and schema-invalid prior snapshots during final hardening.

Task 5: fix round 1/5 (1 addressed, 0 open; commits 1a5bab1..e48f0eb).

Task 5: complete (commits e5a39b8..e48f0eb, review clean after fix round 1).

Task 6 Ruling: extend `ClinicalSnapshot` and schema version 1 with backward-compatible optional fields for refractory KRT indications, dialyzable toxins, controlled sodium correction, modality priorities, and ECMO configuration/safety because the existing contract cannot distinguish urgent confirmation from automatic KRT — if wrong, the schema gains unused optional fields but remains backward compatible.

Task 6: minor (deferred): strengthen ECMO air/pressure/zero-flow fixtures so intended safety checks are isolated from missing anticoagulation.

Task 6: minor (deferred): include unknown CRRT anticoagulation in ECMO overlap-assessment `missingData` when ECMO anticoagulation is known.

Task 6: fix round 1/5 (1 addressed, 0 open; commits 87fa64d..1778d2b).

Task 6: complete (commits e48f0eb..1778d2b, review clean after fix round 1).

Task 7: fix round 1/5 (1 addressed, 0 open; commits 38c70ec..da614a6).

Task 7: complete (commits 1778d2b..da614a6, review clean after fix round 1).

Task 8 Ruling: add one optional backward-compatible `hemoadsorptionAssessment` object and a verified EUPHRATES post-hoc source scoped only to exploratory PMX enrichment (EAA 0.60–0.89/MODS>9 multidisciplinary review), never efficacy, indication, mortality benefit, or routine use — if wrong, the PMX gate may be overly narrow and require governance revision, but it cannot silently promote HA use.

Task 8: minor (deferred): npm/jsdom/bundler warnings remain for Task 13 toolchain cleanup.

Task 8: fix round 1/5 (2 addressed, 0 open; commits 1447b0e..1743790).

Task 8: complete (commits da614a6..1743790, review clean after fix round 1).

Task 9 Ruling: add a minimal optional backward-compatible `liberationAssessment` object so clinician-confirmed indication resolution, native sufficiency, confounder interpretation, monitoring and restart plans are distinct from inferred trends — if wrong, schema v1 gains unused optional fields but avoids unsafe inference from single values.

Task 9: fix round 1/5 (1 addressed, 1 open; commits 201b30e..fef9ff6).

Task 9: fix round 2/5 (1 addressed, 0 open; commits fef9ff6..e25d7a0).

Task 9: complete (commits 1743790..e25d7a0, review clean after fix round 2).

Task 10: minor (deferred): fresh HA assessment with gates passed but review not yet confirmed is labeled `不符合審查資格`; distinguish pending confirmation from failed gates during Task 11 HA workspace integration.

Task 10: fix round 1/5 (3 addressed, 0 open; commits 195245f..b973cc1).

Task 10: complete (commits e25d7a0..b973cc1, review clean with 1 deferred minor).

Task 11: fix round 1/5 (2 addressed, 0 open; commits 41f40a3..214c1e4).

Task 11: complete (commits b973cc1..214c1e4, review clean after fix round 1).

Task 12: minor (deferred): governance completeness test should pin the release evidence IDs/cardinality and skip-link test should assert target focusability/activation; carry to Task 13/final review.

Task 12: fix round 1/5 (privacy distinction improved but 1 cleanup-truthfulness finding remained; commits 3f23227..9017bed).

Task 12: fix round 2/5 (1 addressed, 0 open; commits 9017bed..7288e80).

Task 12: complete (commits 214c1e4..7288e80, review clean after fix round 2).

Task 13: independent review fix round 1/5 (commit 2c9d5ee) — successful fidelity captures must be an inspectable pre-main artifact. Non-production CI now runs on every branch push/PR, retains all three native-size screenshots after the complete green browser gate, and fails when they are absent. Task 14 must push the feature branch, inspect the commit-specific artifact, and only then integrate/push main for gated Pages deployment.

Task 13: complete (commits 7288e80..2c9d5ee, independent re-review clean after fix round 1; local browser execution remains an explicit Task 14 release gate).

Whole-branch review integration fix round 1: implemented the three verified Important findings: longitudinal HA exposure reconciliation, persisted/reachable CRRT prescription/RCA inputs, and accessible manual clinical/HA-exposure branches. Focused RED→GREEN tests cover omitted ongoing exposure, explicit stop and conflicts, schema-v1 optional prescription inputs, complete/incomplete RCA review, typed VExUS/uremic arrays, pulmonary-edema KRT, ECMO anticoagulation, HA JSON subrecords, and immutable round trips. Historical adverse-event/drug/TDM logs remain factual history, not current approvals. Pending independent re-review.

Whole-branch SW finding: a real bundled application SW/Workbox two-manifest regression proved that the fixed navigation cache returned old HTML after activation removed its hashed JS. Shell-revision navigation caches and scoped retired-navigation cleanup pass the regression; this does not close the real-browser/fidelity release gate. No external push, merge or deployment performed.

Whole-branch integration fix checkpoint: commit `f9ac051adc042a6e49e98f81f1fc87464f4e6996`, clean worktree. Fresh typecheck/test:typecheck/lint, 24 files / 917 Vitest tests, production build, 9/9 delivery checks, 16 Playwright cases collected, and diff whitespace checks all pass. Full details: `final-integration-fixes-report.md`. Independent re-review pending; real browser/fidelity remains the same Task 14 gate.

Whole-branch integration re-review fix round 2: addressed one Important (conflicting versions of a timestamped HA subrecord counted as multiple events) and one Minor (history uncertainty discarded reconciled drug/TDM/cartridge monitoring). Derived records now contain one shared identity with disputed optional details unknown; original snapshot variants and visible conflict provenance remain. Repeated revisions cannot restore disputed severity/dose/concentration. Dashboard history uncertainty and factual drug monitoring coexist even when current exposure/opt-in documentation is absent; no treatment authorization or dose change is inferred. Focused RED 6 failures / 16 passes → GREEN 22/22. Fresh full gates PASS: typecheck, test:typecheck, lint, 24 files / 923 Vitest tests, build, delivery 9/9, Playwright 16 collected (not executed), diff check. Report updated; independent re-review acceptance and the existing Task 14 real-browser/fidelity release gate remain. No push or deployment.

Whole-branch integration re-review fix checkpoint: commit `49e121d9d566bb932046dd2428e61db0d7820987` (`fix: preserve HA event identity and historical monitoring`), tracked worktree clean. Final scope and gate details recorded in `final-integration-fixes-report.md`.

CI E2E diagnostics: investigated GitHub run `35697996224`. Eight failures were caused by a semantically invalid zero-`textbox` assertion in anonymous-case setup: three required `datetime-local` controls legitimately match Playwright's broad role, while the retained prohibited-label assertion directly verifies that name/record-number/DOB/phone/address fields are absent. Removed only the invalid role assertion. The remaining desktop/mobile service-worker-update failures exposed a generic 404 whose exact resource is still unknown because console health saved only `message.text()`; added a RED→GREEN-tested formatter that now includes console type, `message.location().url`, line, and column without suppressing or whitelisting any error or changing production behavior. Implementation commit `80e375917f19db6e1216bfc3d2c8edd4a5b82c70`; focused formatter, typechecks, lint, 924 Vitest tests, build, and 9/9 delivery tests passed; 16 Playwright tests collected, but a targeted browser execution was blocked before launch by the missing Chromium headless-shell executable. Details: `ci-e2e-diagnostics-report.md`.

CI browser root-cause fixes: GitHub CI run `35699516825`, job `106653941353` showed two independent causes. Reselecting the current `感染／休克` step left `draft.step` unchanged, so the heading effect did not rerun after the stepper button received focus; `selectStep` now sends a focus request while retaining the existing step/review effect. The Pages deep-link `404.html` shell was a fulfilled non-OK `NetworkFirst` response, so `PrecacheFallbackPlugin` could not run; a `fetchDidSucceed` Workbox plugin now treats non-OK navigation responses as strategy failures, returning the revisioned precached shell instead. RED→GREEN evidence: component focus test failed with the button focused rather than the heading; real bundled SW harness failed with `404 !== 200`; both pass after the fixes, including unchanged two-build stale-shell protection. Fresh gates: both typechecks, lint, 25 files / 925 Vitest tests, build (116 precache entries), delivery 10/10, and Playwright list (16) all pass. The targeted desktop/mobile browser attempt is still blocked before launch by the missing Chromium headless-shell; no E2E expectations or console handling were weakened. Details: `ci-browser-root-fixes-report.md`. Implementation commit `6c41fe4049eebbe071d537c9b2806b6122509f6e`.

Fidelity capture correction: CI run `35701472321` was functionally green and its 390 × 844 and 430 × 764 mobile wizard captures passed manual inspection. Its desktop capture was invalid for visual release because it navigated an empty newly created case and rendered `尚無時間點；請先新增評估。` rather than the required three-column command center. `e2e/fidelity.spec.ts` now imports validated `DEMO-001`, opens its decision dashboard, and asserts semantic current-input, current-judgment, and 0–72-hour trajectory surfaces before preserving the existing desktop filename. It then returns to the case list, creates a separate anonymous case, and retains both existing mobile capture paths and filenames. Status remains blocked pending a corrected CI capture and reviewer inspection; details: `fidelity-capture-correction-report.md`.

CI #4 service-worker timing follow-up: evidence from GitHub run `35702747637` is 14/16 Playwright cases passing, with both desktop offline failures caused by console-health capture of Chromium's cross-world service-worker/modulepreload warning during first installation and byte-changed activation; the run did not reach successful fidelity-artifact upload. The pinned Workbox source documents `immediate: true` registration as pre-window-load and not recommended, which is a working hypothesis for the warning rather than a proven root cause. The mitigation changes only application registration to `immediate: false`, retaining `autoUpdate`, update/reload logic, modulepreload, and console-health handling. RED→GREEN focused coverage verifies `{ immediate: false }`; local typechecks, lint, 26 files / 926 Vitest tests, build, 10/10 delivery tests, and Playwright discovery of 16 tests passed. Pinned Chromium is unavailable locally, so browser CI is pending to determine whether the mitigation eliminates the warning; the visual-release gate remains blocked. Details: `sw-registration-timing-report.md`.

CI #5 and visual signoff: GitHub run `35704571691` for remote feature commit `a893e51d648d7e81eddec680805e10caff67298b` passed full verification and all 16 Playwright cases, with successful artifact `fidelity-screenshots-a893e51d648d7e81eddec680805e10caff67298b` (ID `10683134797`, digest `sha256:383ce6fcb69036168c6f6b6a6cfa9eaa23be7a7df55e702d4328b3c1192c9b15`). Native desktop (1586 × 992), mobile (390 × 844), and mobile (430 × 764) captures received an independent **APPROVE** verdict: no Critical/Important findings, no visible collisions/overflow, and mobile sticky actions fully visible. Non-blocking minors were desktop whitespace above columns, mixed English/local clinical wording, subtle horizontal tab affordance, and muted helper text. The previous service-worker warning did not recur and offline/update scenarios passed, supporting (but not universally proving) the deferred-registration hypothesis. Visual signoff complements functional tests and is not clinical validation. Task 14 production verification remains unchecked; merge, Pages deployment, and production checks are still pending.
