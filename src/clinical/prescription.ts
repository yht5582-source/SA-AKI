import type { Anticoagulation, CrrtMode, DecisionResult, Sex, WeightBasis } from './types';
import { resolveRuleSources } from './sources';
import { calculateAdjustedBodyWeight, calculateIdealBodyWeight } from '../utils/units';

export interface PrescriptionInput {
  adultConfirmed?: boolean;
  actualWeightKg?: number;
  idealWeightKg?: number;
  adjustedWeightKg?: number;
  heightCm?: number;
  sex?: Sex;
  weightBasis?: WeightBasis;
  weightBasisReason?: string;
  deliveredTargetMlKgHr?: number;
  /** Fraction of observation time, not hours or percent. >=0.5 needs manual review. */
  downtimeFraction?: number;
  mode?: CrrtMode;
  /** Patient whole-blood flow before PBP fluid, not pump flow including that fluid. */
  bloodFlowMlMin?: number;
  /** Fraction, e.g. 0.30; never enter 30 for 30%. */
  hematocritFraction?: number;
  dialysateMlHr?: number;
  preReplacementMlHr?: number;
  postReplacementMlHr?: number;
  /** Separate PBP / citrate infusion, not already included in preReplacementMlHr; explicitly enter 0 if absent. */
  preBloodPumpMlHr?: number;
  requestedUfNetMlHr?: number;
  pressorTrend?: 'rising' | 'stable' | 'falling';
  perfusionAdequate?: boolean;
  observedDeliveredMlKgHr?: number;
  anticoagulation?: Anticoagulation;
  /** Explicit specialist assessment; do not infer from one liver/lactate value. */
  citrateContraindication?: boolean;
  citrateProtocolAvailable?: boolean;
  bleedingRiskReviewed?: boolean;
  systemicAnticoagulationReviewed?: boolean;
  device?: 'Prismaflex' | 'PrisMax' | 'other';
  confirmations?: Partial<Record<'device' | 'solutionComposition' | 'weightBasis' | 'anticoagulation' | 'pharmacyDosing', boolean>>;
}

export interface CrrtPrescription {
  weightKg?: number;
  weightBasis?: WeightBasis;
  weightBasisReason?: string;
  prescribedEffluentMlKgHr?: number;
  deliveredTargetMlKgHr?: number;
  /** Target total, not the sum of the clinician's currently entered flows. */
  totalEffluentMlHr?: number;
  configuredEffluentMlHr?: number;
  totalUltrafiltrationMlHr?: number;
  plasmaFlowMlHr?: number;
  filtrationFractionPct?: number;
  predilutionFactor?: number;
  estimatedDeliveredMlKgHr?: number;
  ufNetMlHr?: number;
  warnings: string[];
  missingData: string[];
  assumptions: string[];
  monitoring: string[];
  deviceNeutralRecommendation: string;
  operationalDefaults?: {
    device: 'Prismaflex' | 'PrisMax'; label: 'operational starting point'; editable: true;
    bloodFlowMlMin: number; note: string;
  };
  checklistComplete: boolean;
}

const nonnegative = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value) && value >= 0;
const positive = (value: number | undefined): value is number => nonnegative(value) && value > 0;
const tenth = (value: number): number => Math.round(value * 10) / 10;
const monitoring = [
  'Electrolytes: sodium, potassium, phosphate, magnesium, systemic ionized calcium; trends and replacement per local protocol',
  'Acid-base / buffer: pH, bicarbonate and solution buffer composition; review sodium correction rate',
  'Monitor glucose and temperature; prevent hypoglycemia and hypothermia',
  'Review nutrition / amino-acid and micronutrient losses; dietitian and pharmacy drug-dose / TDM review',
  'Review anticoagulation, bleeding, platelet trend, filter life, TMP / pressures, clotting and interruption causes',
  'Reconcile prescribed versus delivered dose, actual runtime, effluent collection, pre-dilution and UFNET / total fluid balance',
];

/** Pure, adult review aid. No machine settings are written and no clearance is measured. */
export function calculatePrescription(input: PrescriptionInput): CrrtPrescription {
  resolveRuleSources('crrt-prescription-safety', ['APP_CRRT_PRESCRIPTION_V1', 'NSI_CRRT_2016']);
  resolveRuleSources('crrt-delivered-dose', ['KDIGO_2012']);
  const missingData: string[] = [];
  const warnings: string[] = [];
  const ideal = input.idealWeightKg ?? calculateIdealBodyWeight(input.heightCm, input.sex);
  const selected = input.weightBasis === 'actual' ? input.actualWeightKg : input.weightBasis === 'ideal' ? ideal
    : input.weightBasis === 'adjusted' ? input.adjustedWeightKg ?? calculateAdjustedBodyWeight(input.actualWeightKg, ideal) : undefined;
  const weightKg = positive(selected) ? selected : undefined;
  if (input.weightBasis === 'ideal' || input.weightBasis === 'adjusted') resolveRuleSources('weight-formula-arithmetic', ['CRRTNET_WEIGHT_2026']);
  if (input.adultConfirmed !== true) missingData.push('Confirm adult patient; pediatric prescription unsupported');
  if (!weightKg) missingData.push('Explicit actual / ideal / adjusted weight basis and positive finite selected weight (kg)');
  if (!input.weightBasisReason?.trim()) missingData.push('Document weight basis rationale; never select from BMI alone');
  const target = input.deliveredTargetMlKgHr;
  if (!positive(target) || target < 20 || target > 25) missingData.push('Adult delivered target 20–25 mL/kg/h; other goals need specialist review');
  const downtime = input.downtimeFraction;
  if (!nonnegative(downtime) || downtime >= 0.5) missingData.push('Confirm downtime fraction in [0, 0.5); >=50% requires manual review, not automated escalation');
  const { dialysateMlHr: qd, preReplacementMlHr: pre, postReplacementMlHr: post, bloodFlowMlMin: qb, hematocritFraction: hct } = input;
  const pbp = input.preBloodPumpMlHr;
  if (!nonnegative(pbp)) missingData.push('Explicit separate PBP / citrate flow mL/h (0 when absent); avoid double counting pre-replacement');
  const validFlows = nonnegative(qd) && nonnegative(pre) && nonnegative(post) && nonnegative(input.requestedUfNetMlHr);
  if (!validFlows) missingData.push('Explicit nonnegative dialysate, pre/post replacement and requested UFNET in mL/h (zero is valid)');
  const validBlood = positive(qb) && nonnegative(hct) && hct < 1;
  if (!validBlood) missingData.push('Positive blood flow mL/min and hematocrit fraction in [0, 1)');
  if (validFlows) {
    const replacement = pre + post;
    const modeMatches = (input.mode === 'CVVHD' && qd > 0 && replacement === 0)
      || (input.mode === 'CVVH' && qd === 0 && replacement > 0)
      || (input.mode === 'CVVHDF' && qd > 0 && replacement > 0);
    if (!modeMatches) missingData.push('Confirm CVVHD dialysate-only, CVVH replacement-only, or CVVHDF combined flows; SCUF is not a solute-dose mode');
  } else if (!input.mode) missingData.push('Select CVVHD / CVVH / CVVHDF');

  const holdUf = input.pressorTrend !== 'stable' && input.pressorTrend !== 'falling' || input.perfusionAdequate !== true;
  const ufNetMlHr = holdUf ? 0 : nonnegative(input.requestedUfNetMlHr) ? input.requestedUfNetMlHr : undefined;
  if (input.pressorTrend === 'rising') warnings.push('升壓劑增加：先暫停淨脫水並重新評估灌流');
  else if (holdUf) warnings.push('UFNET 0 review default: perfusion/pressor stability unconfirmed or inadequate; reassess before removal');
  if (input.pressorTrend === undefined || input.perfusionAdequate === undefined) warnings.push('Missing pressor trend / perfusion assessment blocks checklist completion');

  const result: CrrtPrescription = {
    weightKg, weightBasis: input.weightBasis, weightBasisReason: input.weightBasisReason,
    deliveredTargetMlKgHr: positive(target) && target >= 20 && target <= 25 ? target : undefined,
    ufNetMlHr, warnings, missingData, monitoring: [...monitoring], checklistComplete: false,
    deviceNeutralRecommendation: 'Adult CRRT: delivered effluent target 20–25 mL/kg/h with explicit weight basis; individualize flows, downtime, pre-dilution, UFNET and anticoagulation. Review aid only, not a machine-executable order; no survival advantage claimed.',
    assumptions: [
      'All solution/UF flows mL/h; patient blood flow mL/min ×60 before PBP infusion. If machine pump flow includes PBP, reconcile before input. Hct is fractional; plasma flow excludes red-cell volume.',
      'Effluent includes dialysate + pre/post replacement + separate PBP + net UF. Filtration fraction excludes dialysate and uses plasma + pre-replacement + PBP inflow; not the whole-blood concentration ratio.',
      'Simplified plasma-based dilution estimate assumes freely cleared small solute and near-complete effluent saturation; not measured clearance, no plasma-water or red-cell urea correction.',
      'Conservative plasma-model domain: dilution-corrected runtime clearance and target runtime clearance must not exceed native plasma flow. Equivalently, configured effluent may reach plasma + pre-replacement + PBP, not just native plasma. This is an outer model ceiling, not proof of complete saturation or a universal physiologic/device limit; red-cell solute transport is not modeled.',
      'PBP/citrate fluid is separately counted, not duplicated in pre-replacement. Other external infusions (including systemic calcium) belong to patient fluid balance, not automatically to circuit effluent.',
      'Compensation holds entered pre-replacement and PBP flows constant; recalculate after changing any flow. Device capabilities and clinical goals may preclude the calculated target.',
      'Dose displayed to 0.1 mL/kg/h, flows to 1 mL/h, FF to 0.1%; calculations use unrounded values. Neither precision nor target confers clinical adequacy.',
    ],
  };
  if (missingData.length === 0 && validFlows && validBlood && nonnegative(pbp) && positive(weightKg) && positive(target) && nonnegative(downtime) && ufNetMlHr !== undefined) {
    const plasma = qb * 60 * (1 - hct);
    const denominator = plasma + pre + pbp;
    const ultrafiltration = pre + post + pbp + ufNetMlHr;
    const effluent = qd + ultrafiltration;
    const factor = plasma / denominator;
    const prescription = target / ((1 - downtime) * factor);
    const targetVolume = prescription * weightKg;
    const ff = 100 * ultrafiltration / denominator;
    const delivered = effluent / weightKg * factor * (1 - downtime);
    const targetRuntimeClearance = target * weightKg / (1 - downtime);
    // Refuse impossible mass balance or floating-point overflow/underflow, not just division by zero.
    if (![plasma, denominator, effluent, factor, prescription, targetVolume, delivered].every(positive)
      || !Number.isFinite(ff) || ff >= 100 || Math.round(targetVolume) === 0 || !Number.isFinite(prescription * 10) || !Number.isFinite(delivered * 10)) {
      missingData.push('Calculated flow/dose outside finite physical bounds; reconcile units and blood/plasma-flow assumptions');
    } else if (effluent > denominator || targetRuntimeClearance > plasma) {
      // Qeff * Qp/(Qp+pre+PBP) <= Qp reduces to Qeff <= denominator.
      // Check target clearance before dilution/rounding; increasing nominal flow
      // to compensate for downtime cannot manufacture native solute inflow.
      missingData.push('Effluent saturation / model-domain check failed: configured or target runtime clearance exceeds the conservative native-plasma ceiling. Review low Qb, mL/min versus mL/h unit entry, Hct, pre/PBP accounting and measured saturation/clearance with the clinical team; modeled adequacy and compensation are withheld');
    } else {
      Object.assign(result, {
        plasmaFlowMlHr: Math.round(plasma), totalUltrafiltrationMlHr: Math.round(ultrafiltration),
        configuredEffluentMlHr: Math.round(effluent), predilutionFactor: factor,
        filtrationFractionPct: tenth(ff), prescribedEffluentMlKgHr: tenth(prescription),
        totalEffluentMlHr: Math.round(targetVolume), estimatedDeliveredMlKgHr: tenth(delivered),
      });
      if (ff >= 25) warnings.push('Elevated filtration fraction (>=25% local review flag): review blood flow, pre/post dilution, access and filter clotting; not a universal machine limit');
      if (pre + pbp > 0) warnings.push('Pre-dilution reduces estimated clearance; uncorrected effluent volume can overstate delivered dose');
      if (delivered < 20 || delivered > 25) warnings.push('Configured flows estimate delivery outside 20–25 mL/kg/h; reconcile actual delivery and clinical goals');
      if (prescription > 30) warnings.push('Compensated nominal prescription exceeds usual 25–30 range; review interruptions and dilution rather than treating higher intensity as a benefit');
    }
  }
  if (input.device === 'Prismaflex' || input.device === 'PrisMax') result.operationalDefaults = {
    device: input.device, label: 'operational starting point', editable: true, bloodFlowMlMin: 150,
    note: 'App-local editable discussion default only, not manufacturer-validated: confirm device/software, filter, access, solutions and local protocol. This default never enters the calculation unless explicitly supplied as input.',
  };
  const confirmations = input.confirmations;
  result.checklistComplete = result.totalEffluentMlHr !== undefined && !holdUf && input.device !== undefined && input.anticoagulation !== undefined
    && input.bleedingRiskReviewed === true && input.systemicAnticoagulationReviewed === true
    && (input.anticoagulation !== 'regional-citrate' || (input.citrateContraindication === false && input.citrateProtocolAvailable === true))
    && ['device', 'solutionComposition', 'weightBasis', 'anticoagulation', 'pharmacyDosing'].every(key => confirmations?.[key as keyof NonNullable<PrescriptionInput['confirmations']>] === true);
  return result;
}

export function evaluatePrescriptionSafety(input: PrescriptionInput): DecisionResult[] {
  const prescription = calculatePrescription(input);
  const observed = input.observedDeliveredMlKgHr;
  const validObserved = nonnegative(observed);
  const rcaReady = input.citrateContraindication === false && input.citrateProtocolAvailable === true
    && input.bleedingRiskReviewed === true && input.systemicAnticoagulationReviewed === true;
  const anticoagulationMissing: string[] = [];
  if (input.citrateContraindication === undefined) anticoagulationMissing.push('Citrate contraindication / impaired-metabolism assessment');
  if (input.citrateProtocolAvailable !== true) anticoagulationMissing.push('Local citrate protocol and trained monitoring team');
  if (input.bleedingRiskReviewed !== true) anticoagulationMissing.push('Bleeding / coagulation / HIT risk review');
  if (input.systemicAnticoagulationReviewed !== true) anticoagulationMissing.push('Existing systemic anticoagulation and overlap review');
  if (!input.anticoagulation) anticoagulationMissing.push('Explicit anticoagulation selection');
  const decisions: DecisionResult[] = [{
    id: 'crrt-prescription-safety', severity: prescription.missingData.length || prescription.warnings.length ? 'warning' : 'monitor',
    conclusion: prescription.totalEffluentMlHr === undefined ? 'Prescription calculation withheld: missing / invalid inputs; not a machine order' : 'Adult prescription arithmetic for clinician review only; not a machine order',
    evidence: [prescription.deviceNeutralRecommendation, ...prescription.assumptions, ...prescription.warnings],
    missingData: prescription.missingData,
    actions: [...prescription.monitoring, 'Confirm device, solution composition, selected weight/rationale, anticoagulation and pharmacy dosing before marking checklist complete; completion never authorizes therapy'],
    reassessWithinHours: input.pressorTrend === 'rising' || input.perfusionAdequate === false ? 0.25 : 1,
    counterfactuals: ['If perfusion deteriorates, hold UFNET and review immediately; if flows, weight, downtime or circuit change, recalculate and review actual delivery'],
    sourceIds: ['APP_CRRT_PRESCRIPTION_V1', 'NSI_CRRT_2016'],
  }, {
    id: 'crrt-delivered-dose', severity: prescription.totalEffluentMlHr === undefined || (validObserved && (observed < 20 || observed > 25)) ? 'warning' : 'monitor',
    conclusion: 'Review prescribed versus observed delivered adult dose; modeled delivery is not measured clearance',
    evidence: [`Target 20–25 mL/kg/h; prescribed ${prescription.prescribedEffluentMlKgHr ?? 'unknown'}; configured estimate ${prescription.estimatedDeliveredMlKgHr ?? 'unknown'}; observed ${validObserved ? observed : 'unknown'} mL/kg/h`, 'Higher prescribed flow may compensate for lost delivery; no survival benefit inferred from higher intensity'],
    missingData: [...prescription.missingData, ...(!validObserved ? ['Record observed delivered dose over a defined interval using the same weight basis; runtime and effluent measurement required'] : [])],
    actions: ['Review discrepancies using actual runtime, downtime, pre-dilution, filter function, measured effluent and the same normalization weight; do not substitute modeled delivery for observed dose'],
    counterfactuals: ['If delivery is below target, investigate interruptions and clearance before revising prescription; if above target, review excess treatment and electrolyte/nutrient loss'],
    sourceIds: ['KDIGO_2012'],
  }, {
    id: 'crrt-anticoagulation', severity: rcaReady ? 'monitor' : 'warning',
    conclusion: rcaReady ? 'Conditional RCA review when appropriate; no automatic anticoagulation order' : 'Anticoagulation specialist review required; withhold citrate preference and automatic heparin fallback',
    evidence: [`Selected anticoagulation ${input.anticoagulation ?? 'unknown'}; citrate contraindication ${input.citrateContraindication ?? 'unknown'}; protocol available ${input.citrateProtocolAvailable ?? 'unknown'}`],
    missingData: anticoagulationMissing,
    actions: ['Review liver dysfunction, shock / impaired citrate metabolism, lactate trend, bleeding/HIT and existing systemic anticoagulation with the local team; these flags do not establish an absolute contraindication automatically',
      'For citrate, monitor systemic and circuit ionized calcium, total/ionized calcium trend, calcium requirements, sodium, pH / bicarbonate and citrate accumulation under the local protocol; no citrate/calcium infusion dose generated',
      'Reassess filter life / TMP / clotting and bleeding; existing systemic anticoagulation does not guarantee circuit patency'],
    counterfactuals: ['If accumulation, worsening calcium/acid-base status or bleeding is suspected, obtain urgent team review of anticoagulation; do not escalate citrate or switch to heparin automatically'],
    sourceIds: ['KDIGO_2012', 'APP_CRRT_PRESCRIPTION_V1'],
  }];
  for (const decision of decisions) resolveRuleSources(decision.id, decision.sourceIds);
  return decisions;
}
