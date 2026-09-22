import { z } from 'zod';
import type {
  ClinicalSnapshot,
  DrugExposure,
  HemoadsorptionAssessment,
  HemoadsorptionExposure,
  LiberationAssessment,
  PatientCase,
  PrescriptionAssessment,
  SofaComponents,
  TherapeuticDrugMonitoring,
  TreatmentAdverseEvent,
} from '../clinical/types';

const id = z.string().trim().min(1);
const finiteNumber = z.number().finite();
const nonNegativeNumber = finiteNumber.nonnegative();
const positiveNumber = finiteNumber.positive();
const percentage = finiteNumber.min(0).max(100);
const timestamp = z.string().datetime({ offset: true });

const weightBasisSchema = z.enum(['actual', 'ideal', 'adjusted']);
const trendSchema = z.enum(['improving', 'unchanged', 'worsening']);
const anticoagulationSchema = z.enum(['regional-citrate', 'systemic-heparin', 'none', 'other']);

const prescriptionAssessmentSchema: z.ZodType<PrescriptionAssessment> = z.strictObject({
  adultConfirmed: z.boolean().optional(),
  weightBasisReason: z.string().trim().min(1).optional(),
  deliveredTargetMlKgHr: positiveNumber.optional(),
  dialysateMlHr: nonNegativeNumber.optional(),
  preReplacementMlHr: nonNegativeNumber.optional(),
  postReplacementMlHr: nonNegativeNumber.optional(),
  preBloodPumpMlHr: nonNegativeNumber.optional(),
  bloodFlowMlMin: positiveNumber.optional(),
  hematocritFraction: finiteNumber.min(0).lt(1).optional(),
  perfusionAdequate: z.boolean().optional(),
  citrateContraindication: z.boolean().optional(),
  citrateProtocolAvailable: z.boolean().optional(),
  bleedingRiskReviewed: z.boolean().optional(),
  systemicAnticoagulationReviewed: z.boolean().optional(),
  device: z.enum(['Prismaflex', 'PrisMax', 'other']).optional(),
  confirmations: z.strictObject({
    device: z.boolean().optional(), solutionComposition: z.boolean().optional(),
    weightBasis: z.boolean().optional(), anticoagulation: z.boolean().optional(), pharmacyDosing: z.boolean().optional(),
  }).optional(),
});

const drugExposureSchema: z.ZodType<DrugExposure> = z.strictObject({
  drugName: z.string().trim().min(1),
  administeredTimestamp: timestamp,
  doseMg: nonNegativeNumber.optional(),
  infusionRateMgHours: nonNegativeNumber.optional(),
  route: z.enum(['intravenous', 'oral', 'other']).optional(),
});

const therapeuticDrugMonitoringSchema: z.ZodType<TherapeuticDrugMonitoring> = z.strictObject({
  drugName: z.string().trim().min(1),
  sampledTimestamp: timestamp,
  concentrationMgL: nonNegativeNumber.optional(),
  auc24MgHoursL: nonNegativeNumber.optional(),
  micMgL: nonNegativeNumber.optional(),
  pharmacistPlan: z.string().optional(),
});

const treatmentAdverseEventSchema: z.ZodType<TreatmentAdverseEvent> = z.strictObject({
  timestamp,
  kind: z.enum([
    'bleeding', 'thrombocytopenia', 'circuit-clotting', 'hypotension',
    'electrolyte-disturbance', 'drug-underexposure', 'albumin-loss', 'hemolysis', 'other',
  ]),
  severity: z.enum(['mild', 'moderate', 'severe']).optional(),
  description: z.string().optional(),
});

const hemoadsorptionExposureSchema: z.ZodType<HemoadsorptionExposure> = z.strictObject({
  device: z.enum(['CytoSorb', 'HA330', 'HA380', 'polymyxin-B', 'oXiris', 'other']),
  targetAdsorbate: z.enum(['cytokines', 'endotoxin', 'cytokines-and-endotoxin', 'other']).optional(),
  startedTimestamp: timestamp,
  stoppedTimestamp: timestamp.optional(),
  bloodFlowMlMin: positiveNumber.optional(),
  cartridgeChangeTimestamps: z.array(timestamp).optional(),
  cumulativeProcessedBloodVolumeL: nonNegativeNumber.optional(),
  drugExposures: z.array(drugExposureSchema).optional(),
  therapeuticDrugMonitoring: z.array(therapeuticDrugMonitoringSchema).optional(),
  response: trendSchema.optional(),
  responseReviewedTimestamp: timestamp.optional(),
  adverseEvents: z.array(treatmentAdverseEventSchema).optional(),
}).superRefine((exposure, context) => {
  if (exposure.stoppedTimestamp && Date.parse(exposure.stoppedTimestamp) < Date.parse(exposure.startedTimestamp)) {
    context.addIssue({ code: 'custom', path: ['stoppedTimestamp'], message: 'stop time must not precede start time' });
  }
});

const sofaComponentsSchema: z.ZodType<SofaComponents> = z.strictObject({
  respiratory: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  coagulation: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  hepatic: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  cardiovascular: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  neurological: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  renal: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
});

const hemoadsorptionAssessmentSchema: z.ZodType<HemoadsorptionAssessment> = z.strictObject({
  reviewStatus: z.enum(['incomplete', 'multidisciplinary-review']).optional(),
  optedIn: z.boolean().optional(),
  adultConfirmed: z.boolean().optional(),
  septicShockConfirmed: z.boolean().optional(),
  requestedDevice: z.enum(['CytoSorb', 'HA330', 'HA380', 'polymyxin-B', 'oXiris', 'other']).optional(),
  targetAdsorbate: z.enum(['cytokines', 'endotoxin', 'cytokines-and-endotoxin', 'other']).optional(),
  standardCare: z.strictObject({
    antimicrobials: z.boolean().optional(), sourceControl: z.boolean().optional(),
    fluids: z.boolean().optional(), vasopressors: z.boolean().optional(), corticosteroids: z.boolean().optional(),
  }).optional(),
  shockTrajectory: z.enum(['persistent', 'worsening', 'resolving']).optional(),
  reversibleTrait: z.boolean().optional(),
  hyperinflammatoryPhenotype: z.boolean().optional(),
  endotoxinPhenotype: z.boolean().optional(),
  immunoparalysis: z.boolean().optional(),
  lowHlaDr: z.boolean().optional(),
  suspectedGramNegativeInfection: z.boolean().optional(),
  targetStillPresent: z.boolean().optional(),
  safety: z.strictObject({
    plateletsAcceptable: z.boolean().optional(), coagulationAcceptable: z.boolean().optional(),
    albuminAcceptable: z.boolean().optional(), hepaticRenalReviewed: z.boolean().optional(),
    electrolytesReviewed: z.boolean().optional(), vascularAccessReviewed: z.boolean().optional(),
    anticoagulationReviewed: z.boolean().optional(), circuitCompatible: z.boolean().optional(),
    drugRemovalPlan: z.boolean().optional(), uncontrolledBleeding: z.boolean().optional(),
    irreversibleOrganFailure: z.boolean().optional(), goalsCompatible: z.boolean().optional(),
  }).optional(),
  governance: z.strictObject({
    criticalCareApproved: z.boolean().optional(), nephrologyApproved: z.boolean().optional(),
    infectiousDiseasesApproved: z.boolean().optional(), pharmacistExposurePlan: z.boolean().optional(),
    setting: z.enum(['protocol', 'registry', 'research']).optional(),
    consent: z.enum(['obtained', 'not-required', 'pending', 'declined']).optional(),
    monitoringPlan: z.boolean().optional(), stopPlan: z.boolean().optional(),
    deviceProtocolReviewed: z.boolean().optional(), reviewAtHours: positiveNumber.optional(),
  }).optional(),
});

const liberationAssessmentSchema: z.ZodType<LiberationAssessment> = z.strictObject({
  originalIndicationResolved: z.boolean().optional(),
  nativeSoluteControlAdequate: z.boolean().optional(),
  nativeFluidBalanceAdequate: z.boolean().optional(),
  observationAdequate: z.boolean().optional(),
  downtimeReviewed: z.boolean().optional(),
  diureticEffectReviewed: z.boolean().optional(),
  timedCreatinineClearanceMlMin: nonNegativeNumber.optional(),
  clearanceCollectionHours: positiveNumber.optional(),
  monitoringPlan: z.strictObject({
    urineOutput: z.boolean().optional(), fluidBalance: z.boolean().optional(),
    electrolytesAcidBase: z.boolean().optional(), respiratoryHemodynamic: z.boolean().optional(),
    restartTriggersReviewed: z.boolean().optional(), reviewWithinHours: positiveNumber.optional(),
  }).optional(),
});

export const patientCaseSchema: z.ZodType<PatientCase> = z.strictObject({
  id,
  anonymousCode: z.string().trim().min(1),
  ageRange: z.enum(['18-39', '40-64', '65-79', '80-plus']).optional(),
  sex: z.enum(['male', 'female', 'intersex']).optional(),
  heightCm: positiveNumber.max(300).optional(),
  actualWeightKg: positiveNumber.max(500).optional(),
  idealWeightKg: positiveNumber.max(500).optional(),
  adjustedWeightKg: positiveNumber.max(500).optional(),
  weightBasis: weightBasisSchema.optional(),
  weightBasisReason: z.string().optional(),
  ckdStage: z.enum(['G1', 'G2', 'G3a', 'G3b', 'G4', 'G5']).optional(),
  baselineCreatinineMgDl: nonNegativeNumber.optional(),
  baselineCreatinineSource: z.enum(['measured-outpatient', 'measured-inpatient', 'estimated', 'back-calculated']).optional(),
  baselineCreatinineTimestamp: timestamp.optional(),
  baselineCreatinineConfidence: z.enum(['high', 'moderate', 'low']).optional(),
  comorbidities: z.array(z.string()).optional(),
  infectionSource: z.enum(['pulmonary', 'urinary', 'abdominal', 'bloodstream', 'skin-soft-tissue', 'other']).optional(),
  infectionOnsetTimestamp: timestamp.optional(),
  sepsisOnsetTimestamp: timestamp.optional(),
  shockOnsetTimestamp: timestamp.optional(),
  ecmoType: z.enum(['VA', 'VV', 'VAV', 'other']).optional(),
  ecmoStartedTimestamp: timestamp.optional(),
  ecmoCircuitDescription: z.string().optional(),
  ecmoAnticoagulation: anticoagulationSchema.optional(),
}).superRefine((patientCase, context) => {
  if (
    patientCase.sepsisOnsetTimestamp
    && patientCase.shockOnsetTimestamp
    && Date.parse(patientCase.shockOnsetTimestamp) < Date.parse(patientCase.sepsisOnsetTimestamp)
  ) {
    context.addIssue({ code: 'custom', path: ['shockOnsetTimestamp'], message: 'shock onset must not precede sepsis onset' });
  }
});

export const clinicalSnapshotSchema: z.ZodType<ClinicalSnapshot> = z.strictObject({
  id,
  caseId: id,
  timestamp,
  hoursFromSepsisOnset: finiteNumber,
  creatinineMgDl: nonNegativeNumber.optional(),
  bunMgDl: nonNegativeNumber.optional(),
  urineVolumeMl: nonNegativeNumber.optional(),
  urineObservationHours: positiveNumber.optional(),
  urineWeightBasis: weightBasisSchema.optional(),
  urineNormalizationWeightKg: positiveNumber.optional(),
  diureticExposure: z.boolean().optional(),
  diureticExposures: z.array(drugExposureSchema).optional(),
  actualWeightKg: positiveNumber.max(500),

  mapMmHg: nonNegativeNumber.optional(),
  heartRateBeatsMin: nonNegativeNumber.optional(),
  norepinephrineEquivalentMcgKgMin: nonNegativeNumber.optional(),
  vasopressorTrend: trendSchema.optional(),
  lactateMmolL: nonNegativeNumber.optional(),
  capillaryRefillSeconds: nonNegativeNumber.optional(),
  mentalStatus: z.enum(['alert', 'altered', 'unresponsive', 'sedated']).optional(),
  skinMottling: z.boolean().optional(),
  peripheralTemperature: z.enum(['warm', 'cool']).optional(),

  fluidIntervalHours: positiveNumber.optional(),
  intervalFluidInputMl: nonNegativeNumber.optional(),
  intervalFluidOutputMl: nonNegativeNumber.optional(),
  intervalNetFluidBalanceMl: finiteNumber.optional(),
  cumulativeFluidBalanceMl: finiteNumber.optional(),
  bodyWeightChangeKg: finiteNumber.optional(),

  passiveLegRaiseResult: z.enum(['responsive', 'nonresponsive', 'indeterminate', 'not-performed']).optional(),
  vtiCm: nonNegativeNumber.optional(),
  vtiResponsePercent: finiteNumber.optional(),
  strokeVolumeMl: nonNegativeNumber.optional(),
  strokeVolumeResponsePercent: finiteNumber.optional(),
  lvSystolicFunction: z.enum(['preserved', 'mildly-reduced', 'moderately-reduced', 'severely-reduced']).optional(),
  rvFunction: z.enum(['preserved', 'impaired']).optional(),
  rvDilation: z.boolean().optional(),
  lungBLines: z.enum(['absent', 'focal', 'bilateral-diffuse']).optional(),
  ivcDiameterMm: nonNegativeNumber.optional(),
  ivcRespiratoryVariationPercent: percentage.optional(),
  vexusGrade: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  cvpMmHg: finiteNumber.optional(),

  arterialPh: finiteNumber.min(6.5).max(8).optional(),
  bicarbonateMmolL: nonNegativeNumber.optional(),
  potassiumMmolL: nonNegativeNumber.optional(),
  sodiumMmolL: nonNegativeNumber.optional(),
  ionizedCalciumMmolL: nonNegativeNumber.optional(),
  magnesiumMmolL: nonNegativeNumber.optional(),
  phosphateMmolL: nonNegativeNumber.optional(),
  glucoseMgDl: nonNegativeNumber.optional(),
  uremicManifestations: z.array(z.enum(['encephalopathy', 'pericarditis', 'bleeding', 'other'])).optional(),
  refractoryHyperkalemia: z.boolean().optional(),
  refractoryAcidemia: z.boolean().optional(),
  refractoryPulmonaryEdema: z.boolean().optional(),
  lifeThreateningElectrolyteDisturbance: z.boolean().optional(),
  dialyzableToxin: z.boolean().optional(),
  requiresControlledSodiumCorrection: z.boolean().optional(),
  hemodynamicTolerance: z.enum(['stable', 'intermediate', 'unstable']).optional(),
  rapidSoluteClearanceNeeded: z.boolean().optional(),
  preciseFluidElectrolyteControlNeeded: z.boolean().optional(),

  respiratorySupport: z.enum(['room-air', 'conventional-oxygen', 'high-flow-nasal-oxygen', 'noninvasive-ventilation', 'invasive-ventilation']).optional(),
  pao2Fio2RatioMmHg: nonNegativeNumber.optional(),
  pulmonaryEdema: z.boolean().optional(),
  intracranialPressureRisk: z.boolean().optional(),
  onEcmo: z.boolean(),
  ecmoConnection: z.enum(['independent-catheter', 'integrated-circuit', 'not-established']).optional(),
  ecmoAccessPressureMmHg: finiteNumber.optional(),
  ecmoReturnPressureMmHg: finiteNumber.optional(),
  ecmoAirRiskReviewed: z.boolean().optional(),
  ecmoPressureCompatibilityReviewed: z.boolean().optional(),
  ecmoFlowLMin: nonNegativeNumber.optional(),
  ecmoAnticoagulation: anticoagulationSchema.optional(),

  sofaComponents: sofaComponentsSchema.optional(),
  sofaScore: finiteNumber.int().min(0).max(24).optional(),
  modsScore: finiteNumber.int().min(0).max(24).optional(),
  sourceControlStatus: z.enum(['not-indicated', 'planned', 'in-progress', 'achieved', 'inadequate']).optional(),
  sourceControlTimestamp: timestamp.optional(),
  firstAntimicrobialTimestamp: timestamp.optional(),
  antimicrobials: z.array(drugExposureSchema).optional(),

  crrtMode: z.enum(['CVVH', 'CVVHD', 'CVVHDF', 'SCUF']).optional(),
  crrtStartedTimestamp: timestamp.optional(),
  crrtStoppedTimestamp: timestamp.optional(),
  prescribedEffluentMlKgHours: nonNegativeNumber.optional(),
  deliveredEffluentMlKgHours: nonNegativeNumber.optional(),
  crrtDoseWeightKg: positiveNumber.optional(),
  crrtDoseWeightBasis: weightBasisSchema.optional(),
  crrtDowntimeHours: nonNegativeNumber.optional(),
  crrtObservationHours: positiveNumber.optional(),
  ufNetMlHours: finiteNumber.optional(),
  ufNetMlKgHours: finiteNumber.optional(),
  filterLifeHours: nonNegativeNumber.optional(),
  anticoagulation: anticoagulationSchema.optional(),
  crrtAdverseEvents: z.array(treatmentAdverseEventSchema).optional(),
  prescriptionAssessment: prescriptionAssessmentSchema.optional(),
  liberationAssessment: liberationAssessmentSchema.optional(),

  il6PgMl: nonNegativeNumber.optional(),
  endotoxinActivityAssay: finiteNumber.min(0).max(1).optional(),
  crpMgL: nonNegativeNumber.optional(),
  procalcitoninNgMl: nonNegativeNumber.optional(),
  ferritinNgMl: nonNegativeNumber.optional(),
  platelets10e9L: nonNegativeNumber.optional(),
  fibrinogenGL: nonNegativeNumber.optional(),
  dDimerMgLFeu: nonNegativeNumber.optional(),
  albuminGL: nonNegativeNumber.optional(),
  monocyteHlaDrAntibodiesPerCell: nonNegativeNumber.optional(),
  hemoadsorptionAssessment: hemoadsorptionAssessmentSchema.optional(),
  hemoadsorptionExposures: z.array(hemoadsorptionExposureSchema).optional(),
}).superRefine((snapshot, context) => {
  if (
    snapshot.crrtStartedTimestamp
    && snapshot.crrtStoppedTimestamp
    && Date.parse(snapshot.crrtStoppedTimestamp) < Date.parse(snapshot.crrtStartedTimestamp)
  ) {
    context.addIssue({ code: 'custom', path: ['crrtStoppedTimestamp'], message: 'CRRT stop time must not precede start time' });
  }
});

export interface CaseExport {
  schemaVersion: 1;
  case: PatientCase;
  snapshots: ClinicalSnapshot[];
}

export const caseExportSchema: z.ZodType<CaseExport> = z.strictObject({
  schemaVersion: z.literal(1),
  case: patientCaseSchema,
  snapshots: z.array(clinicalSnapshotSchema),
}).superRefine((payload, context) => {
  const snapshotIds = new Set<string>();

  payload.snapshots.forEach((snapshot, index) => {
    if (snapshotIds.has(snapshot.id)) {
      context.addIssue({ code: 'custom', path: ['snapshots', index, 'id'], message: 'duplicate snapshot ID' });
    }
    snapshotIds.add(snapshot.id);

    if (snapshot.caseId !== payload.case.id) {
      context.addIssue({ code: 'custom', path: ['snapshots', index, 'caseId'], message: 'snapshot caseId must match case ID' });
    }

    if (payload.case.sepsisOnsetTimestamp) {
      const elapsedHours = (
        Date.parse(snapshot.timestamp) - Date.parse(payload.case.sepsisOnsetTimestamp)
      ) / 3_600_000;
      if (Math.abs(elapsedHours - snapshot.hoursFromSepsisOnset) > 1e-9) {
        context.addIssue({
          code: 'custom',
          path: ['snapshots', index, 'hoursFromSepsisOnset'],
          message: 'snapshot timestamp conflicts with hours from sepsis onset',
        });
      }
    }
  });
});

const directIdentifierKeys = new Set([
  'name', 'fullname', 'patientname',
  'medicalrecordnumber', 'mrn',
  'fulldateofbirth', 'dateofbirth', 'dob',
  'phone', 'phonenumber', 'address', 'email',
  'nationalid', 'socialsecuritynumber',
]);

function normalizedKey(key: string): string {
  return key.toLocaleLowerCase('en-US').replace(/[^a-z0-9]/g, '');
}

/** Reject direct identifiers at any depth before an imported value reaches IndexedDB. */
export function assertNoDirectIdentifiers(value: unknown): void {
  const visited = new WeakSet<object>();

  const visit = (candidate: unknown): void => {
    if (candidate === null || typeof candidate !== 'object') return;
    if (visited.has(candidate)) return;
    visited.add(candidate);

    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }

    for (const [key, nestedValue] of Object.entries(candidate)) {
      if (directIdentifierKeys.has(normalizedKey(key))) {
        throw new Error(`識別資料欄位不得匯入：${key}`);
      }
      visit(nestedValue);
    }
  };

  visit(value);
}
