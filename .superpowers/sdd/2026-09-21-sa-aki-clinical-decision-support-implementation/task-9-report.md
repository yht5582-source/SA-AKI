# Task 9 — CRRT liberation and prognosis

Status: implemented and verified on `feature/sa-aki-app`. Implementation commit: `bae45996a3bc5e5052ffaca83af6523859056e28` (`feat: add CRRT liberation and prognosis rules`). This report's provenance-only follow-up records that completed commit.

## Scope and interfaces

- `evaluateLiberation(snapshot, trend): DecisionResult[]`: pure supervised review, no stop/restart/device command.
- `classifyAkiTrajectory(snapshots)`: descriptive `improving | persistent | relapsing | worsening | insufficient-data`.
- `evaluatePrognosis(caseData, snapshots): DecisionResult[]`: separated organ directions, factors, confounders, MAKE-style follow-up framing and uncertainty; no risk calculation.
- Added the approved optional `liberationAssessment` object to snapshot types and strict schema v1. Explicit clinician statements about original resolution, native solute/fluid sufficiency, observation, downtime, diuretics and the monitoring plan are not inferred from laboratory values. Optional short timed clearance is contextual only.

## TDD evidence

1. Wrote the two test suites before implementation. Initial run failed to resolve the two absent engine modules.
2. Added empty interface stubs and reran the same command: **65 failed / 18 passed**, 83 cases. Failures included expected missing decisions, wrong trajectory classifications and schema-v1 assessment rejection.
3. Implemented engines/schema/provenance: **83 / 83 passed**.
4. Self-review added regression tests for malformed runtime values, overlapping urine windows, urgent timing copy, uncertain/recent RRT confounding and off-treatment observations. Before fixes: **9 failed / 84 passed**, 93 cases.
5. Implemented fixes; focused run: **93 / 93 passed**.

```sh
npm test -- tests/clinical/liberation.test.ts tests/clinical/prognosis.test.ts --run
npm test -- --run
npm run typecheck
./node_modules/.bin/tsc --ignoreConfig --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --jsx react-jsx --esModuleInterop --types vitest/globals,node,@testing-library/jest-dom tests/clinical/*.test.ts tests/data/*.test.ts
npm run lint
npm run build -- --logLevel warn
git diff --check
```

Final full suite: **774 tests, 14 files, all passed**. Production and explicit test TypeScript checks passed. Lint, build and whitespace check passed. Nonblocking environment/tool warnings: npm unknown `http-proxy` configuration; existing PWA `inlineDynamicImports` deprecation. Vitest prints a jsdom performance suggestion. No omitted test failures.

## Liberation decision table

| Inputs | Review-only result | Timing |
|---|---|---|
| Original indication resolved; explicit native solute/fluid sufficiency; stable concordant perfusion/pressor/respiratory observations; controlled metabolism; positive nonfalling timed urine; nonrising BUN/SCr/balance; reviewed downtime; all observation/monitoring gates | consider supervised trial-off | Individually recorded review interval, >0 and <=4 h |
| Persistent confirmed definitive indication while receiving CRRT | continue and reassess; critical immediate specialist review | Immediately |
| Resolved indication but worsening shock, congestion, oxygenation, solutes, cumulative balance or falling/anuric urine | continue and reassess | <=15 min local review ceiling |
| Missing or conflicting inputs, unknown diuretic context, unreviewed downtime, insufficient/overlapping urine duration, duplicate/foreign/future/invalid/stale timepoints | continue and reassess; explicit missing data | <=15 min local review ceiling |
| Improving urine with diuretic exposure | No positive trial-off consideration until explicit diuretic interpretation plus all other gates | As above |
| Single urine/SCr/short timed CrCl, even apparently favorable | Cannot independently establish readiness | As above |
| Already documented off CRRT, no confirmed recurrence | continue and reassess the supervised trial-off, not an order to resume CRRT | Planned close observation if all gates met; otherwise <=15 min |

The app-local continuous observation convention requires two distinct same-case observations 6–24 h apart and at least 6 h timed urine at each, with no overlap of the latest collection into the previous snapshot. Unordered input is copied and sorted; the exact current snapshot may appear once in a full supplied series. Zero urine is observed anuria, never missing data. These conventions are deliberately conservative review gates, not validated readiness or clinical exclusion criteria.

## Restart-trigger table

| During a valid recorded off-CRRT interval | Result |
|---|---|
| Recurrent concordant refractory hyperkalemia/acidemia; refractory edema/hypoxemia; named uremic complication; explicit life-threatening electrolyte, toxicology or specialist sodium-control indication | restart trigger met; immediate clinician review, no automatic restart |
| Abnormal K/pH or congestion without confirmation | continue and reassess; urgent bedside confirmation, no automatic restart |
| Declining urine, rising solutes/balance or higher input needs alone | Earlier multidisciplinary review; not an independent restart indication |
| Invalid/missing CRRT start/stop timeline | Cannot assert an established trial-off/restart state; missing-data review |

Reuses `evaluateKrtInitiation` for confirmed current indications and urgency. All outputs carry continuous perfusion/respiratory observation, timed urine/fluid tracking, serial chemistry/blood-gas/solute review and recurrence triggers. Action text uses the same immediate/short timing as structured `reassessWithinHours` to avoid contradictory routine delays.

## Trajectory table

| Observation | Classification / framing |
|---|---|
| Concordant lower SCr and higher timed urine rate, or one unchanged with the other improving | improving |
| Concordant higher SCr and lower timed urine rate, or one unchanged with the other worsening | worsening |
| Earlier improvement then latest concordant deterioration | relapsing, explicitly descriptive only |
| Latest pair unchanged | persistent, explicitly not duration-defined persistent AKI |
| Fewer than two points, missing timed urine/SCr, contradictions, duplicate time/ID, foreign case, invalid timestamp | insufficient-data / renal indeterminate |
| Known/unknown diuretic influence, active or untimed recorded CRRT, CRRT overlapping urine collection or delivered between SCr observations | insufficient-data; treatment clearance cannot establish native recovery |
| Valid serial observations after a complete off-CRRT interval | Descriptive direction allowed with stated residual confounding |
| Pressor, MAP and lactate all compatible | Separate hemodynamic direction; contradictory measures remain indeterminate |
| P/F and support intensity compatible | Separate respiratory direction; contradictory measures remain indeterminate |
| Cumulative balance or SOFA changes | Separate fluid / organ direction; never a combined risk score |

MAKE30/90 explains death, new KRT/dialysis dependence and persistent kidney dysfunction; definitions, baseline, index date and follow-up must be agreed. No events or individual probabilities are calculated. Follow-up includes reassessment around three months after AKI.

## Evidence and assumptions

All returned source IDs resolve through the existing claim-scoped evidence resolver. No draft or unverified source enables a rule.

| Evidence ID | Verified scope |
|---|---|
| `KDIGO_2012` | Final guideline, §§5.2.1–5.2.2 and rationale: intrinsic function relative to patient needs, context of timed urine/CrCl, diuretic limitations; §§2.2–2.3 and 2.3.4: susceptibilities/exposures, serial observations and three-month reassessment. Does not validate app thresholds or prognosis labels. |
| `APP_LIBERATION_V1` | Declared local conservative gates, time windows, physiology veto screens, monitoring/restart-review safeguards. Not independently validated. |
| `APP_TRAJECTORY_V1` | Declared descriptive direction classification, same-case/time integrity, separate domains and treatment-confounder handling. Not a prognosis model. |
| `MAKE_DEFINITIONS_2024` | Primary systematic scoping analysis, published 2024-05-27, DOI 10.1007/s00134-024-07480-x. MAKE component/observation-window heterogeneity; no individual prediction. |

Primary verification URLs, checked 2026-09-21:

- https://kdigo.org/wp-content/uploads/2019/01/KDIGO-2012-AKI-Guideline-English.pdf — Chapter 5.2 pp93–94 (PDF pp95–96), §§2.2–2.3.
- https://link.springer.com/article/10.1007/s00134-024-07480-x — abstract, introduction and results on components and 30-/90-day follow-up heterogeneity.

Important assumptions: elapsed time since shock onset is not established continuous shock duration; cumulative balance is not proof of intravascular overload; SOFA alone cannot identify all failing organs; no recorded RRT is not proof of no extracorporeal clearance. The existing schema has no dedicated confirmed nephrotoxin-review field, so this remains explicitly unknown and a required clinical review, never inferred from a medication name. These limitations are exposed rather than converted into scores.

## Files and self-review

- Created `src/clinical/liberation.ts`, `src/clinical/prognosis.ts`.
- Created `tests/clinical/liberation.test.ts`, `tests/clinical/prognosis.test.ts`.
- Extended `src/clinical/types.ts`, `src/data/schema.ts`, `src/clinical/sources.ts`.
- Created this report.

Self-review checked pure/no-I/O behavior, input immutability, evidence claim scope, exact-current versus duplicate observations, missing versus zero urine, duration normalization, malformed values, treatment timeline, CRRT/diuretic confounding, clinician-versus-measured separation, recurrence urgency and advisory-only language. Regression tests caught and fixed initially inadequate recent-CRRT handling and a contradictory routine monitoring interval in urgent action text.

Remaining concerns: the local safety gates need ICU/nephrology clinical governance before bedside deployment; they are intentionally conservative and are not validated discontinuation criteria. No universal CrCl/UO readiness threshold or deterministic prognosis is offered. UI integration and additional curated scenarios remain subsequent tasks. No implementation blocker remains.

## Review fix round 1 — strict direct-call validation and longitudinal treatment state

Addressed both Important findings. No subagents used.

### RED before production changes

Added 34 regression/control cases in `tests/clinical/liberation.test.ts`. Ran `npm test -- tests/clinical/liberation.test.ts --run`: **32 failed / 69 passed (101 total)**. This reproduced false-positive trial-off consideration with truthy string assessments and malformed context, a downstream exception for malformed uremic-manifestation arrays, and loss of historical stop records. Passing new controls confirmed legitimate false observations and a genuinely later documented restart remain meaningful.

### Minimal fixes

- Reuse the existing pure strict `clinicalSnapshotSchema` at the direct-call boundary for the current snapshot and every supplied historical snapshot. No coercion, clinical defaulting or persistence I/O. Invalid booleans, enums, finite/domain values and nested objects return explicit `missingData` field paths, `continue and reassess`, and **immediate** bedside invalid-data review; malformed arrays never reach the KRT evaluator. This does not infer that urgent indications are absent.
- Require literal `true` for every affirmative mandatory clinical assessment; valid `false` remains an observed negative assessment, not missing data.
- Reconcile episode start/stop timestamps across the complete supplied history, not only the nearest observation. A historical stop cannot be erased by current/intervening omission. Current absent/older start, current-versus-latest-stop conflicts, future events, duplicate/conflicting snapshot timestamps and equal-time stop/start transitions produce explicit `treatment-state uncertainty`. This first-round comparison did not detect every conflicting stop within one historical episode; round 2 below corrects that remaining gap before latest-event reduction.
- Only a documented start strictly after the historical stop can establish a new active episode. All existing physiological, native-sufficiency and monitoring gates still apply. A documented current off-treatment episode remains distinct from uncertain treatment state.
- Updated `APP_LIBERATION_V1` provenance notes to state these local runtime and chronology safeguards transparently. No new clinical threshold, schema field or treatment order was introduced.

### Regression coverage

| Finding | Direct-call regressions |
|---|---|
| Truthy mandatory assessment bypass | String `false` for each mandatory assessment and all simultaneously; explicit invalid field paths |
| Invalid required context | Current and prior `diureticExposure='unknown'`, invalid vasopressor/lung/hemodynamic/respiratory enums, NaN/negative/high/fractional/string VExUS, malformed edema/ECMO/indication booleans, numeric-string potassium, invalid numeric domains, and malformed nested/array fields |
| Historical stop omitted | Schema-valid prior stop with current stop omitted, with and without current start; older stop retained through a nearer omission |
| Valid restarted episode | Strictly later current start passes only with all other gates met, for both historical array orders |
| Ambiguous chronology | Equal stop/start event timestamps, conflicting equal snapshot timestamps, historical events later than their documenting snapshot |

### GREEN and verification

- Focused liberation + prognosis: **127 / 127 passed**.
- Full suite: **808 / 808 passed**, 14 files.
- Production `npm run typecheck`: passed.
- Explicit test TypeScript command documented above: passed.
- `npm run lint`: passed.
- `npm run build -- --logLevel warn`: passed.
- `git diff --check`: passed.
- Same nonblocking npm proxy/PWA deprecation warnings and Vitest jsdom suggestion as the initial implementation; no omitted failing tests.

Self-review: schema reuse is pure and avoids duplicated boolean/enum/domain logic; malformed input routes to immediate review before unsafe property access; treatment reconciliation is order-independent and never fills missing stop/start values with assumed normal treatment state. Existing positive consideration, confirmed recurrence and observed trial-off tests remain green. Remaining limitation: records not supplied to the pure engine cannot be reconciled, so callers must provide available longitudinal history. Clinical-governance concerns above are unchanged. Fix commit is the commit containing this section (`fix: fail closed on malformed liberation data and CRRT history`).

## Review fix round 2 — episode consistency before latest-event reduction

The second Important finding remained partly open after round 1: taking maximum starts/stops could hide two different recorded stop times for the same start. The previous broad conflict-handling claim is narrowed above to match what round 1 actually verified.

Strict TDD: added four regression/control tests before implementation. `npm test -- tests/clinical/liberation.test.ts --run` produced **2 failed / 103 passed (105 total)**. Reproduced the exact history: start 2026-09-20 00:00 with stop 23:00 in the 00:00 snapshot, same start with conflicting stop 2026-09-21 05:00 in the 06:00 snapshot, then new start 07:00 at the 12:00 current snapshot. The previous engine incorrectly considered trial-off. Also reproduced a current stop matching the latest conflicting stop plus confirmed refractory hyperkalemia, which previously mislabeled a definite restart state.

Minimal fix: while validating every supplied record, build an episode map keyed by parsed start instant. Every episode may have at most one defined stop instant. A second distinct stop for that start returns explicit `treatment-state uncertainty: conflicting stop times for the same CRRT episode` **before** reducing to latest events. Undefined stops do not erase defined stops; identical defined repeats are accepted; distinct episode starts remain separate. Both historical array orders are tested.

With conflicting chronology, the conclusion is `continue and reassess`, never definite trial-off or restart state. Existing KRT indication assessment is preserved independently: confirmed refractory hyperkalemia retains its measured/confirmed evidence, critical severity, immediate clinician-review actions and zero-hour reassessment. Chronology uncertainty does not delay urgent clinical review.

Controls verify identical episode start/stop repetitions at different observation times do not create conflicts, and different stop times attached to distinct valid episodes remain eligible for consideration when every other gate is met. Updated `APP_LIBERATION_V1` notes describe episode consistency and preservation of urgent review.

Fresh verification: **131 focused tests passed; 812 full-suite tests passed across 14 files**. Explicit test TypeScript check, production typecheck, lint, build and `git diff --check` passed. The same nonblocking npm proxy/PWA deprecation warnings and Vitest jsdom suggestion remain; no test failures omitted. No subagents used. Remaining concern is unchanged: a pure engine can reconcile only the supplied records, which must include available history; local clinical-governance review remains necessary. Fix commit is the commit containing this section (`fix: reject conflicting stop times within CRRT episodes`).
