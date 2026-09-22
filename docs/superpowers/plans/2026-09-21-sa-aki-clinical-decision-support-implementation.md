# SA-AKI Clinical Decision Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy an offline-capable adult SA-AKI clinical decision support PWA covering diagnosis, fluid stewardship, KRT/CRRT timing and modality, ECMO, hemoadsorption, CRRT prescription, liberation, prognosis, and longitudinal case tracking.

**Architecture:** A React + TypeScript + Vite single-page PWA separates pure clinical rules from browser persistence and presentation. Rule modules consume validated snapshots and return a common explainable `DecisionResult`; React renders those results without duplicating thresholds, while IndexedDB stores anonymous cases locally.

**Tech Stack:** Node.js 22 LTS, npm, React 19, TypeScript, Vite, vite-plugin-pwa, Zod, Dexie, Recharts, Lucide React, Vitest, Testing Library, Playwright, ESLint, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-21-sa-aki-clinical-decision-support-design.md`

## Global Constraints

- Adult clinician-only application; pediatric and pregnancy use must be visibly excluded.
- Include adult ECMO pathways.
- No backend, authentication, analytics, remote database, or direct identifiers.
- Store anonymous cases only in IndexedDB; support JSON import/export and complete deletion.
- Base path must be `/SA-AKI/`; production URL is `https://yht5582-source.github.io/SA-AKI/`.
- Clinical rules are pure TypeScript functions and never embedded in React components.
- Every decision returns severity, conclusion, evidence, missing data, actions, counterfactuals, and sources.
- KDIGO 2026 content remains labeled `Public Review Draft` until a final guideline is verified.
- HA is opt-in, off by default, and can only conclude `eligible for multidisciplinary review`, never `recommended`.
- No single SCr, BUN, urine output, inflammatory marker, biomarker, or device availability may automatically trigger CRRT or HA.
- UI text must state that the tool is decision support, not an automatic order or substitute for clinical judgment.
- Use TDD for clinical engines and persistence; each task ends with a focused commit.

## Review Focus

- Missing or unreliable baseline creatinine must produce a provisional stage with lower confidence, never a normal classification; tested in Task 4.
- Conflicting fluid signals such as PLR responsiveness plus pulmonary/VExUS congestion must block an unqualified fluid bolus; tested in Task 5.
- A patient without definitive KRT indication must not receive an automatic CRRT recommendation despite oliguria, high BUN, or inflammatory markers; tested in Task 6.
- HA shortcuts must fail closed: CRP/PCT alone, missing IL-6 for cytokine HA, missing EAA for PMX, or oXiris without a CRRT indication; tested in Task 8.
- Imported case files with identifiers, invalid units, unsupported schema versions, or corrupt snapshots must be rejected without changing existing data; tested in Task 3.

---

## Planned File Structure

```text
src/
  app/App.tsx                 App shell and route-level state
  app/routes.tsx              Route definitions
  components/                 Reusable UI primitives and decision cards
  features/cases/             Case list, editor, import/export, timeline
  features/assessment/        Multi-step clinical assessment wizard
  features/dashboard/         Decision dashboard and trends
  features/ha/                Opt-in HA assessment UI
  clinical/types.ts           Shared clinical input/output contracts
  clinical/sources.ts         Evidence registry and labels
  clinical/diagnosis.ts       Sepsis/AKI/SA-AKI staging
  clinical/fluid.ts           ROSE and fluid decision rules
  clinical/krt.ts             KRT timing and emergency indications
  clinical/modality.ts        IHD/PIRRT/CRRT/ECMO selection
  clinical/prescription.ts    CRRT prescription calculations
  clinical/ha.ts              HA gates, device matching, and stop rules
  clinical/liberation.ts      CRRT trial-off evaluation
  clinical/prognosis.ts       Trajectory and MAKE outcome framing
  data/schema.ts              Zod schemas and migrations
  data/db.ts                  Dexie database
  data/caseRepository.ts      Persistence API
  utils/units.ts              Unit and weight calculations
  styles/                     Tokens and global responsive CSS
tests/
  clinical/                   Rule unit and boundary tests
  data/                       Persistence and import tests
  components/                 UI behavior tests
e2e/
  core-flow.spec.ts           Desktop workflow
  mobile-flow.spec.ts         Mobile workflow
  offline.spec.ts             PWA/offline behavior
.github/workflows/
  ci.yml                      Typecheck, lint, unit, build, e2e
  deploy-pages.yml            Main-branch GitHub Pages deployment
```

### Task 1: Scaffold the Tested PWA and Clinical Design System

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `eslint.config.js`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/routes.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Create: `src/test/setup.ts`
- Create: `vitest.config.ts`
- Create: `public/icons/*`
- Create: `public/manifest.webmanifest`
- Modify: `README.md`

**Interfaces:**
- Produces: Vite app commands `npm run dev`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Produces: CSS variables for navy/teal clinical UI and semantic `--critical`, `--warning`, `--monitor`, `--stable` states.

- [ ] **Step 1: Generate and review the complete desktop and mobile visual concepts**

Use the frontend app builder image workflow to create one desktop command-center concept and one mobile wizard concept. Required visible copy: `SA-AKI Clinical Navigator`, `新增匿名病例`, `目前判斷`, `缺失資料`, `下一步`, `臨床決策支援，非自動醫囑`. Present both concepts to the user and stop for explicit approval before writing UI code. Record only the approved concept paths and the approval decision in `docs/design/visual-reference.md`.

- [ ] **Step 2: Scaffold React TypeScript and install pinned dependencies**

Run:

```bash
npm create vite@latest . -- --template react-ts
npm install react-router-dom zod dexie dexie-react-hooks recharts lucide-react
npm install -D vite-plugin-pwa vitest jsdom fake-indexeddb @testing-library/react @testing-library/jest-dom @testing-library/user-event eslint @eslint/js typescript-eslint playwright @playwright/test
```

Preserve `docs/`, `LICENSE`, and git history when scaffolding into the non-empty repository.

- [ ] **Step 3: Write the failing app-shell test**

Create `src/app/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

it('renders the clinician-only safety boundary', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /SA-AKI Clinical Navigator/i })).toBeVisible();
  expect(screen.getByText(/臨床決策支援，非自動醫囑/)).toBeVisible();
  expect(screen.getByText(/成人醫護人員/)).toBeVisible();
});
```

- [ ] **Step 4: Run the test and confirm the red state**

Run: `npm test -- src/app/App.test.tsx --run`  
Expected: FAIL because `App` and safety copy are not implemented.

- [ ] **Step 5: Implement the app shell, PWA config, and design tokens**

Set `base: '/SA-AKI/'` in `vite.config.ts`. Register the PWA with `registerType: 'autoUpdate'`, a network-first strategy for navigation, and cache-first static assets. Implement the accepted desktop/mobile shell using semantic landmarks, visible focus states, and non-color severity labels.

- [ ] **Step 6: Run scaffold verification**

Run:

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

Expected: all commands exit 0 and `dist/index.html` references `/SA-AKI/` assets.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json eslint.config.js index.html src public README.md docs/design vitest.config.ts
git commit -m "feat: scaffold SA-AKI clinical PWA"
```

### Task 2: Define Clinical Contracts and Evidence Registry

**Files:**
- Create: `src/clinical/types.ts`
- Create: `src/clinical/sources.ts`
- Create: `src/utils/units.ts`
- Create: `tests/clinical/contracts.test.ts`
- Create: `tests/clinical/units.test.ts`

**Interfaces:**
- Produces: `PatientCase`, `ClinicalSnapshot`, `DecisionResult`, `EvidenceSource`, `Severity`, `WeightBasis`.
- Produces: `calculateIdealBodyWeight()`, `calculateAdjustedBodyWeight()`, `normalizeUrineOutput()`.
- Consumed by: every later clinical engine, persistence schema, and UI feature.

- [ ] **Step 1: Write failing contract and unit tests**

```ts
import { calculateAdjustedBodyWeight, normalizeUrineOutput } from '../../src/utils/units';

it('normalizes urine output by weight and observation hours', () => {
  expect(normalizeUrineOutput({ volumeMl: 180, hours: 6, weightKg: 60 })).toBeCloseTo(0.5);
});

it('uses adjusted body weight for marked obesity', () => {
  expect(calculateAdjustedBodyWeight(120, 70)).toBe(90);
});
```

Also assert that every `DecisionResult` source ID resolves in `evidenceSources` and includes `level`, `status`, `year`, and `url`.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- tests/clinical/contracts.test.ts tests/clinical/units.test.ts --run`  
Expected: FAIL with missing modules.

- [ ] **Step 3: Implement exact shared interfaces**

```ts
export type Severity = 'critical' | 'warning' | 'monitor' | 'stable';
export type SourceStatus = 'guideline' | 'draft' | 'consensus' | 'trial' | 'position' | 'local' | 'unverified';

export interface DecisionResult {
  id: string;
  severity: Severity;
  conclusion: string;
  evidence: string[];
  missingData: string[];
  actions: string[];
  reassessWithinHours?: number;
  counterfactuals: string[];
  sourceIds: string[];
}

export interface ClinicalSnapshot {
  id: string;
  caseId: string;
  hoursFromSepsisOnset: number;
  creatinineMgDl?: number;
  urineVolumeMl?: number;
  urineObservationHours?: number;
  actualWeightKg: number;
  mapMmHg?: number;
  norepinephrineEquivalentMcgKgMin?: number;
  lactateMmolL?: number;
  cumulativeFluidBalanceMl?: number;
  onEcmo: boolean;
}
```

Extend `ClinicalSnapshot` in the same file with the exact field groups from spec section 5.2: timestamp; SCr/BUN/urine and diuretic exposure; MAP/heart rate/NE-equivalent/lactate/CRT/mental status; interval input/output/net and cumulative balance/body-weight change; PLR/VTI or stroke-volume response/LV/RV/B-lines/IVC/VExUS/CVP; pH/HCO3/K/Na/iCa/Mg/phosphate/glucose and uremic manifestations; respiratory support/PF ratio/pulmonary edema/intracranial-pressure risk; SOFA components/source-control and antimicrobial timing; CRRT mode/prescribed and delivered dose/downtime/UFNET/filter life/anticoagulation/adverse events; HA biomarkers, treatment exposure, cartridge changes, processed blood volume, TDM, response, and adverse events. All laboratory and rate fields use explicit unit-bearing names, categorical values use unions, and unknown values remain `undefined` rather than receiving normal defaults.

- [ ] **Step 4: Implement the evidence registry**

Before encoding claims or thresholds, verify each citation against its primary publication, society guideline page, DOI record, or official public-review document; record the verified title, publication status, version/date, URL/DOI, and the exact decision rule it supports. Add stable IDs for `SSC_2026`, `ADQI_28`, `ADQI_30`, `KDIGO_2026_DRAFT`, `TIGRIS_2026`, `MOLNAR_2026`, `PHIND_2026`, and `IMMUNOSEP_2026`. If a supplied 2026 citation cannot be independently verified, label it `unverified`, exclude it from executable rules, and surface the discrepancy for user review. `KDIGO_2026_DRAFT.status` must equal `draft` and its visible title must contain `Public Review Draft` until a final version is verified.

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/clinical/contracts.test.ts tests/clinical/units.test.ts --run`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/clinical src/utils tests/clinical
git commit -m "feat: add clinical contracts and evidence registry"
```

### Task 3: Validate and Persist Anonymous Longitudinal Cases

**Files:**
- Create: `src/data/schema.ts`
- Create: `src/data/db.ts`
- Create: `src/data/caseRepository.ts`
- Create: `tests/data/schema.test.ts`
- Create: `tests/data/caseRepository.test.ts`

**Interfaces:**
- Consumes: `PatientCase`, `ClinicalSnapshot` from `src/clinical/types.ts`.
- Produces: `caseRepository.createCase()`, `saveSnapshot()`, `listCases()`, `getCase()`, `deleteCase()`, `clearAll()`, `exportCase()`, `importCase()`.

- [ ] **Step 1: Write failing schema safety tests**

```ts
it.each(['name', 'medicalRecordNumber', 'fullDateOfBirth', 'phone', 'address'])(
  'rejects direct identifier field %s',
  async (field) => {
    const payload = validExport();
    Object.assign(payload.case, { [field]: 'identifier' });
    await expect(importCase(payload)).rejects.toThrow(/識別資料/);
  },
);

it('rejects corrupt import without changing existing cases', async () => {
  await caseRepository.createCase(validCase());
  await expect(caseRepository.importCase({ schemaVersion: 999 })).rejects.toThrow();
  expect(await caseRepository.listCases()).toHaveLength(1);
});
```

Include tests for negative urine volume, impossible pH, invalid EAA outside 0–1, unknown units, and duplicate snapshot IDs.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- tests/data --run`  
Expected: FAIL with missing schema/repository.

- [ ] **Step 3: Implement Zod schemas and versioned import**

Use `schemaVersion: 1`. Parse into a temporary in-memory object first; scan object keys recursively against the direct-identifier denylist; write to Dexie only after the complete payload validates.

- [ ] **Step 4: Implement Dexie repository transaction boundaries**

Use tables `cases` and `snapshots`; `importCase()` writes both in one transaction and rolls back on any error. Sort snapshots by `hoursFromSepsisOnset` before returning.

- [ ] **Step 5: Run persistence tests**

Run: `npm test -- tests/data --run`  
Expected: PASS with fake IndexedDB configured in `src/test/setup.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/data tests/data src/test/setup.ts package.json package-lock.json
git commit -m "feat: persist validated anonymous cases"
```

### Task 4: Implement Sepsis, AKI, and SA-AKI Diagnosis

**Files:**
- Create: `src/clinical/diagnosis.ts`
- Create: `tests/clinical/diagnosis.test.ts`

**Interfaces:**
- Consumes: `PatientCase`, ordered `ClinicalSnapshot[]`.
- Produces: `evaluateDiagnosis(caseData, snapshots): DecisionResult[]`.
- Produces: `calculateKdigoStage(input): { stage: 0 | 1 | 2 | 3; creatinineStage: 0 | 1 | 2 | 3 | null; urineStage: 0 | 1 | 2 | 3 | null; confidence: 'high' | 'moderate' | 'low' }`.

- [ ] **Step 1: Write failing diagnosis tests**

Cover: 1.5× baseline, 2× baseline, 3× baseline, +0.3 mg/dL within 48 h, urine-output stages, dialysis stage 3, early SA-AKI ≤48 h, late 48 h–7 d, and AKI outside 7 d. Add the Review Focus test:

```ts
it('returns provisional stage and low confidence when baseline is estimated', () => {
  const result = calculateKdigoStage({
    currentCreatinineMgDl: 2.1,
    baselineCreatinineMgDl: 1.0,
    baselineSource: 'estimated',
  });
  expect(result.stage).toBe(2);
  expect(result.confidence).toBe('low');
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/clinical/diagnosis.test.ts --run`  
Expected: FAIL with missing functions.

- [ ] **Step 3: Implement staging and temporal classification**

Use the more severe of creatinine and urine-output stages. If one axis is missing, calculate the available axis and list the missing one. Never back-calculate baseline without marking `baselineSource: 'estimated'`.

- [ ] **Step 4: Run boundary tests**

Run: `npm test -- tests/clinical/diagnosis.test.ts --run`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/clinical/diagnosis.ts tests/clinical/diagnosis.test.ts
git commit -m "feat: add explainable SA-AKI diagnosis"
```

### Task 5: Implement Fluid Phase, Responsiveness, and Tolerance

**Files:**
- Create: `src/clinical/fluid.ts`
- Create: `tests/clinical/fluid.test.ts`

**Interfaces:**
- Consumes: current and previous `ClinicalSnapshot`.
- Produces: `evaluateFluid(snapshot, previous?): DecisionResult[]`.
- Produces: `classifyRosePhase(snapshot): 'resuscitation' | 'optimization' | 'stabilization' | 'evacuation'`.

- [ ] **Step 1: Write failing fluid tests**

Test PLR/VTI response, absent responsiveness, B-lines, VExUS congestion, rising pressors, positive cumulative balance, evacuation readiness, and the Review Focus conflict:

```ts
it('blocks an unqualified bolus when responsiveness and intolerance conflict', () => {
  const results = evaluateFluid(snapshot({
    plrStrokeVolumeChangePct: 15,
    lungBLinePattern: 'diffuse',
    vexusGrade: 3,
    oxygenationWorsening: true,
  }));
  expect(results.some((r) => r.conclusion.includes('不可直接追加輸液'))).toBe(true);
  expect(results.flatMap((r) => r.actions)).toContain('重新確認 shock phenotype 並考慮升壓或去充血策略');
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/clinical/fluid.test.ts --run`  
Expected: FAIL.

- [ ] **Step 3: Implement dual-axis fluid logic**

Responsiveness and tolerance are separate booleans with an `unknown` state. A positive PLR may support a small monitored challenge only when tolerance is not poor; every bolus action includes a response target and stop rule.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/clinical/fluid.test.ts --run`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/clinical/fluid.ts tests/clinical/fluid.test.ts
git commit -m "feat: add fluid stewardship engine"
```

### Task 6: Implement KRT Timing, Modality, and ECMO Selection

**Files:**
- Create: `src/clinical/krt.ts`
- Create: `src/clinical/modality.ts`
- Create: `tests/clinical/krt.test.ts`
- Create: `tests/clinical/modality.test.ts`

**Interfaces:**
- Produces: `evaluateKrtInitiation(snapshot): DecisionResult[]`.
- Produces: `selectKrtModality(snapshot): DecisionResult[]`.
- Produces: `evaluateEcmoConnection(snapshot): DecisionResult[]`.

- [ ] **Step 1: Write failing KRT tests**

Test refractory hyperkalemia, severe acidemia, pulmonary edema/hypoxemia, uremic complications, toxin/sodium-control cases, and no definitive indication. Add the Review Focus test:

```ts
it('uses deferred reassessment when no definitive indication exists', () => {
  const results = evaluateKrtInitiation(snapshot({
    creatinineMgDl: 5.2,
    bunMgDl: 118,
    urineOutputMlKgHr: 0.2,
    potassiumMmolL: 5.1,
    ph: 7.29,
    refractoryPulmonaryEdema: false,
    uremicComplication: false,
  }));
  expect(results.some((r) => r.conclusion.includes('立即 CRRT'))).toBe(false);
  expect(results.some((r) => r.actions.some((a) => a.includes('重評')))).toBe(true);
});
```

- [ ] **Step 2: Write failing modality/ECMO tests**

Cover hemodynamic instability → CRRT, stable rapid clearance → IHD option, intermediate case → PIRRT, intracranial pressure risk → CRRT, and ECMO connection risks. Assert no modality claims a survival advantage.

- [ ] **Step 3: Run and confirm failure**

Run: `npm test -- tests/clinical/krt.test.ts tests/clinical/modality.test.ts --run`  
Expected: FAIL.

- [ ] **Step 4: Implement KRT and modality engines**

Use complication-driven language: `urgent KRT evaluation`, `deferred with reassessment`, or `no current KRT indication`. ECMO output compares independent catheter and integrated circuit without selecting a connection if pressure/air-risk fields are missing.

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/clinical/krt.test.ts tests/clinical/modality.test.ts --run`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/clinical/krt.ts src/clinical/modality.ts tests/clinical/krt.test.ts tests/clinical/modality.test.ts
git commit -m "feat: add KRT timing modality and ECMO rules"
```

### Task 7: Implement CRRT Prescription Calculations

**Files:**
- Create: `src/clinical/prescription.ts`
- Create: `tests/clinical/prescription.test.ts`

**Interfaces:**
- Produces: `calculatePrescription(input): CrrtPrescription`.
- Produces: `evaluatePrescriptionSafety(input): DecisionResult[]`.
- `CrrtPrescription` includes `weightKg`, `weightBasis`, `prescribedEffluentMlKgHr`, `deliveredTargetMlKgHr`, `totalEffluentMlHr`, `filtrationFractionPct`, `ufNetMlHr`, `warnings`.

- [ ] **Step 1: Write failing prescription tests**

Test delivered 20–25 mL/kg/h target, downtime compensation, ideal/adjusted weight selection, pre/post dilution, filtration fraction, UFNET zero during escalating pressors, RCA pathway, citrate contraindication review, and Prismaflex/PrisMax editable defaults.

```ts
it('sets UFNET to zero when pressors are escalating', () => {
  const result = calculatePrescription(prescriptionInput({ pressorTrend: 'rising', requestedUfNetMlHr: 150 }));
  expect(result.ufNetMlHr).toBe(0);
  expect(result.warnings).toContain('升壓劑增加：先暫停淨脫水並重新評估灌流');
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/clinical/prescription.test.ts --run`  
Expected: FAIL.

- [ ] **Step 3: Implement prescription and safety calculations**

Keep defaults editable and label them `operational starting point`. Require confirmation of device, solution composition, weight basis, anticoagulation, and pharmacy dosing before allowing a checklist to be marked complete.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/clinical/prescription.test.ts --run`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/clinical/prescription.ts tests/clinical/prescription.test.ts
git commit -m "feat: add CRRT prescription safety engine"
```

### Task 8: Implement the Fail-Closed Hemoadsorption Engine

**Files:**
- Create: `src/clinical/ha.ts`
- Create: `tests/clinical/ha.test.ts`

**Interfaces:**
- Produces: `evaluateHaEligibility(input): DecisionResult[]`.
- Produces: `matchHaDevice(input): DecisionResult[]`.
- Produces: `evaluateHaResponse(input): DecisionResult[]`.
- `HaEligibility` can only be `'not-eligible' | 'incomplete' | 'multidisciplinary-review'`.

- [ ] **Step 1: Write failing HA shortcut tests**

```ts
it.each([
  ['CRP/PCT alone', haInput({ crpMgL: 320, pctNgMl: 45, il6PgMl: undefined })],
  ['missing EAA for PMX', haInput({ requestedDevice: 'pmx', eaa: undefined })],
  ['oXiris without CRRT indication', haInput({ requestedDevice: 'oxiris', hasCrrtIndication: false })],
])('fails closed for %s', (_name, input) => {
  const result = evaluateHaEligibility(input);
  expect(result.status).not.toBe('multidisciplinary-review');
});
```

Also test that Gram-negative culture does not replace EAA and a single IL-6 result without a worsening trajectory does not pass cytokine HA.

- [ ] **Step 2: Write failing positive and stop-rule tests**

Cover all four gates, TIGRIS-like EAA 0.60–0.89 PMX review, quantitative IL-6 with worsening vasoplegia, platelet/coagulation safety, 6–12 h nonresponse, rising NE, worsening SOFA, uncontrolled source, immune paralysis, bleeding, circuit clotting, and shock reversal reference.

- [ ] **Step 3: Run and confirm failure**

Run: `npm test -- tests/clinical/ha.test.ts --run`  
Expected: FAIL.

- [ ] **Step 4: Implement explicit four-gate logic**

```ts
export interface HaEvaluation {
  status: 'not-eligible' | 'incomplete' | 'multidisciplinary-review';
  gates: {
    clinical: boolean;
    target: boolean;
    safety: boolean;
    governance: boolean;
  };
  results: DecisionResult[];
}
```

The string `recommended` must not appear in HA conclusions. `matchHaDevice()` may return PMX, broad cytokine adsorber, or oXiris as a phenotype match, but must include SSC/ADQI uncertainty and device-specific limitations.

- [ ] **Step 5: Implement drug and time-limited trial outputs**

Always preserve full loading dose. Return AUC/TDM prompts for vancomycin, TDM prompts for linezolid/azoles/beta-lactams when available, and timestamps for drug, HA start, and cartridge changes. Do not calculate fixed supplemental antibiotic doses.

- [ ] **Step 6: Run HA tests**

Run: `npm test -- tests/clinical/ha.test.ts --run`  
Expected: PASS, including every Review Focus shortcut.

- [ ] **Step 7: Commit**

```bash
git add src/clinical/ha.ts tests/clinical/ha.test.ts
git commit -m "feat: add gated hemoadsorption decision support"
```

### Task 9: Implement CRRT Liberation and Prognosis

**Files:**
- Create: `src/clinical/liberation.ts`
- Create: `src/clinical/prognosis.ts`
- Create: `tests/clinical/liberation.test.ts`
- Create: `tests/clinical/prognosis.test.ts`

**Interfaces:**
- Produces: `evaluateLiberation(snapshot, trend): DecisionResult[]`.
- Produces: `classifyAkiTrajectory(snapshots): 'improving' | 'persistent' | 'relapsing' | 'worsening' | 'insufficient-data'`.
- Produces: `evaluatePrognosis(caseData, snapshots): DecisionResult[]`.

- [ ] **Step 1: Write failing liberation tests**

Test resolved indication, stable hemodynamics, spontaneous versus diuretic-associated urine output, short creatinine clearance, metabolic control, high input needs, trial-off timing, and restart triggers. Assert no single urine or clearance value automatically stops CRRT.

- [ ] **Step 2: Write failing prognosis tests**

Test improving, persistent, relapsing, and worsening trajectories; CKD, shock duration, fluid overload, multiorgan failure, nephrotoxin exposure, and MAKE30/90 component explanations. Biomarkers must never output an individual recovery percentage.

- [ ] **Step 3: Run and confirm failure**

Run: `npm test -- tests/clinical/liberation.test.ts tests/clinical/prognosis.test.ts --run`  
Expected: FAIL.

- [ ] **Step 4: Implement liberation and trajectory engines**

Return `consider supervised trial-off`, `continue and reassess`, or `restart trigger met`; never return an automatic device command. Prognosis reports factors and trajectory only, with an explicit uncertainty sentence.

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/clinical/liberation.test.ts tests/clinical/prognosis.test.ts --run`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/clinical/liberation.ts src/clinical/prognosis.ts tests/clinical/liberation.test.ts tests/clinical/prognosis.test.ts
git commit -m "feat: add CRRT liberation and prognosis rules"
```

### Task 10: Build Case Management and Assessment Wizard

**Files:**
- Create: `src/features/cases/CaseListPage.tsx`
- Create: `src/features/cases/CaseForm.tsx`
- Create: `src/features/cases/ImportExportPanel.tsx`
- Create: `src/features/assessment/AssessmentWizard.tsx`
- Create: `src/features/assessment/steps/*.tsx`
- Create: `src/components/FormField.tsx`
- Create: `src/components/Stepper.tsx`
- Create: `tests/components/case-flow.test.tsx`
- Create: `tests/components/assessment-wizard.test.tsx`
- Modify: `src/app/routes.tsx`

**Interfaces:**
- Consumes: `caseRepository` and all schema types.
- Produces: routes `/`, `/case/:caseId/assessment/:snapshotId?`.
- Produces: a validated `ClinicalSnapshot` saved only after review confirmation.

- [ ] **Step 1: Write failing case-flow tests**

Test anonymous case creation, absence of identifier fields, local save/reopen, JSON export, invalid import rejection, one-case delete, and clear-all confirmation.

- [ ] **Step 2: Write failing wizard tests**

Test step order: infection/shock → AKI → perfusion/fluid → KRT → modality/ECMO → prescription → optional HA → monitoring/liberation. Assert HA remains hidden until explicitly enabled and cannot be completed with failed gates.

- [ ] **Step 3: Run and confirm failure**

Run: `npm test -- tests/components/case-flow.test.tsx tests/components/assessment-wizard.test.tsx --run`  
Expected: FAIL.

- [ ] **Step 4: Implement accessible forms and progressive disclosure**

Every numeric field includes unit, acceptable range, and error text. Preserve entered values across steps. Add a final review screen showing missing critical fields before persistence.

- [ ] **Step 5: Run component tests**

Run: `npm test -- tests/components/case-flow.test.tsx tests/components/assessment-wizard.test.tsx --run`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/cases src/features/assessment src/components tests/components src/app
git commit -m "feat: add anonymous case assessment workflow"
```

### Task 11: Build Decision Dashboard, HA Workspace, Trends, and Handoff

**Files:**
- Create: `src/features/dashboard/DecisionDashboard.tsx`
- Create: `src/features/dashboard/TrendCharts.tsx`
- Create: `src/features/dashboard/HandoffSummary.tsx`
- Create: `src/features/ha/HaWorkspace.tsx`
- Create: `src/components/DecisionCard.tsx`
- Create: `src/components/EvidenceBadge.tsx`
- Create: `tests/components/dashboard.test.tsx`
- Create: `tests/components/ha-workspace.test.tsx`
- Modify: `src/app/routes.tsx`

**Interfaces:**
- Consumes: all `DecisionResult[]` and ordered snapshots.
- Produces: `/case/:caseId` dashboard and `/case/:caseId/ha` workspace.
- Produces: copyable handoff summary; no executable orders.

- [ ] **Step 1: Write failing dashboard tests**

Assert cards show conclusion, evidence, missing data, next action, reassessment time, counterfactuals, and source badges. Test 0–72 h trends for SCr, urine output, lactate, NE-equivalent, balance, weight, SOFA, and delivered dose.

- [ ] **Step 2: Write failing HA workspace tests**

Assert the SSC/ADQI warning appears before inputs, all four gates are visible, EAA and IL-6 requirements are device-specific, and the strongest successful label is `可送多專科審查`.

- [ ] **Step 3: Run and confirm failure**

Run: `npm test -- tests/components/dashboard.test.tsx tests/components/ha-workspace.test.tsx --run`  
Expected: FAIL.

- [ ] **Step 4: Implement dashboard and HA workspace**

Render critical first, then warning, monitor, stable. Use icon + text + color for status. Add a trend toggle between absolute value and change from baseline. Handoff copy includes timestamp, AKI stage, fluid phase, KRT status, modality, active safety issues, HA status if assessed, and next reassessment.

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/components/dashboard.test.tsx tests/components/ha-workspace.test.tsx --run`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/dashboard src/features/ha src/components tests/components src/app
git commit -m "feat: add longitudinal decision dashboard"
```

### Task 12: Add Evidence, Governance, Accessibility, and Offline Pages

**Files:**
- Create: `src/features/governance/EvidencePage.tsx`
- Create: `src/features/governance/PrivacyPage.tsx`
- Create: `src/features/governance/AboutPage.tsx`
- Create: `src/features/governance/ChangelogPage.tsx`
- Create: `CHANGELOG.md`
- Create: `tests/components/governance.test.tsx`
- Modify: `src/app/routes.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `evidenceSources`.
- Produces: routes `/evidence`, `/privacy`, `/about`, `/changelog`.

- [ ] **Step 1: Write failing governance tests**

Assert every source is visible with title, status, year, link, and scope; KDIGO draft is visibly marked; privacy page states local-only storage; and adult-only exclusion plus emergency disclaimer are present.

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/components/governance.test.tsx --run`  
Expected: FAIL.

- [ ] **Step 3: Implement pages and update documentation**

README includes purpose, non-device disclaimer, development commands, evidence-update process, privacy model, GitHub Pages URL, and clinical content version. `CHANGELOG.md` starts at `0.1.0` with all implemented modules listed.

- [ ] **Step 4: Run accessibility-oriented tests**

Run: `npm test -- tests/components/governance.test.tsx --run`  
Expected: PASS. Then run `npm run lint` and fix label, button-name, heading-order, and focus-state findings.

- [ ] **Step 5: Commit**

```bash
git add src/features/governance src/app/routes.tsx tests/components README.md CHANGELOG.md
git commit -m "docs: add evidence privacy and governance surfaces"
```

### Task 13: Add End-to-End Tests and GitHub Pages Delivery

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/core-flow.spec.ts`
- Create: `e2e/mobile-flow.spec.ts`
- Create: `e2e/offline.spec.ts`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy-pages.yml`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run test:e2e`, `npm run verify`, GitHub Pages artifact and deployment.

- [ ] **Step 1: Write the desktop end-to-end flow**

The test creates anonymous case `DEMO-001`, enters septic shock and AKI data, saves two timepoints, verifies KDIGO/SA-AKI output, opens fluid/KRT decisions, confirms HA is opt-in, exports JSON, and confirms the handoff summary contains no direct identifiers.

- [ ] **Step 2: Write the mobile and offline flows**

Mobile viewport `390×844` completes the wizard without horizontal overflow. Offline test loads once online, switches context offline, reloads `/SA-AKI/`, and verifies the existing case and evidence pages render.

- [ ] **Step 3: Run e2e tests and confirm initial failures**

Run: `npm run build && npm run test:e2e`  
Expected: FAIL until preview server, base path, and PWA configuration are aligned.

- [ ] **Step 4: Complete Playwright and workflow configuration**

Use `webServer.command: 'npm run preview -- --host 127.0.0.1'`, `baseURL: 'http://127.0.0.1:4173/SA-AKI/'`, desktop Chromium and mobile Chrome projects. CI runs Node 22 with `npm ci` and uploads Playwright artifacts only on failure.

- [ ] **Step 5: Configure GitHub Pages deployment**

`deploy-pages.yml` triggers on pushes to `main` and contains a `verify` job followed by a `deploy` job with `needs: verify`. The verify job runs the same typecheck, lint, unit, build, and Playwright gates before uploading `dist` with `actions/upload-pages-artifact`; only then may `actions/deploy-pages` run. Grant only `contents: read`, `pages: write`, and `id-token: write`. Keep `ci.yml` for pull requests and main-branch diagnostics; do not pass build artifacts between independent workflows.

- [ ] **Step 6: Run the full verification gate**

Run:

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm run test:e2e
```

Expected: all commands exit 0, unit output reports 0 failed tests, Playwright reports all projects passed, and `dist/manifest.webmanifest` exists.

- [ ] **Step 7: Perform visual fidelity verification**

Start preview, capture desktop at the accepted concept width and mobile at `390×844`, inspect both with `view_image`, and create a fidelity ledger covering copy, layout, typography, palette, spacing, status semantics, responsive behavior, and core interactions. Fix every material mismatch before continuing.

- [ ] **Step 8: Commit**

```bash
git add playwright.config.ts e2e .github/workflows package.json package-lock.json
git commit -m "ci: test and deploy SA-AKI navigator"
```

### Task 14: Push, Enable Pages, and Verify Production

**Files:**
- Modify only if production verification reveals a defect.

**Interfaces:**
- Produces: public URL `https://yht5582-source.github.io/SA-AKI/`.

- [ ] **Step 1: Verify branch state before push**

Run:

```bash
git status --short
git log --oneline --decorate -15
git diff origin/main...HEAD --check
```

Expected: clean working tree; only reviewed commits; no whitespace errors.

- [ ] **Step 2: Push main**

Run: `git push origin main`  
Expected: push succeeds without force.

- [ ] **Step 3: Confirm GitHub Actions and Pages settings**

Use GitHub repository settings or API to verify Pages source is GitHub Actions and both CI and deployment workflows complete successfully. Do not weaken branch protections or bypass failed checks.

- [ ] **Step 4: Verify the production application**

Test the flow: production URL loads → create anonymous case → enter two snapshots → decision dashboard updates → HA remains opt-in and fails closed without target biomarkers → reload persists the case → evidence page loads.

Check page title, meaningful DOM, no framework overlay, console errors/warnings, desktop screenshot, mobile screenshot, and at least one state-changing interaction.

- [ ] **Step 5: Apply a production-only fix if required**

If base-path, service-worker, or Pages routing is broken, write a focused regression test, reproduce failure, patch the smallest relevant file, rerun the full verification gate, commit, and push normally.

- [ ] **Step 6: Record release**

Create GitHub release `v0.1.0` only after production verification, with notes covering adult-only scope, local-only storage, clinical modules, HA limitations, evidence version, and known exclusions.
