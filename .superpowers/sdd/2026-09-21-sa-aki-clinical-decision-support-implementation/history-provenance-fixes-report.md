# History and provenance safety fixes

## Scope

This batch addresses two final-review findings only: longitudinal acute-CRRT provenance in AKI staging and the HA wizard's duplicate-prior selection bypass.

## Clinical ruling

An explicitly documented acute CRRT start establishes KDIGO stage 3 for the current acute episode. Later immutable observations that omit CRRT fields do not establish cessation. An explicit stop at or before the observation may state that treatment is no longer active, but it does not erase the documented acute-RRT stage-3 fact for that episode. This is not a maintenance-dialysis inference and does not create a KRT indication; the existing action remains explicit that staging is not a new-KRT prescription.

The reconciler considers only observations documented no later than each observation and events no later than that observation. Exact repeated event timestamps are corroboration, not multiple episodes. Overlapping starts, or a stop without an open documented start, are provenance uncertainty: the result remains conservatively stage 3 when an acute start is documented, is marked provisional/low confidence, and visibly requests manual source-record reconciliation. It does not silently select a competing history or downgrade the acute episode.

## Changes

- `evaluateDiagnosis()` now reconciles CRRT start/stop history for every staged observation.
- Added diagnosis regressions for carried-forward active CRRT, explicit stop, duplicate corroboration, and conflicting episode records; future planned starts remain excluded.
- `AssessmentWizard` now uses shared `strictlyEarlierSnapshot()` rather than choosing the first duplicate at the latest prior instant.
- Added a rendered wizard regression proving conflicting duplicate latest priors keep HA incomplete and disable `完成 HA 多專科審查`; the existing rendered unique-prior flow continues to assert the enabled path.

## RED → GREEN evidence

Initial focused RED run: 4 expected failures — three diagnosis regressions (omitted ongoing CRRT, explicit stop, conflict provenance) and one rendered duplicate-prior HA wizard regression. A second focused RED run caught duplicate copies of the same CRRT start incorrectly treated as conflicting episodes. After reconciliation and shared selection, focused tests passed: 2 files, 94 tests.

## Validation

- `npm test -- --run tests/clinical/diagnosis.test.ts tests/components/assessment-wizard.test.tsx` — 94 passed.
- `npm run typecheck` — passed.
- `npm run test:typecheck` — passed.
- `npm run lint` — passed.

- `npm test -- --run` — 26 files, 931 tests passed.
- `npm run build` — passed; service worker precache contains 116 entries.
- `npm run test:delivery` — 10/10 passed.
- `npm run test:e2e -- --list` — 16 browser tests collected. Browser execution was not attempted because the local pinned Chromium headless shell remains unavailable, as documented in the preceding CI diagnostics.

## Independent-review correction

The first reconciliation incorrectly used any historical acute-RRT start as current `renalReplacementTherapy`, so a stopped episode could keep the current card critical stage 3. The corrected ruling separates two facts:

- **Current KDIGO stage** uses active, provenance-valid current acute RRT only, together with the current SCr and urine axes.
- **Historical acute-episode maximum** remains visible in staging evidence as documented stage 3; it is not a current-stage override, maintenance-dialysis inference, or KRT indication.

A start/stop event is eligible only when it is no later than its documenting snapshot. A planned future event remains unperformed even after time passes unless a later snapshot explicitly repeats and thereby confirms it. A same-snapshot start/stop pair provides the available explicit episode linkage. Separate start/stop records, multiple unlinked starts, and conflicting stops for one start leave the episode boundary uncertain; the current result is low-confidence/provisional and, when no independently current AKI criterion exists, explicitly insufficient rather than recovered or current stage 3.

Second RED run: 4 expected diagnosis failures covering linked stop/current-stage separation with historical maximum, unlinked boundary uncertainty, a future planned start that time alone must not execute, and conflicting stops that a later start cannot wash away. After the correction, `tests/clinical/diagnosis.test.ts` passed 82/82. Fresh full validation: both typechecks and lint passed; full Vitest passed 26 files / 935 tests; production build passed with 116 precache entries.

## Independent-review boundary correction

Confirmed CRRT pairs now require a strictly positive interval (`stop > start`) and must be strictly separated (`next start > previous stop`). Overlap, an equal boundary, or a zero-duration pair is provenance uncertainty rather than evidence of either recovery or a new active run. An unlinked start that falls within a completed interval, or is at/before the latest confirmed stop, is also uncertain and cannot promote current RRT staging. Valid sequential pairs remain accepted.

Third RED run: 4 expected failures for overlapping pairs, an unlinked start inside a completed interval, an unlinked start at its equal stop boundary, and a zero-duration pair; the strictly separated sequential-pair control already passed. GREEN: 87 diagnosis tests. Fresh full validation: both typechecks, lint, full Vitest 26 files / 940 tests, and production build (116 precache entries) passed.

## Dashboard current-selection correction

Historical diagnosis ordering remains deterministic for reconciliation, but it cannot replace an explicitly selected dashboard observation at the same timestamp. `evaluateDiagnosis()` now accepts the selected snapshot ID solely for its current observation; the chronological/ID order remains available for prior-history processing. The dashboard passes its resolved selection through this boundary. Same-time duplicates still produce the existing provenance warning and are never used as an arbitrary strictly-earlier comparator.

Fourth RED run: a direct dashboard integration regression and rendered selector regression both showed `a-severe` input with `z-normal` diagnosis/SOFA cards. GREEN: clinical selection, dashboard adapter, and rendered selection tests passed 118/118. Fresh full validation: both typechecks, lint, full Vitest 26 files / 948 tests, and production build passed.
