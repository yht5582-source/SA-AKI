# Task 7 report — adult CRRT prescription calculations

Status: implemented and verified; clinical governance review remains required.

Implementation commit: `a7d3719d62d06613283efc1dbeb615360ab017dc` (`feat: add CRRT prescription safety engine`).

## Scope and interface

Pure `calculatePrescription(input): CrrtPrescription` and `evaluatePrescriptionSafety(input): DecisionResult[]`. The module exports `PrescriptionInput` and `CrrtPrescription`; no React, schema, persistence, device API, machine-executable order or survival-benefit claim is added. It reuses `WeightBasis`, `Sex`, `CrrtMode`, `Anticoagulation`, `DecisionResult`, existing ideal/adjusted weight helpers and the rule-scoped evidence resolver.

All potentially missing observations are optional; required arithmetic inputs return explanatory `missingData` and undefined calculated fields, not NaN/Infinity. Explicit adult eligibility, weight selection/rationale, target, downtime, mode, all solution flows (including explicit zero PBP), patient blood flow and fractional hematocrit are required. Unknown/poor perfusion or unknown/rising pressors hold UFNET at a conservative zero review default and block checklist completion.

`totalEffluentMlHr` is the compensated target, whereas `configuredEffluentMlHr` is the sum of entered flows. `estimatedDeliveredMlKgHr` is a model from entered flows, not measured clearance. `observedDeliveredMlKgHr` is a separate clinician-provided observation on the same weight basis and interval. No automatic allocation of target flow into dialysate/replacement settings occurs.

## Formula table

| Output | Formula | Units / assumptions |
| --- | --- | --- |
| Selected weight W | Explicit actual, ideal or adjusted selection; documented rationale | kg; never selected from BMI; existing Devine/0.4 adjustment helpers used only after selection |
| Native plasma flow Qp | Qb × 60 × (1 − Hct) | mL/h; Qb is patient whole blood mL/min BEFORE separate PBP infusion; Hct fractional, not percent |
| Total pre-filter fluid Qpre,total | Qpre + QPBP | mL/h; replacement and separate citrate/PBP must not be double counted |
| Total membrane ultrafiltration QUF | Qpre + Qpost + QPBP + UFNET | mL/h; excludes dialysate |
| Configured effluent Qeff | Qd + QUF | mL/h; UFNET is counted once, not confused with entire effluent |
| Filtration fraction | 100 × QUF / (Qp + Qpre + QPBP) | %; plasma-plus-pre-fluid denominator, not whole-blood concentration ratio |
| Pre-dilution factor F | Qp / (Qp + Qpre + QPBP) | dimensionless, simplified plasma-based small-solute dilution model |
| Uptime U | 1 − downtimeFraction | dimensionless; downtime must be in [0, 0.5); >=50% requires manual review |
| Compensated prescription | target / (U × F) | mL/kg/h; routine adult delivered target only 20–25 inclusive |
| Target total effluent | compensated prescription × W | mL/h; all upstream calculations unrounded |
| Estimated delivered dose | Qeff / W × F × U | mL/kg/h; never substitutes for observed delivery or measured clearance |

CVVHD requires dialysate >0 and replacement =0; CVVH requires dialysate =0 and replacement >0; CVVHDF requires both >0. PBP/citrate is accounted separately and does not itself reclassify CVVHD into CVVHDF. SCUF does not receive a solute-dose prescription. Total filtration >=100% and invalid/overflow/underflow calculations fail closed. FF >=25% is an explicitly local review flag, not a universal device limit or the NSI concentration-ratio threshold. Compensation holds entered pre/PBP flow constant: any flow change requires recalculation.

Display rounding: dose and FF to one decimal place; flows to whole mL/h; the internal dimensionless dilution factor remains unrounded. No inferred normal weight, downtime, Hct, zero flow or measured delivery is supplied.

## Independently calculated fixtures

- W 80 kg, target 25, downtime 0.2, no pre-fluid: 25/0.8 = 31.25 mL/kg/h, displayed 31.3; total 2500 mL/h, not 2504 from multiplying a rounded dose.
- Qb 200 mL/min and Hct 0.30: native plasma flow 8400 mL/h. CVVH post 2000 plus UFNET 100: QUF 2100, FF 25%. CVVHDF dialysate 1000/post 1000/net 100: effluent 2100, QUF 1100, FF 13.1%.
- Pre 1000/post 1000/net 100, no dialysate: denominator 9400, FF 22.3%; modeled delivery at W80 and uptime0.8 is 18.8; compensated target total 2798 mL/h.
- CVVHD dialysate 2000/PBP600/net100: denominator9000, QUF700, effluent2700, FF7.8%, modeled delivery25.2; compensated total2679 mL/h.
- Obesity fixture actual120/ideal70 explicitly selects actual120, ideal70 or adjusted90; target25 and no downtime produce totals3000/1750/2250 respectively.

## Safety and monitoring

Device-neutral explanation precedes optional Prismaflex/PrisMax `operational starting point` objects. The editable blood-flow discussion default is app-local 150 mL/min, not manufacturer validated, and never enters arithmetic unless explicitly supplied by the caller. Complete checklist requires actual device selection, anticoagulation selection, reviewed bleeding/systemic anticoagulation, eligible RCA if selected, and all five confirmations: device, solution composition, weight basis, anticoagulation, pharmacy dosing. Completion never authorizes therapy.

RCA preference is conditional on explicit contraindication assessment, an available protocol and bleeding/overlap review. Unknowns or contraindication withhold preference; no automatic heparin fallback. Liver dysfunction, shock and impaired citrate metabolism prompt specialist review, not an automatically inferred absolute contraindication. Monitoring covers systemic/circuit ionized calcium, total/ionized calcium trend, calcium requirements, citrate accumulation, sodium, potassium, magnesium, phosphate, buffer/pH/bicarbonate, glucose, temperature, nutrition losses, drug/TDM review, bleeding/platelets/filter life/TMP, downtime and prescribed-versus-delivered dose.

## Evidence IDs and primary verification

- `KDIGO_2012`: final guideline sections 5.8.4 and 5.3.1–5.3.3/rationale support adult delivered target and conditional RCA. RCA claim scope was added after primary PDF verification. [Primary guideline](https://kdigo.org/wp-content/uploads/2019/01/KDIGO-2012-AKI-Guideline-English.pdf).
- `NSI_CRRT_2016`: added verified original Nomenclature Standardization Initiative consensus; plasma-based FF, total-versus-net UF, dose labels and pre/post-dilution principles. [Primary consensus](https://link.springer.com/article/10.1186/s13054-016-1489-9). Its distinct whole-blood concentration ratio is not mislabeled as FF.
- `CRRTNET_WEIGHT_2026`: existing verified scope for Devine and adjusted-weight arithmetic, not automated weight choice.
- `APP_CRRT_PRESCRIPTION_V1`: explicitly declared local numerical assumptions, required inputs, downtime gate, FF review flag, UFNET hold, checklist/operational-default and RCA safeguards. Local `verified` status confirms the declared convention, not clinical validation. Reassessment ceilings 15 minutes for rising pressors/inadequate perfusion and 1 hour otherwise are local.
- All three emitted decisions resolve against specifically scoped verified sources. No KDIGO 2026 draft enables rules.

## TDD evidence

Tests written before implementation with literal hand-calculated fixtures and no mocks.

1. Initial focused command failed because module did not exist; this import failure was not accepted as sufficient behavioral RED.
2. Minimal empty exports: **75 failed / 1 passed (76)**. Expected sample: compensated dose expected31.3 but receivedundefined. The initially vacuous evidence-loop test was subsequently strengthened to assert the three returned decisions.
3. Initial implementation: **76 passed (76)**.
4. Self-review identified separate PBP/citrate accounting omission; added tests first: **5 failed / 76 passed (81)**. Example: FF expected7.8, received1.2; missing PBP expected withheld total, received2500.
5. Added explicit PBP flow accounting: **81 passed (81)**.

## Final verification

```text
npm test -- tests/clinical/prescription.test.ts --run
Test Files 1 passed (1); Tests 81 passed (81); exit 0

npm test -- --run
Test Files 10 passed (10); Tests 382 passed (382); exit 0

./node_modules/.bin/tsc --ignoreConfig --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --jsx react-jsx --esModuleInterop --types vitest/globals,node,@testing-library/jest-dom tests/clinical/*.test.ts tests/data/*.test.ts
exit 0

npm run typecheck
exit 0

npm run lint
exit 0

npm run build
exit 0; application + service worker built, precache 114 entries

git diff --check
exit 0
```

Non-fatal existing warnings: npm unknown `http-proxy` environment setting; service-worker bundler deprecated `inlineDynamicImports`; Vitest repeated jsdom-environment performance suggestion. No failed full-suite tests omitted.

## Files

- `src/clinical/prescription.ts`
- `tests/clinical/prescription.test.ts`
- `src/clinical/sources.ts`
- This report.

## Self-review and concerns

- Checked explicit weight basis/rationale, 20/25 boundaries, zero/partial/extreme downtime, all modalities, pre/post/PBP accounting, hematocrit percent-vs-fraction mistakes, blood/plasma denominator, invalid/missing/overflow inputs, escalating pressors, measured-versus-modeled delivery, citrate gate, five checklist confirmations and evidence resolution.
- All changes confined to this task. No persistence/schema migration or machine integration introduced.
- The plasma-based dilution estimate assumes freely cleared small solute and near-complete effluent saturation, omits red-cell urea kinetics and plasma-water corrections, and can overestimate true clearance from membrane fouling/reduced saturation. Its limitations are emitted in assumptions; measured delivery remains separately required for clinical dose review.
- Qb input is patient blood flow before PBP. A device displaying combined pump flow requires external reconciliation; no manufacturer-specific pump interpretation is silently inferred.
- Systemic calcium and other external infusions belong to patient balance, not automatically to circuit effluent. PBP/citrate is separately entered and counted once.
- No device capability, specific solution composition, anticoagulant infusion algorithm or drug dosing is inferred. The editable default and all local gates require nephrology/ICU/nursing/pharmacy/device-governance approval before clinical deployment.
- Parent integration must map snapshot trends (`worsening/unchanged/improving`) to the explicit prescription input (`rising/stable/falling`) and must collect the additional calculation fields. Unknown values must remain undefined.

## Fix round 1 — reject unsupported diffusive clearance / target compensation

Important review finding reproduced: CVVHD Qb20 mL/min, Hct0.30, Qd2000 mL/h, no replacement/PBP/UFNET, W80kg, target25 and zero downtime returned modeled delivery25 despite native blood inflow1200 mL/h and plasma840 mL/h. Existing filtration-fraction validation alone cannot catch excessive diffusive flow.

### RED / GREEN

Added six literal cases before the fix. Focused RED: **3 failed / 84 passed (87)**. Both Qb20/Qd2000 and the just-above-domain Qb50/Qd2101 cases returned25 instead of withholding the estimate. The separate target-compensation case returned19 instead of withholding an infeasible target. Three existing-valid boundary cases stayed green, guarding against overbroad rejection.

Minimal fix adds a conservative plasma-model domain gate before any calculated dose/target is emitted:

| Check | In-domain condition | Assumption |
| --- | --- | --- |
| Entered flows | Qeff <= Qp + Qpre + QPBP | Algebraically equivalent to Qeff × dilutionFactor <= native Qp; the model excludes red-cell solute transport |
| Target compensation | target × W / uptime <= Qp | Runtime clearance required to achieve the target must fit the same model; downtime compensation cannot create native solute inflow |

Both comparisons use unrounded values. Filtration fraction remains separately checked using convective ultrafiltration, excluding dialysate. Failed checks withhold `estimatedDeliveredMlKgHr`, `prescribedEffluentMlKgHr` and `totalEffluentMlHr`, force `checklistComplete=false`, and return an explainable saturation/model-domain error directing low-Qb, unit-entry, Hct, pre/PBP and measured-clearance review. The delivered-dose decision also becomes warning with that missing-data explanation.

This is an explicitly documented app-local outer model ceiling, **not** a universal effluent/plasma limit or proof that complete saturation occurs at/below the ceiling. The native-Qp boundary can be conservative for solutes with red-cell transport, which this simplified plasma model does not represent. The source registry's `APP_CRRT_PRESCRIPTION_V1` notes document this scope; no new external guideline threshold or clinical validation is claimed.

Literal boundaries: Qb50 gives Qp2100 mL/h. CVVHD Qd2000 or2100 remains in domain;2101 is rejected. W84/target25/uptime0.8 requires2625 mL/h, so compensation is rejected even when entered Qd2000 is within domain. CVVHDF Qd2100/pre200 gives effluent2300, correctly **above native plasma2100** but dilution-corrected clearance2100; the valid boundary estimate25 remains available. No blanket `all effluent <= native plasma` rule was added.

### Verification and self-review

- Focused: `npm test -- tests/clinical/prescription.test.ts --run` — **87 passed**, exit0.
- Full: `npm test -- --run` — **388 passed / 10 files**, exit0.
- Test typecheck: same direct `tsc --ignoreConfig ... tests/clinical/*.test.ts tests/data/*.test.ts` command documented above — exit0.
- `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check` — all exit0.
- Existing npm environment, jsdom performance and bundler deprecation warnings unchanged; no test failures omitted.
- Changes: prescription module, its tests, local evidence notes and this report. Commit title: `fix: reject unsupported CRRT clearance estimates`.
- Remaining concern: the gate rejects impossible/out-of-domain arithmetic but does not validate actual saturation, membrane performance or clinical adequacy; measured delivery and clinical governance remain necessary.
