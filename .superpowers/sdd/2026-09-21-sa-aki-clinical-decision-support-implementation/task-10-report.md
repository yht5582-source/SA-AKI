# Task 10 — anonymous cases and eight-step assessment

Status: implemented and verified with component/integration tests. Browser/visual signoff remains deferred to Task 13. Work performed on `feature/sa-aki-app` in the assigned worktree; no subagents, backend, authentication, analytics, telemetry, or clinical-rule threshold duplication.

Commit: `feat: add anonymous case assessment workflow` (the commit containing this report).

## RED / GREEN evidence

1. Wrote the case-flow and wizard integration suites first, using the real caseRepository and fake IndexedDB. Initial run failed because ApplicationRoutes did not exist. Added a null route interface stub and reran: **8 failed**, with expected missing headings/actions, rather than relying on the missing-export error.
2. Implemented local case workflow, schema validation, wizard steps, session draft retention, review confirmation, and HA engine integration. Focused run: **8 passed** after correcting two test harness issues (responsive duplicate navigation links and user-event literal-JSON typing syntax).
3. Self-review wrote regressions for baseline/provenance entry and adding a fresh timepoint after save. Observed **2 failed / 7 passed**. Added validated baseline creation fields and routed confirmed saves to their immutable saved-snapshot URL; fresh assessment routes now reset correctly.
4. Wrote HA disclosure/safety-input regression. Observed final-review IL-6 disclosure before opt-in; fixed it. Reran and observed missing fibrinogen field; added fibrinogen and MODS inputs with schema-consistent units/ranges. Added an additional positive-gate integration guard to verify the existing engine-backed review boundary and revocation on a safety change.
5. During full-suite verification, `exports versioned JSON and rejects invalid imports without changing the list or data` exposed a test synchronization race: it queried the exported textarea before the async IndexedDB export finished. Replaced the synchronous query with `findByLabelText`; no production behavior was changed to accommodate the test.
6. Fresh final verification: **11 focused tests passed**, **823 full-suite tests passed across 16 files**. No failing tests remain.

## Verification commands and results

```sh
npm test -- tests/components/case-flow.test.tsx tests/components/assessment-wizard.test.tsx --run
npm test -- --run
npm run typecheck
./node_modules/.bin/tsc --ignoreConfig --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --jsx react-jsx --esModuleInterop --types vitest/globals,node,vite/client src/test/setup.ts tests/components/*.test.tsx tests/clinical/*.test.ts tests/data/*.test.ts
npm run lint
npm run build -- --logLevel warn
git diff --check
```

All commands passed. The initial explicit test typecheck caught a nonexistent Testing Library `exact` role-query option; it was removed. Its invocation also needed the real test setup and Vite CSS ambient types, which are included above. Nonblocking output: pre-existing npm proxy-setting warning, Vitest jsdom performance suggestion, PWA `inlineDynamicImports` deprecation, and a new >500 kB application chunk-size warning. No browser screenshots or end-to-end rendering claims were made.

## Interaction matrix

| Interaction | Observed contract |
| --- | --- |
| Create anonymous case | Generated UUID / anonymous code; no identifying text inputs; keyboard Enter submits; optional adult age band and baseline/provenance fields validated by patientCaseSchema |
| Open case | Persisted case opens assessment; navigation works beneath MemoryRouter `/SA-AKI` basename |
| Export | Real repository returns version-1 JSON; user can inspect or download it without network transfer |
| Import | JSON parse + repository identifier/schema/transaction checks; invalid input leaves existing case/list/export data intact; valid payload appears in list |
| Delete one | Inline nonmodal alertdialog explicitly names case; cancel preserves it; confirmation removes case and snapshots through repository transaction and clears that case's draft |
| Clear all | Separate explicit confirmation; cancel preserves records; confirmation removes stored cases/snapshots and assessment drafts |
| Step navigation | Exact eight-step order, previous/next and direct step controls; current step and values retained across remount/reload in the same tab |
| Numeric / boolean unknown | Blank remains absent; zero remains zero; unknown / yes / no are separate select values; visible unit/range help and associated validation errors |
| Final review | Lists entered/unknown values and critical missing fields; schema-required fields prevent save; optional clinical unknowns remain unknown and explicitly provisional |
| Save | No snapshot before confirmation; clinicalSnapshotSchema and caseExportSchema must pass; repository revalidates; saved snapshot URL is immutable/read-only |
| Add next timepoint | After save, fresh route starts a blank draft and retains previously saved snapshot in history |
| HA opt-in | HA assessment fields and HA-specific review data hidden until explicit checkbox opt-in |
| HA missing/failing gates | Engine status used directly; completion and final persistence disabled; user can leave HA uncompleted or explicitly disable optional assessment |
| HA passing gates | Highest label is multidisciplinary review, not treatment approval; explicit review confirmation required; any data change revokes review completion |
| Missing route data | Missing case/snapshot handled with alert rather than seeded clinical defaults |

## Route and data flow

`main.tsx` mounts `BrowserRouter basename="/SA-AKI"` and `ApplicationRoutes`.

- `/` → CaseListPage → CaseForm / ImportExportPanel → existing caseRepository → IndexedDB.
- `/case/:caseId/assessment` → case load → session draft (versioned, case-scoped, allowlisted field keys) → schema-driven input validation → final review → explicit confirmation → validated repository save.
- `/case/:caseId/assessment/:snapshotId` → same-case snapshot lookup → read-only review. Cross-case/missing snapshot IDs cannot select another case's snapshot.
- Confirmed save navigates to its saved snapshot path. A new-timepoint link returns to the fresh assessment path.
- HA calls evaluateHaEligibility only after snapshot schema validation. Prior observation selection is same-case and strictly earlier by timestamp. No HA cutoffs live in React.
- CaseExport validation also blocks sepsis-hour / absolute timestamp conflicts before persistence.
- Drafts are not clinical snapshots and are never exported as confirmed records. Draft retention is best-effort sessionStorage in the same tab, is cleared after successful save/deletion, and is not represented as permanent storage.

## Accessibility and responsive structure

- Native buttons, links, selects, inputs, and disclosure controls; creation confirmed with keyboard Enter in integration test.
- Every numeric field has a native associated label, visible unit and accepted schema range/help, aria-describedby, aria-invalid, and associated alert error text.
- Unknown booleans are explicit; no unchecked-checkbox-as-false clinical fields. Checkbox is used only for intentional HA opt-in.
- Step navigation is labeled, marks `aria-current="step"`, exposes progressbar values, and focuses the step/review heading on navigation.
- Destructive confirmation focuses cancel first, names the target, and exposes an alertdialog; it is intentionally nonmodal and does not falsely claim a focus trap.
- Shared safety band preserves adult-only boundary and exact exclusions / judgment-not-replacement wording.
- Approved navy/teal/amber tokens and 33% / 38% / 29% desktop workspace; ≤1050px changes to a stacked wizard, paired inputs, eight progress segments, horizontally scrollable step controls, and sticky native action footer. At ≤360px fields become one column.
- Automated DOM checks do not establish actual viewport layout, contrast, overflow, or screen-reader behavior; those remain Task 13 checks.

## Files

- `src/components/FormField.tsx`, `Stepper.tsx`, `WorkflowLayout.tsx`
- `src/features/cases/CaseListPage.tsx`, `CaseForm.tsx`, `ImportExportPanel.tsx`
- `src/features/assessment/AssessmentWizard.tsx`, `draft.ts`
- `src/features/assessment/steps/AssessmentStep.tsx`, `fields.ts`
- `src/styles/workflow.css`
- `src/app/routes.tsx`, `src/main.tsx`
- `tests/components/case-flow.test.tsx`, `assessment-wizard.test.tsx`
- This report.

No existing clinical engine/schema/repository contracts were modified. The former Task 1 App shell and its regression tests remain intact as the concept fixture; the live entrypoint now uses the routed workflow. Task 11 can extend ApplicationRoutes / WorkflowLayout for its decision workspace.

## Self-review / concerns

- Fixed fresh-timepoint routing and HA final-review disclosure before signoff; guarded quantitative HA gates with real engine integration rather than mocks.
- Saved snapshots are intentionally append-only/read-only because repository semantics reject replacement IDs. This UI does not silently overwrite prior observations.
- Baseline metadata can be entered during case creation or imported; editing case baseline metadata after creation is not implemented. The wizard makes missing baseline provenance explicit. Advanced repeating schema collections (full drug administration/TDM/device exposure logs and adverse-event arrays) remain importable/exportable but do not yet have dedicated repeated-row editors.
- Clinical conclusions outside HA remain provisional here; decision dashboard integration belongs to Task 11. This task does not claim clinical content has been professionally reviewed.
- Browser navigation/rendering remains blocked by the previously documented environment restrictions. Task 13 must verify desktop/mobile screenshots, comparison with approved concepts, actual accessibility/overflow, and hard-refresh/static-host deep-link behavior under `/SA-AKI/`; MemoryRouter checks do not prove host rewrite behavior.
- Build size should be revisited during production hardening; no performance claim is made. Draft storage may be blocked or cleared by the browser; UI explicitly labels it best effort and final save is separate.

## Fix round 1 / 5 — review findings

All three Important findings addressed. This section supersedes the original limitation on post-creation baseline editing and the original rule that all opted-in HA snapshots required completed gates before observation persistence.

### RED evidence

- Added UI regressions before fixes: metadata correction/cancel/reopen; conflicting metadata rollback; a true UI-only two-timepoint HA baseline/bootstrap flow; imported second- and millisecond-precision reopen. Focused UI run: **5 failed / 11 passed**. Failures were absent metadata-edit controls, absent incomplete-HA observation persistence, and lossy timestamp display.
- Added repository update interface stub and real IndexedDB persistence/rollback tests: **2 failed / 13 passed**, demonstrating absent metadata writes and missing conflict rejection.
- Self-review added a regression for a saved, explicitly incomplete observation whose quantitative gates pass. Observed false positive eligibility display: **1 failed / 16 passed** in the UI suite.
- Added opt-out measurement-preservation regression and temporarily restored the old HA-field dropping condition to verify the regression catches the defect. Observed `il6PgMl` undefined instead of 1200; restored the corrected observation mapping. The two outstanding safety regressions were red before their final fixes.
- The UI-only bootstrap test waits for persisted IL-6 to reappear after save navigation, avoiding the transient local saved-state / route reload synchronization issue discovered during implementation.

### Changes and safety boundaries

1. **Observation storage separated from HA review completion.** An opted-in user may explicitly check `僅儲存未完成 HA 觀察（不代表符合資格）` in final review. Snapshot/case validation remains mandatory. The observation persists with `hemoadsorptionAssessment.reviewStatus: 'incomplete'`, and is visibly labeled `HA 評估未完成／不符合審查資格；僅保存觀察資料。`. The multidisciplinary completion action remains disabled for missing/failed engine gates. A saved incomplete observation does not acquire a positive eligibility label on reopen, even when numeric prerequisites happen to pass. Successful, explicitly confirmed multidisciplinary review is separately recorded as `reviewStatus: 'multidisciplinary-review'`; this is never treatment eligibility or an order. Any input change resets transient acknowledgements. Existing imports without this optional status remain accepted; no old record is rewritten.
2. **Measurements survive opt-out.** HA-specific assessment flags are omitted when the user disables assessment, but validated entered numeric observations such as IL-6 remain in review and the saved snapshot. UI explicitly explains that disabling assessment does not discard observation values.
3. **Atomic metadata editing.** Case-list edit action reuses the anonymous metadata form with initial values and explicit update confirmation. Cancel performs no write. `caseRepository.updateCase` rejects direct identifiers and invalid metadata, then checks the candidate case together with every existing snapshot inside a read/write transaction before replacing the case row. Conflicting sepsis onset cannot partially update the baseline or rebase existing snapshots. Missing cases are rejected. Fields not edited—including imported fields not exposed by this form—remain unchanged.
4. **Immutable timestamp precision.** Saved snapshots are passed directly to clinicalSnapshotSchema, caseExportSchema, and the HA engine rather than reconstructed from editable strings. Review displays the original ISO timestamp, including seconds/milliseconds and original representation. Read-only datetime controls retain millisecond precision, with native 0.001-second steps. Metadata edits preserve original ISO values exactly unless that particular field was edited. Chronological prior-observation selection uses the original saved timestamp.

### Added interaction evidence

| Scenario | Result |
| --- | --- |
| UI-only anonymous create → initial 4 h observation → opt-in + IL-6 1200 → explicit incomplete save | Reopens with IL-6 intact and incomplete/not-qualified status; no repository or sessionStorage fixture seeding in this test |
| Same UI-only case → new 6 h observation → serial values and required clinician assessments → multidisciplinary confirmation | Baseline is found by the real engine; both timepoints remain visible; strongest saved status is multidisciplinary review, not treatment eligibility |
| Edit baseline, cancel, reopen | Original case and snapshots unchanged |
| Correct baseline/provenance, confirm, reopen | Correction persists; original precise onset and snapshots preserved |
| Change sepsis onset inconsistently / invalid shock chronology | Update rejected; all prior metadata and snapshots retained |
| Reopen imported snapshots at `06:00:30Z` and `06:00:00.375Z`, with earlier observations within that same minute/second | Exact original timestamp displayed; no false schema/chronology conflict; valid engine review remains available; exported records unchanged |
| Saved incomplete HA observation with passing numeric gates | No eligibility/completion promotion on reopen |
| Opt in, enter IL-6, opt out, save | Observation value persists; no HA assessment/eligibility is created |

### Final verification and files

Fresh verification: **33 focused tests passed across case-flow, assessment-wizard, and repository suites; 832 full-suite tests passed across 16 files**. Production typecheck, explicit test typecheck (command above), lint, production build, and diff whitespace checks all passed. Existing nonblocking npm proxy, Vitest environment, PWA deprecation, and >500 kB chunk warnings remain unchanged.

Modified: `src/features/assessment/AssessmentWizard.tsx`, `src/features/cases/CaseForm.tsx`, `CaseListPage.tsx`, `src/components/FormField.tsx`, `src/data/caseRepository.ts`, `src/data/schema.ts`, `src/clinical/types.ts`, both component test files, repository tests, and this report. No clinical rule/threshold engine changes or route/visual hierarchy changes. Optional HA reviewStatus extends the existing version-1 record schema; legacy records without it remain valid.

Commit: `fix: preserve HA observations and precise case history` (the commit containing this section).

Remaining concerns: browser/visual/static-host deep-link verification remains Task 13; saved observations remain immutable and append-only; editing repeated advanced clinical-log arrays remains outside this task; build chunk-size warning remains. No unresolved finding from this fix round is known.
