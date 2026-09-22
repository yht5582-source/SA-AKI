import { evaluateKrtInitiation } from './krt';
import { resolveRuleSources } from './sources';
import type { ClinicalSnapshot, DecisionResult, HemoadsorptionAssessment, HemoadsorptionExposure } from './types';

export type HaEligibility = 'not-eligible' | 'incomplete' | 'multidisciplinary-review';
export interface HaInput { snapshot: ClinicalSnapshot; previousSnapshot?: ClinicalSnapshot }
export interface HaResponseInput { baseline: HaInput; snapshot: ClinicalSnapshot }
export interface HaEvaluation {
  status: HaEligibility;
  gates: { clinical: boolean; target: boolean; safety: boolean; governance: boolean };
  results: DecisionResult[];
}

type Gate = { missing: string[]; failed: string[] };
const newGate = (): Gate => ({ missing: [], failed: [] });
const passed = (gate: Gate) => gate.missing.length === 0 && gate.failed.length === 0;
const finite = (value: number | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const time = (value: string | undefined) => value && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) ? Date.parse(value) : NaN;
const validSofa = (s: ClinicalSnapshot) => finite(s.sofaScore) && Number.isInteger(s.sofaScore) && s.sofaScore <= 24;

function requireFlag(gate: Gate, value: boolean | undefined, expected: boolean, label: string): void {
  if (value === expected) return;
  if (typeof value !== 'boolean') gate.missing.push(label);
  else gate.failed.push(label);
}

function checked(result: DecisionResult): DecisionResult {
  resolveRuleSources(result.id, result.sourceIds);
  return result;
}

function local(id: string, conclusion: string, patch: Partial<DecisionResult> = {}): DecisionResult {
  return checked({ id, severity: 'warning', conclusion, evidence: [], missingData: [], actions: [],
    counterfactuals: [], sourceIds: ['APP_HA_REVIEW_V1'], ...patch });
}

function cautions(a: HemoadsorptionAssessment): DecisionResult[] {
  const results = [checked({
    id: 'ha-not-routine', severity: 'warning', conclusion: 'SSC 2026: conditional against routine blood purification in adult sepsis/septic shock',
    evidence: ['Very low certainty; routine-use pathway is closed.'], missingData: [],
    actions: ['優先標準敗血症照護；任何例外僅限明確治理的多專科審查。'],
    counterfactuals: ['Biomarker elevation or device availability does not change this warning.'], sourceIds: ['SSC_2026'],
  }), checked({
    id: 'ha-experimental-evidence', severity: 'warning', conclusion: 'ADQI 30: modern HA remains experimental',
    evidence: ['Target removal is not proof of clinical benefit; device and phenotype evidence cannot be interchanged.'], missingData: [],
    actions: ['審查研究／登錄及裝置特定限制。'], counterfactuals: ['Clinical improvement does not establish HA-attributed benefit.'], sourceIds: ['ADQI_30'],
  })];
  if (a.requestedDevice === 'polymyxin-B') results.push(checked({
    id: 'pmx-not-routine', severity: 'warning', conclusion: 'SSC 2026: conditional against routine polymyxin B hemoperfusion',
    evidence: ['Low certainty; an exploratory enrichment subgroup does not overturn this position.'],
    missingData: [], actions: ['PMX 僅供裝置特定多專科／研究審查。'], counterfactuals: [], sourceIds: ['SSC_2026'],
  }));
  else results.push(checked({
    id: 'ha-expert-phenotype-review', severity: 'warning', conclusion: 'Molnar 2026 is position-level phenotype discussion only',
    evidence: ['Not validated eligibility, dose, timing or class-wide efficacy guidance.'], missingData: [], actions: [],
    counterfactuals: ['A single inflammatory marker cannot establish a treatable phenotype.'], sourceIds: ['MOLNAR_2026'],
  }));
  return results;
}

/** Factual medication monitoring only; does not establish HA eligibility or continuation. */
export function evaluateHaDrugExposure(s: ClinicalSnapshot, exposure?: HemoadsorptionExposure): DecisionResult {
  const administrations = [...s.antimicrobials ?? [], ...exposure?.drugExposures ?? []];
  return local('ha-drug-exposure-review', 'Pharmacist-led, device-specific drug exposure review', {
    evidence: [
      `HA initiation timestamp: ${exposure?.startedTimestamp ?? 'not recorded'}`,
      `Cartridge timestamps: ${exposure?.cartridgeChangeTimestamps?.join(', ') || 'none recorded; verify log'}`,
      ...administrations.map(drug => `Drug ${drug.drugName}; administration timestamp: ${drug.administeredTimestamp}`),
      ...exposure?.therapeuticDrugMonitoring?.map(sample => `TDM ${sample.drugName}; sample timestamp: ${sample.sampledTimestamp}`) ?? [],
    ],
    actions: [
      'Preserve the full loading dose without delay or reduction; reconcile the existing antimicrobial plan with pharmacy.',
      'vancomycin: AUC / TDM review; linezolid, azole and beta-lactam: TDM review when available; beta-lactam extended-infusion review as appropriate.',
      'Individualize exposure review using infection source, MIC, volume of distribution, residual renal function, CRRT delivery and device-specific removal; no automatic supplemental doses.',
      'Record medication administration, HA initiation, each cartridge change and TDM sampling times; re-evaluate exposure after circuit changes.',
    ],
    counterfactuals: ['Drug underexposure or unacceptable albumin loss requires immediate bedside stop review.'],
  });
}

const coreMetrics = [
  ['norepinephrineEquivalentMcgKgMin', 'NE-equivalent'], ['lactateMmolL', 'lactate'],
  ['capillaryRefillSeconds', 'perfusion / CRT'], ['mapMmHg', 'MAP'],
] as const;

/** Four independent gates; unknowns never become normal values or approvals. */
export function evaluateHaEligibility({ snapshot: s, previousSnapshot: p }: HaInput): HaEvaluation {
  const a = s.hemoadsorptionAssessment;
  if (a?.optedIn !== true) return { status: 'not-eligible', gates: { clinical: false, target: false, safety: false, governance: false }, results: [] };
  const clinical = newGate(), target = newGate(), safety = newGate(), governance = newGate();

  for (const field of ['adultConfirmed', 'septicShockConfirmed', 'reversibleTrait'] as const) requireFlag(clinical, a[field], true, field);
  for (const field of ['antimicrobials', 'sourceControl', 'fluids', 'vasopressors', 'corticosteroids'] as const) {
    requireFlag(clinical, a.standardCare?.[field], true, `Completed standard care assessment: ${field}`);
  }
  if (!s.sourceControlStatus) clinical.missing.push('Source-control status and plan');
  else if (s.sourceControlStatus === 'inadequate') clinical.failed.push('Source-control plan inadequate');
  if (!Number.isFinite(time(s.firstAntimicrobialTimestamp)) || time(s.firstAntimicrobialTimestamp) > time(s.timestamp)) clinical.missing.push('Appropriate antimicrobial administration timestamp');
  for (const [field, label] of coreMetrics) if (!finite(s[field])) clinical.missing.push(`Baseline ${label}`);
  if (!validSofa(s)) clinical.missing.push('Baseline SOFA');
  if (!finite(s.urineVolumeMl) || !finite(s.urineObservationHours) || s.urineObservationHours === 0) clinical.missing.push('Baseline timed urine output');

  const serial = p !== undefined && p.caseId === s.caseId && time(p.timestamp) < time(s.timestamp);
  if (!serial) clinical.missing.push('Chronological same-case baseline and prior observations');
  const trajectoryKnown = serial && finite(p.norepinephrineEquivalentMcgKgMin) && finite(p.lactateMmolL) && validSofa(p)
    && finite(s.norepinephrineEquivalentMcgKgMin) && finite(s.lactateMmolL) && validSofa(s);
  if (!trajectoryKnown) clinical.missing.push('Serial quantitative NE-equivalent, lactate and SOFA');
  if (!a.shockTrajectory) clinical.missing.push('Persistent/worsening shock after standard care');
  else if (a.shockTrajectory === 'resolving') clinical.failed.push('Resolving shock does not pass the clinical gate');
  if (trajectoryKnown) {
    const rising = s.norepinephrineEquivalentMcgKgMin! > p.norepinephrineEquivalentMcgKgMin!
      || s.lactateMmolL! > p.lactateMmolL! || s.sofaScore! > p.sofaScore!;
    const persistent = s.norepinephrineEquivalentMcgKgMin! >= p.norepinephrineEquivalentMcgKgMin!
      && s.lactateMmolL! >= p.lactateMmolL! && s.sofaScore! >= p.sofaScore!;
    if (s.norepinephrineEquivalentMcgKgMin === 0 || (!rising && !(a.shockTrajectory === 'persistent' && persistent))) {
      clinical.failed.push('Measured shock trajectory conflicts with persistent/worsening assessment');
    }
  }

  const device = a.requestedDevice, adsorbate = a.targetAdsorbate;
  const cytokines = adsorbate === 'cytokines' || adsorbate === 'cytokines-and-endotoxin';
  if (!device) target.missing.push('Device-specific target match');
  else if (!['CytoSorb', 'HA330', 'HA380', 'polymyxin-B', 'oXiris'].includes(device)) target.failed.push('Unsupported device');
  if (!adsorbate) target.missing.push('Target adsorbate');
  else if (adsorbate === 'other') target.failed.push('Unsupported target adsorbate');
  if ((device === 'polymyxin-B' && adsorbate !== undefined && adsorbate !== 'endotoxin')
    || (['CytoSorb', 'HA330', 'HA380'].includes(device ?? '') && adsorbate !== undefined && adsorbate !== 'cytokines')) target.failed.push('Device and adsorbate mismatch');
  if (a.targetStillPresent === false) target.failed.push('Target no longer present');

  if (['CytoSorb', 'HA330', 'HA380', 'oXiris'].includes(device ?? '')) {
    requireFlag(target, a.immunoparalysis, false, 'Immunoparalysis assessment: broad adsorption veto');
    requireFlag(target, a.lowHlaDr, false, 'Low HLA-DR assessment: broad adsorption veto');
  }
  if (cytokines) {
    requireFlag(target, a.hyperinflammatoryPhenotype, true, 'Compatible dynamic hyperinflammatory phenotype');
    if (!finite(s.il6PgMl) || !serial || !finite(p.il6PgMl)) target.missing.push('Quantitative serial IL-6; CRP/PCT/ferritin cannot substitute');
    else if (s.il6PgMl === 0 || s.il6PgMl < p.il6PgMl) target.failed.push('Serial IL-6 is not compatible with the declared persistent/rising hyperinflammatory trajectory');
  }
  if (device === 'polymyxin-B') {
    if (!finite(s.endotoxinActivityAssay) || s.endotoxinActivityAssay > 1) target.missing.push('Valid EAA; Gram-negative suspicion/culture cannot substitute');
    else if (s.endotoxinActivityAssay < 0.6 || s.endotoxinActivityAssay > 0.89) target.failed.push('EAA outside PMX exploratory 0.60–0.89 range');
    if (!finite(s.modsScore) || !Number.isInteger(s.modsScore) || s.modsScore > 24) target.missing.push('Integer MODS within 0–24 for PMX exploratory subgroup');
    else if (s.modsScore <= 9) target.failed.push('MODS outside PMX exploratory >9 subgroup');
  }
  if (device === 'oXiris') {
    // Task 6 marks a separately confirmed indication critical; a numeric danger screen is only warning.
    if (!evaluateKrtInitiation(s).some(result => result.id === 'krt-emergency-indications' && result.severity === 'critical')) {
      target.failed.push('No independent CRRT indication confirmed by the separate KRT module; adsorption cannot create one');
    }
    if (adsorbate === 'endotoxin' || adsorbate === 'cytokines-and-endotoxin') {
      requireFlag(target, a.endotoxinPhenotype, true, 'Device-specific endotoxin phenotype assessment');
      if (!finite(s.endotoxinActivityAssay) || s.endotoxinActivityAssay > 1) target.missing.push('Quantitative EAA for the declared oXiris endotoxin target');
    }
  }

  for (const field of ['plateletsAcceptable', 'coagulationAcceptable', 'albuminAcceptable', 'hepaticRenalReviewed', 'electrolytesReviewed', 'vascularAccessReviewed', 'anticoagulationReviewed', 'circuitCompatible', 'drugRemovalPlan', 'goalsCompatible'] as const) {
    requireFlag(safety, a.safety?.[field], true, `Safety assessment: ${field}`);
  }
  for (const field of ['uncontrolledBleeding', 'irreversibleOrganFailure'] as const) requireFlag(safety, a.safety?.[field], false, `Safety veto assessment: ${field}`);
  for (const field of ['platelets10e9L', 'fibrinogenGL', 'albuminGL'] as const) if (!finite(s[field]) || s[field] === 0) safety.missing.push(`Quantitative ${field} and clinician safety assessment`);

  for (const field of ['criticalCareApproved', 'nephrologyApproved', 'infectiousDiseasesApproved', 'pharmacistExposurePlan', 'monitoringPlan', 'stopPlan', 'deviceProtocolReviewed'] as const) {
    requireFlag(governance, a.governance?.[field], true, `Governance: ${field}`);
  }
  if (!['protocol', 'registry', 'research'].includes(a.governance?.setting ?? '')) governance.missing.push('Protocol / registry / research governance');
  if (!a.governance?.consent || a.governance.consent === 'pending') governance.missing.push('Applicable consent obtained or explicitly not required');
  else if (a.governance.consent === 'declined') governance.failed.push('Applicable consent declined');
  const reviewHours = a.governance?.reviewAtHours;
  if (!finite(reviewHours) || reviewHours < 6 || reviewHours > 12) governance.missing.push('Explicit 6–12 h time-limited review ceiling and stop/futility plan');

  const states = { clinical, target, safety, governance };
  const gates = { clinical: passed(clinical), target: passed(target), safety: passed(safety), governance: passed(governance) };
  const missing = Object.entries(states).flatMap(([name, gate]) => gate.missing.map(reason => `${name}: ${reason}`));
  const failed = Object.entries(states).flatMap(([name, gate]) => gate.failed.map(reason => `${name}: ${reason}`));
  const status: HaEligibility = failed.length ? 'not-eligible' : missing.length ? 'incomplete' : 'multidisciplinary-review';
  const results = [...cautions(a), local('ha-gated-review', status === 'multidisciplinary-review' ? 'eligible for multidisciplinary review' : `${status}: HA review gates not cleared`, {
    evidence: [
      ...Object.entries(gates).map(([name, pass]) => `${name} gate: ${pass ? 'passed' : 'not cleared'}`), ...failed,
      'App-local conservative review prerequisites, not a validated eligibility score or treatment indication.',
      `NE-equivalent ${s.norepinephrineEquivalentMcgKgMin ?? 'unknown'}; lactate ${s.lactateMmolL ?? 'unknown'}; SOFA ${s.sofaScore ?? 'unknown'}; quantitative IL-6 ${s.il6PgMl ?? 'unknown'}; EAA ${s.endotoxinActivityAssay ?? 'unknown'}.`,
    ], missingData: missing,
    actions: ['Review the unmet assessments with the bedside multidisciplinary team; preserve standard septic-shock management.'],
    counterfactuals: ['Any missing or failed gate withholds the review label; CRP, PCT, ferritin, AKI or device availability alone cannot pass a gate.'],
  })];
  if (device === 'polymyxin-B') results.push(checked({
    id: 'pmx-exploratory-enrichment', severity: 'warning', conclusion: 'PMX post-hoc exploratory enrichment boundary only',
    evidence: ['EUPHRATES exploratory post-hoc/per-protocol subgroup: EAA 0.60–0.89 and MODS >9; parent trial was neutral. No efficacy inference or cross-device extrapolation.'],
    missingData: [...target.missing], actions: ['TIGRIS remains unverified and cannot enable executable claims.'], counterfactuals: [], sourceIds: ['EUPHRATES_POSTHOC_2018'],
  }));
  results.push(evaluateHaDrugExposure(s));
  if (status === 'multidisciplinary-review') results.push(local('ha-time-limited-review', 'Conditional time-limited multidisciplinary review plan', {
    evidence: ['Right patient: standard-care-refractory reversible trait; Right device: measured target; Right time: after essential care and source-control assessment; Right dose: device IFU / research protocol; Right stop: predefined futility and harm vetoes.'],
    actions: [
      'If separately authorized by the clinical team: 0 h baseline and serial NE-equivalent, MAP, lactate, perfusion / CRT, timed urine, SOFA, IL-6/EAA, platelets, albumin and antimicrobial timestamps.',
      '2–4 h review: hemodynamics, circuit, bleeding, anticoagulation, electrolytes and drug exposure; any deterioration needs immediate bedside assessment.',
      `6–12 h time-limited review; recorded ceiling ${reviewHours} h. Predefine stop / futility review for absent NE, lactate, perfusion, SOFA or target improvement; uncontrolled source or worsening organ failure.`,
      'Immediate stop review for severe thrombocytopenia, bleeding, recurrent circuit clotting, drug underexposure, unacceptable albumin loss, immunoparalysis, irreversible failure or changed goals.',
    ], reassessWithinHours: 2,
    counterfactuals: ['No automatic continuation, cartridge schedule or processed-blood-volume target; reassessment may revoke every gate.'],
  }));
  return { status, gates, results };
}

/** Trait match is conditional on all gates, never device selection by availability. */
export function matchHaDevice(input: HaInput): DecisionResult[] {
  const evaluation = evaluateHaEligibility(input);
  if (evaluation.status !== 'multidisciplinary-review') return evaluation.results;
  const a = input.snapshot.hemoadsorptionAssessment!;
  if (a.requestedDevice === 'polymyxin-B') return evaluation.results.map(result => result.id === 'pmx-exploratory-enrichment'
    ? { ...result, conclusion: 'polymyxin-B phenotype match for multidisciplinary review only' } : result);
  return [...evaluation.results, local('ha-device-match', `${a.requestedDevice} phenotype match for multidisciplinary review only`, {
    evidence: [
      `${a.requestedDevice}: target ${a.targetAdsorbate}; device-specific IFU/protocol and exposure review remain necessary.`,
      a.requestedDevice === 'oXiris' ? 'Independent CRRT indication separately confirmed; adsorptive membrane review is not a KRT indication.' : 'Quantitative serial IL-6 and compatible assessed hyperinflammation; no universal IL-6 cutoff.',
      'CytoSorb, Jafron HA330/HA380 and oXiris are not interchangeable evidence classes; endotoxin-specific trial evidence does not transfer.',
    ], actions: ['Reconcile the exact device, target and local research/protocol permissions with the multidisciplinary team.'],
    counterfactuals: ['A lost target, safety veto or missing gate removes the phenotype match.'],
  })];
}

/** Re-evaluates an existing documented exposure; cannot authorize therapy. */
export function evaluateHaResponse({ baseline, snapshot: s }: HaResponseInput): DecisionResult[] {
  const b = baseline.snapshot, a = s.hemoadsorptionAssessment;
  if (b.hemoadsorptionAssessment?.optedIn !== true || a?.optedIn !== true) return [];
  const eligibility = evaluateHaEligibility(baseline);
  const exposures = s.hemoadsorptionExposures?.filter(e => !e.stoppedTimestamp) ?? [];
  const exposure = exposures.length === 1 ? exposures[0] : undefined;
  const missing: string[] = [], stop: string[] = [];
  const elapsed = exposure ? (time(s.timestamp) - time(exposure.startedTimestamp)) / 3_600_000 : NaN;
  const chronology = s.caseId === b.caseId && time(s.timestamp) > time(b.timestamp)
    && exposure !== undefined && time(exposure.startedTimestamp) === time(b.timestamp) && Number.isFinite(elapsed) && elapsed >= 0;
  if (!chronology) missing.push('Same-case chronological 0 h baseline and exactly one documented active exposure');
  if (exposure && (exposure.device !== b.hemoadsorptionAssessment?.requestedDevice || exposure.targetAdsorbate !== b.hemoadsorptionAssessment?.targetAdsorbate)) missing.push('Exposure device / target conflicts with the reviewed baseline');
  if (a.requestedDevice !== b.hemoadsorptionAssessment?.requestedDevice || a.targetAdsorbate !== b.hemoadsorptionAssessment?.targetAdsorbate) missing.push('Current device / target needs separate gate review');
  for (const active of exposures) {
    const compatible = active.device === 'polymyxin-B' ? active.targetAdsorbate === 'endotoxin'
      : active.device === 'oXiris' ? ['cytokines', 'endotoxin', 'cytokines-and-endotoxin'].includes(active.targetAdsorbate ?? '')
        : ['CytoSorb', 'HA330', 'HA380'].includes(active.device) && active.targetAdsorbate === 'cytokines';
    if (!compatible || active.device !== a.requestedDevice || active.targetAdsorbate !== a.targetAdsorbate) {
      missing.push('Active exposure device / target is incompatible with the current assessment');
    }
  }
  if (eligibility.status !== 'multidisciplinary-review') missing.push('Original HA gates not cleared; no trial interpretation');
  for (const [field, label] of coreMetrics) if (!finite(s[field])) missing.push(`Serial ${label}`);
  if (!validSofa(s)) missing.push('Serial SOFA');
  for (const field of ['platelets10e9L', 'fibrinogenGL', 'albuminGL'] as const) if (!finite(s[field]) || s[field] === 0) missing.push(`Serial ${field}`);
  if (!finite(s.urineVolumeMl) || !finite(s.urineObservationHours) || s.urineObservationHours === 0) missing.push('Serial timed urine output');
  const target = b.hemoadsorptionAssessment?.targetAdsorbate;
  const targetMetrics = target === 'cytokines' ? ['il6PgMl'] as const
    : target === 'endotoxin' ? ['endotoxinActivityAssay'] as const : ['il6PgMl', 'endotoxinActivityAssay'] as const;
  for (const field of targetMetrics) if (!finite(s[field]) || !finite(b[field]) || (field === 'endotoxinActivityAssay' && s[field]! > 1)) missing.push(`Serial target ${field}`);
  // Current phenotype confirmation is distinct from the pre-exposure rising-marker gate.
  // Falling biomarkers can reflect response; they do not prove the target still exists.
  const currentTargets = [a.targetAdsorbate, ...exposures.map(active => active.targetAdsorbate)];
  const targetConfirmations: ('targetStillPresent' | 'hyperinflammatoryPhenotype' | 'endotoxinPhenotype')[] = ['targetStillPresent'];
  if (currentTargets.some(value => value === 'cytokines' || value === 'cytokines-and-endotoxin')) targetConfirmations.push('hyperinflammatoryPhenotype');
  if (currentTargets.some(value => value === 'endotoxin' || value === 'cytokines-and-endotoxin')) targetConfirmations.push('endotoxinPhenotype');
  for (const field of targetConfirmations) {
    if (a[field] === false) stop.push(`Current target / phenotype lost: ${field}`);
    else if (a[field] !== true) missing.push(`Current target / phenotype confirmation: ${field}`);
  }

  const events = exposure?.adverseEvents ?? [];
  for (const event of events) {
    if (!chronology || time(event.timestamp) < time(exposure?.startedTimestamp) || time(event.timestamp) > time(s.timestamp) || !Number.isFinite(time(event.timestamp))) missing.push('Adverse-event timestamp outside documented exposure');
    else if (event.severity === 'severe' || event.kind === 'bleeding') stop.push(`Adverse event: ${event.kind}`);
  }
  if (events.filter(e => e.kind === 'circuit-clotting' && time(e.timestamp) >= time(exposure?.startedTimestamp) && time(e.timestamp) <= time(s.timestamp)).length >= 2) stop.push('Recurrent circuit clotting');
  if (a.immunoparalysis === true || a.lowHlaDr === true) stop.push('Immunoparalysis / low HLA-DR veto review');
  if (['CytoSorb', 'HA330', 'HA380', 'oXiris'].includes(b.hemoadsorptionAssessment?.requestedDevice ?? '')) {
    for (const field of ['immunoparalysis', 'lowHlaDr'] as const) if (a[field] === undefined) missing.push(`Current broad-device immune reassessment: ${field}`);
  }
  for (const field of ['uncontrolledBleeding', 'irreversibleOrganFailure'] as const) {
    if (a.safety?.[field] === true) stop.push(`Current safety veto: ${field}`);
    else if (a.safety?.[field] !== false) missing.push(`Current negative veto assessment: ${field}`);
  }
  for (const field of ['goalsCompatible', 'plateletsAcceptable', 'coagulationAcceptable', 'albuminAcceptable', 'drugRemovalPlan', 'circuitCompatible', 'hepaticRenalReviewed', 'electrolytesReviewed', 'vascularAccessReviewed', 'anticoagulationReviewed'] as const) {
    if (a.safety?.[field] === false) stop.push(`Current safety veto: ${field}`);
    else if (a.safety?.[field] !== true) missing.push(`Current safety reassessment: ${field}`);
  }
  if (!s.sourceControlStatus) missing.push('Current source-control status');
  if (s.sourceControlStatus === 'inadequate') stop.push('Uncontrolled source');
  for (const field of ['criticalCareApproved', 'nephrologyApproved', 'infectiousDiseasesApproved', 'pharmacistExposurePlan', 'monitoringPlan', 'stopPlan', 'deviceProtocolReviewed'] as const) {
    if (a.governance?.[field] === false) stop.push(`Current governance revoked: ${field}`);
    else if (a.governance?.[field] !== true) missing.push(`Current governance reassessment: ${field}`);
  }
  if (a.governance?.consent === 'declined') stop.push('Applicable consent revoked');
  else if (!['obtained', 'not-required'].includes(a.governance?.consent ?? '')) missing.push('Current applicable consent');
  if (!['protocol', 'registry', 'research'].includes(a.governance?.setting ?? '')) missing.push('Current protocol / registry / research governance');

  const reviewHours = b.hemoadsorptionAssessment?.governance?.reviewAtHours;
  const due = finite(reviewHours) && elapsed >= reviewHours;
  if (chronology) {
    if (finite(s.norepinephrineEquivalentMcgKgMin) && finite(b.norepinephrineEquivalentMcgKgMin) && s.norepinephrineEquivalentMcgKgMin > b.norepinephrineEquivalentMcgKgMin) stop.push('Rising NE-equivalent');
    if (validSofa(s) && validSofa(b) && s.sofaScore! > b.sofaScore!) stop.push('Worsening SOFA');
    if (due) {
      for (const field of ['norepinephrineEquivalentMcgKgMin', 'lactateMmolL', 'capillaryRefillSeconds', 'sofaScore', ...targetMetrics] as const) {
        if (finite(s[field]) && finite(b[field]) && s[field] >= b[field]) stop.push(`Time-limited nonresponse: ${field}`);
      }
      if (s.sourceControlStatus === 'planned' || s.sourceControlStatus === 'in-progress') stop.push('Source not controlled at time-limited review');
    }
  }
  const reversal = finite(s.norepinephrineEquivalentMcgKgMin) && s.norepinephrineEquivalentMcgKgMin < 0.05 && finite(s.lactateMmolL) && s.lactateMmolL < 2;
  const result = local('ha-response-review', stop.length ? 'stop and reassess with the bedside multidisciplinary team'
    : missing.length ? 'Response review incomplete or original gates not cleared'
      : due ? 'Time-limited review due; no automatic continuation' : 'Serial review pending within the predefined time limit', {
    severity: stop.length ? 'critical' : 'warning',
    evidence: [...stop, `Recorded exposure interval: ${Number.isFinite(elapsed) ? elapsed : 'unknown'} h; attribution of clinical change to HA is not established.`,
      ...(reversal ? ['Shock reversal reference: NE-equivalent <0.05 and lactate <2; not a validated HA cessation endpoint.'] : []),
      'Response/stop logic is a local safety review convention, not a validated device efficacy rule.'],
    missingData: [...new Set(missing)],
    actions: [stop.length ? 'Immediate bedside stop / futility review and re-diagnosis; address source control and adverse effects under the responsible team.'
      : missing.length || due ? 'Immediate multidisciplinary review; unresolved observations or due reassessment cannot authorize continuation.'
        : 'Serial monitoring of NE-equivalent, lactate, perfusion, SOFA, targets, platelets/albumin, circuit, bleeding, electrolytes and drug exposure; deterioration requires immediate review.'],
    reassessWithinHours: stop.length || missing.length || due ? 0 : Math.min(2, Math.max(0, (reviewHours ?? 6) - elapsed)),
    counterfactuals: ['Any new harm, target loss, immune paralysis, irreversibility or changed goals triggers immediate stop review; improvement is not proof of benefit.'],
  });
  return [...cautions(b.hemoadsorptionAssessment), result, evaluateHaDrugExposure(s, exposure)];
}
