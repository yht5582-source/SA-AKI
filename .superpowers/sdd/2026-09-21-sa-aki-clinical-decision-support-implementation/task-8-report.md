# Task 8 report — fail-closed hemoadsorption review engine

Status: implemented and verified. Clinical governance validation is still required before deployment.

Implementation commit: `33383552f3c9c9360f36f5574e0f2631d2736910` (`feat: add gated hemoadsorption decision support`). This hash-only report update is a separate `docs: record Task 8 implementation commit` commit.

## Interfaces and integration

- `evaluateHaEligibility({ snapshot, previousSnapshot? }): HaEvaluation` returns the explicit Task 8 status/gates/results contract. `HaEligibility` is exactly `not-eligible | incomplete | multidisciplinary-review`.
- `matchHaDevice(input): DecisionResult[]` returns the gated evaluation plus a conditional device-trait match; blockers never produce a match.
- `evaluateHaResponse({ baseline: { snapshot, previousSnapshot? }, snapshot }): DecisionResult[]` reviews an existing exposure against its complete pre-treatment assessment. The baseline snapshot must correspond to the exposure's recorded initiation timestamp, and the current snapshot must be later and belong to the same case. Exactly one active exposure is required; ambiguous/missing exposure or a changed device/target needs immediate clarification.
- The strongest eligibility conclusion is exactly `eligible for multidisciplinary review`. No output creates a machine prescription, antibiotic calculation or treatment authorization. Decision text is tested against recommend/start/order/fixed-dose language.
- One backward-compatible optional `ClinicalSnapshot.hemoadsorptionAssessment` object records opt-in, the four gates, target/device/immune phenotype and current review assessments. All fields remain optional; absent assessments remain unknown. Schema version stays 1; existing snapshots remain valid. JSON/schema round-trip tests retain false and zero observations, and strict schemas reject malformed assessments.
- Pure engine only: no React, automatic activation, external API, device control, UI/storage integration or deployment is added. Consumers should use the result arrays without duplicate cards if calling both eligibility and matching.

## Gate matrix

| Gate | Required observations/assessments | Missing or failed behavior |
| --- | --- | --- |
| Entry | Explicit `optedIn: true` | Absent/false: not eligible and no HA decision cards from any public entry point |
| Clinical population | Adult and septic shock explicitly confirmed; reversible trait | Missing is incomplete; false is not eligible |
| Clinical standard care | Appropriate antimicrobial care and actual administration time; source-control assessment/status/plan; fluid, vasopressor and applicable steroid assessment complete | Each absent/false assessment blocks independently; inadequate source control blocks |
| Clinical trajectory | Same-case chronological prior/current quantitative NE-equivalent, lactate, SOFA; persistent/worsening assessment compatible with measurements; current MAP, CRT/perfusion and timed urine | A single IL-6, isolated shock label, reversed/cross-case chronology or measured resolving shock cannot pass |
| Target | Supported device and compatible measured/assessed trait; device-specific details below | No generic filter/device-availability, CRP/PCT/ferritin, AKI or Gram-negative shortcut |
| Safety | Platelet, fibrinogen and albumin observations plus explicit acceptable risk; hepatic/renal, electrolytes, access, anticoagulation, circuit and drug-removal reviews; no uncontrolled bleeding or irreversible failure; compatible goals | Every boolean is checked independently; no default negative veto or invented normal lab value |
| Governance | ICU, nephrology, infectious-disease and pharmacy exposure approval; protocol/registry/research; applicable consent obtained or explicitly not required; device protocol, monitoring and stop plan; explicit 6–12 h review ceiling | Absent/pending is incomplete; revoked/false is not eligible; no trial-plan card until all gates pass |

Local trajectory convention: the declared worsening trajectory needs an observed increase in NE-equivalent, lactate or SOFA; persistent shock can use non-improving repeated observations. Quantitative serial IL-6 must be non-falling and positive at the current observation, with an explicitly compatible hyperinflammatory phenotype. These conservative fail-closed review prerequisites are **not** validated clinical eligibility thresholds or an inferred diagnosis. There is no universal IL-6, norepinephrine enrichment, lactate enrichment, HLA-DR or platelet-count cutoff.

The 5 Rights are explicit in the conditional plan: patient with a reversible trait after standard care; device matched to measured target; timing after essential care/source-control assessment; dose only under the specific IFU/protocol; stop plan written before exposure.

## Device/evidence matrix

| Device | Trait conditions beyond all other gates | Evidence boundary |
| --- | --- | --- |
| CytoSorb | Cytokine target, quantitative serial IL-6, compatible dynamic hyperinflammation, immunoparalysis and low-HLA-DR vetoes excluded | Position-level phenotype discussion plus local safeguards; no PMX evidence or efficacy inference |
| Jafron HA330 | Same required cytokine/immune observations, separately named device/protocol | Not interchangeable with CytoSorb or HA380; no PMX evidence |
| Jafron HA380 | Same required cytokine/immune observations, separately named device/protocol | Not interchangeable with HA330 or CytoSorb; no PMX evidence |
| Polymyxin B | Endotoxin target; valid EAA within 0.60–0.89 inclusive; integer MODS >9 | Verified **exploratory post-hoc/per-protocol EUPHRATES** enrichment range only; no validated indication, mortality benefit or TIGRIS claim |
| oXiris | Independent indication from Task 6; cytokine target needs serial IL-6/phenotype; endotoxin target needs measured EAA and explicit endotoxin phenotype; mixed target needs both | Immune veto checks apply to this nonselective device even if the selected target is endotoxin. PMX EAA/MODS range never transfers to oXiris |
| Other/missing/mismatched device | No match | Fail closed |

The oXiris check calls the existing `evaluateKrtInitiation(snapshot)` and requires its `krt-emergency-indications` decision to be critical (Task 6's separately confirmed-indication contract). A high potassium screen alone, azotemia, CRRT mode/exposure, inflammatory values or machine availability does not pass. This deliberately does not create a free-standing `hasCrrtIndication` bypass flag. Integration must preserve the Task 6 ID/severity meaning; if that contract changes, update the adapter and integration cases together. Ongoing clinical need for CRRT remains a separate KRT/liberation decision, not an HA-created indication.

## Time-limited review, monitoring and stops

- Only after all gates pass: conditional baseline/serial NE-equivalent, MAP, lactate, CRT/perfusion, timed urine, SOFA, target, platelets, albumin and antimicrobial-time review; early 2–4 h safety check; explicitly planned 6–12 h ceiling. Initial reassessment is bounded at 2 h, not an instruction to leave an unstable patient unobserved.
- Response compares the original measured baseline with the current same-case snapshot. Current safety, immune, consent and governance assessments are separately required; a baseline approval does not silently carry over after revocation or missing reassessment. Serial coagulation and timed urine also remain required.
- Stop/futility review: rising NE-equivalent, worsening SOFA, uncontrolled source, explicit lost target, severe adverse events, bleeding, recurrent circuit clotting, unacceptable laboratory/drug risk, immune paralysis, irreversible failure or incompatible goals. Current safety/governance revocation prompts immediate stop review.
- At the predeclared review ceiling, absent improvement in NE-equivalent, lactate, CRT/perfusion, SOFA or the device's target prompts immediate stop/futility review. Uncontrolled planned/in-progress source control at that point also blocks continuation. No automatic continuation is emitted even when observations improve.
- Missing/invalid/cross-case data never establish response; they require immediate clarification. Adverse-event timestamps are checked against the documented exposure; no response can be attributed from a reversed timeline.
- NE-equivalent <0.05 and lactate <2 appears only as a **shock-reversal reference**, explicitly not a validated HA cessation endpoint. It does not decide stopping or demonstrate HA benefit.
- Drug cards preserve full loading dose without delay/reduction, capture medication/HA/cartridge/TDM timestamps, and prompt pharmacy-led vancomycin AUC/TDM, linezolid/azole/beta-lactam TDM when available and appropriate extended-infusion review. Individual review includes infection source, MIC, distribution volume, residual renal function, actual CRRT delivery and the specific device. Entered drug dose amounts are not converted into dose advice or repeated as a suggested dose.

## Evidence verification and exact claim scope

| ID | Status/verification | Executable or explanatory scope |
| --- | --- | --- |
| `SSC_2026` | Verified guideline | First active HA card: conditional against routine blood purification (very-low certainty); separate PMX warning (low certainty). Verified on the [official guideline page](https://www.sccm.org/clinical-resources/guidelines/guidelines/surviving-sepsis-campaign-international-guidelines-for-management-of-sepsis-and-septic-shock-2026). |
| `ADQI_30` | Verified 2024 consensus, not a clinical practice guideline | Modern HA remains experimental; target removal is not outcome benefit. Existing registry verification retained; abstract independently cross-checked in the [author institution's publication record](https://research.monash.edu/en/publications/hemoadsorption-consensus-report-of-the-30th-acute-disease-quality/). Publisher and previously recorded public PDF returned errors during this task, so no new full-text claims were added. |
| `MOLNAR_2026` | Verified position statement/review | Expert phenotype discussion only. [Primary article](https://link.springer.com/article/10.1186/s13054-026-06135-1) independently checked; its timing/dose suggestions and secondary description of TIGRIS are not promoted into validated rules. |
| `EUPHRATES_POSTHOC_2018` | Newly verified trial-source record, explicitly labeled exploratory post-hoc/per-protocol analysis | Only `pmx-exploratory-enrichment`: EAA 0.60–0.89 and MODS >9 describe the PMX subgroup. Parent trial neutral; no treatment efficacy or mortality-benefit claim. [Primary article and Table 1](https://link.springer.com/article/10.1007/s00134-018-5463-7). No rounding 0.8901 into range. |
| `APP_HA_REVIEW_V1` | Local operational/review convention; verified as declared, **not clinically validated** | Required gates, exact review-only label, 5 Rights, drug review and conservative monitoring/stop safeguards. Separately scoped to five local rule IDs. Does not attribute these stricter prerequisites to SSC, ADQI or Molnar as validated guidance. |
| `TIGRIS_2026` | Unverified, unchanged | No supported claims, no executable citation or threshold, no TIGRIS-like eligibility label. The resolver still throws if it is used to enable PMX. |

All emitted decisions pass the existing rule-scoped evidence resolver. Tests explicitly reject EUPHRATES as support for the generic device rule and confirm that CytoSorb/HA330/HA380/oXiris outputs never cite it. No KDIGO draft, PHIND or ImmunoSep study enables HA.

## Deliberately excluded unsupported rules

- No universal 12/24 h HA initiation cutoff.
- No universal 8–12 h cartridge-replacement schedule or 13 L/kg treatment-volume target.
- No universal IL-6, HLA-DR, platelet >100, NE >=0.2 or lactate-enrichment eligibility cutoff.
- No automatically calculated antibiotic supplement, extra dose or device-derived dose change.
- No assumed survival benefit or generalized PMX/TIGRIS effect across devices.
- No adsorption-created CRRT indication, automatic HA eligibility from AKI/CRRT, or biomarker-only HA eligibility.

## RED / GREEN record

1. Wrote 180 HA tests and 11 schema tests before implementation. Initial missing-module run was not accepted as behavioral proof; after minimal empty exports, **102 failed / 89 passed (191)**. Examples: expected exact review eligibility but received incomplete; positive PMX boundary and device-match failures; response/stop cards absent; assessment rejected by strict v1 schema. The fail-closed negative cases passing empty exports were also exercised against the later positive implementation.
2. Initial full implementation: **190 passed / 1 failed**. The remaining failure was an over-specific test regex requiring the words “post-hoc” before “exploratory”; both were present. The test was corrected to assert both safety qualifiers independently, with no production behavior changed. Full suite then **579 passed**.
3. Self-review reproduced an oXiris immune-check bypass when its requested target was endotoxin: **4 new tests failed**. Cause: immunity checks were nested under the cytokine target branch. Moved them to the nonselective-device branch. Focused suite **195 passed**.
4. Self-review reproduced stale baseline authorization during ongoing exposure: **23 new tests failed**, covering current approvals/consent/immune status, changed device/target and missing serial coagulation/urine. Added explicit current-state checks; focused **218 passed**, full **606 passed**.
5. Completed the same current-state safety matrix: **11 new tests failed**, covering renewed liver/renal/electrolyte/access/anticoagulation assessments, missing negative veto assessments and missing governance setting. Completed current reassessment requirements. Final focused **229 passed**, full **617 passed**.

No mocks or generated expected results are used. Core fixtures and numeric limits are explicit. Tests include gate-by-gate undefined/false/true veto cases, failed groups, IL-6/CRP/PCT/ferritin shortcuts, PMX EAA lower/exact/upper/outside boundaries, MODS boundary/type validity, oXiris independent-indication boundary, immune vetoes, exact strongest label, 6/12 h windows, harmful/futile response, serial missing data, adverse events, drug/timing protection and source isolation.

## Final verification

```text
npm test -- tests/clinical/ha.test.ts tests/data/haSchema.test.ts --run
2 files passed; 229 tests passed; exit 0

npm test -- --run
12 files passed; 617 tests passed; exit 0

./node_modules/.bin/tsc --ignoreConfig --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --jsx react-jsx --esModuleInterop --types vitest/globals,node,@testing-library/jest-dom tests/clinical/*.test.ts tests/data/*.test.ts
exit 0

npm run typecheck
exit 0

npm run lint
exit 0

npm run build
exit 0; application/service worker built; 114 precache entries

git diff --check
exit 0
```

Existing non-fatal messages: npm's unknown `http-proxy` environment setting, Vitest's repeated-jsdom performance suggestion, and the service-worker bundler's deprecated `inlineDynamicImports` option. No full-suite failures omitted.

## Files and self-review concerns

- `src/clinical/ha.ts`
- `src/clinical/types.ts`
- `src/clinical/sources.ts`
- `src/data/schema.ts`
- `tests/clinical/ha.test.ts`
- `tests/clinical/haFixtures.ts`
- `tests/data/haSchema.test.ts`
- This report.

The test-driven-development, systematic-debugging and verification skills shaped the RED/GREEN safety checks and prevented completion claims before full verification. The requesting-code-review skill's independent review is handed to the coordinating agent under the explicit no-subagent task constraint; no reviewer was spawned here.

Remaining integration/clinical concerns: this is conservative review support, not a validated indication model or medical-device clearance. Assessment booleans must be completed by authorized clinicians/pharmacy and tied to the current observation; they cannot be prechecked in the UI. Quantitative observation validity cannot prove a phenotype. A strict same-time 0 h baseline is required for exposure interpretation; if clinical workflow uses earlier baselines, a separately governed timestamp tolerance would need explicit requirements and tests. Task 6's confirmed-indication decision contract must remain stable. The exact device IFU, regional authorization, consent process, research protocol and clinical stop procedures still require local clinical governance; no manufacturer-specific operational parameters have been inferred. No blocker remains for the requested implementation, but release requires the spec's independent clinical review.

## Fix round 1 — current target confirmation and MODS domain

Commit title: `fix: revalidate HA targets and constrain MODS`.

Both Important review findings were reproduced before production changes:

1. The response path checked initial eligibility and current safety/governance, but did not require the applicable **current** hyperinflammatory/endotoxin phenotype or a positive target-presence assessment. A schema-valid lost/unknown phenotype or unknown target could retain a two-hour pending-review interval. Target false already stopped, but missing was silently accepted.
2. MODS validation only required a nonnegative integer. Values 25 and 999 therefore passed both the PMX target gate and the snapshot/JSON-import schemas.

### RED and minimal fixes

Added device-specific response tests for CytoSorb, HA330, HA380, oXiris cytokine, oXiris endotoxin, oXiris mixed targets, and PMX. Each applicable phenotype is exercised with false/undefined/true; every device/target combination also exercises false/undefined/true target presence and incompatible actual exposure. Inputs are parsed through the strict snapshot schema before response evaluation. Positive fixtures explicitly record target presence (test data only; no production default), and retain **falling** IL-6/EAA so a fix cannot accidentally require renewed biomarker escalation. Irrelevant phenotype flags are false to catch cross-target overblocking.

MODS tests cover direct engine 24 accepted / 25 and 999 rejected, snapshot 0/24 accepted with negative/fractional/over-range rejected, and JSON-import 24 accepted / 25 and 999 rejected with the correct import error path.

First focused RED: **29 failed / 280 passed (309)**. The failures were 23 missing/lost current target/phenotype cases and six out-of-domain MODS cases (engine, snapshot and import). The initial positive and mismatch-control cases passed.

Minimal MODS correction: constrain persisted MODS to integer 0–24 and independently require the same domain in the direct PMX engine before applying the exploratory >9 subgroup criterion. The focused MODS run then passed **15 tests**. The domain is independently confirmed in the [original Marshall et al. MODS publication abstract](https://pubmed.ncbi.nlm.nih.gov/7587228/); it is score-domain validation, not a new HA eligibility or mortality threshold.

Minimal ongoing-target correction:

| Current state | Output |
| --- | --- |
| `targetStillPresent` missing, or applicable phenotype missing | Immediate incomplete review, missing-data explanation, reassessment 0 h |
| `targetStillPresent: false`, or applicable phenotype false | Immediate critical stop/reassess review, even if other fields are also missing |
| Cytokine target | Require current `hyperinflammatoryPhenotype: true` |
| Endotoxin target, including PMX | Require current `endotoxinPhenotype: true` |
| Mixed target | Require both current phenotype confirmations |
| All confirmations true and otherwise acceptable observations before the review ceiling | Retain pending serial review; falling biomarkers do not have to rise again |
| Active exposure incompatible with current device/target assessment | Immediate incomplete review; every active exposure is checked, with multiple-active-exposure ambiguity still blocked |

The local `ha-response-review` evidence scope now states these conservative reassessment requirements. No validated biomarker threshold, efficacy claim, automatic continuation or treatment authorization was added. Six compatibility-control tests initially also had an explicitly absent alternate phenotype after the fixture refinement; stop correctly took precedence. Those fixtures were made phenotype-complete to isolate the intended compatibility assertion, without loosening the safety expectation.

### Final verification

```text
npm test -- tests/clinical/ha.test.ts tests/data/schema.test.ts tests/data/haSchema.test.ts --run
3 files passed; 309 tests passed; exit 0

npm test -- --run
12 files passed; 681 tests passed; exit 0

./node_modules/.bin/tsc --ignoreConfig --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --jsx react-jsx --esModuleInterop --types vitest/globals,node,@testing-library/jest-dom tests/clinical/*.test.ts tests/data/*.test.ts
exit 0

npm run typecheck
exit 0

npm run lint
exit 0

npm run build
exit 0; application and service worker built, 114 precache entries

git diff --check
exit 0
```

Existing npm environment, jsdom performance and bundler-deprecation warnings are unchanged. No full-suite failures omitted. Changed files: HA engine, local evidence scope, snapshot schema, HA tests/fixtures, existing schema tests and this report. No new fields, schema-version change, subagents or unrelated edits. Self-review checked that explicit loss takes precedence over unknowns, current trait validation is separate from pre-treatment enrichment, non-applicable phenotypes do not block, and PMX upper-bound validation cannot be bypassed by calling the engine without schema parsing. No unresolved blocker remains for these two findings; independent review and the previously recorded clinical-governance constraints remain required.
