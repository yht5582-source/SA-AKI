/** Unknown measurements stay undefined. No clinical normal values are defaulted. */
export type Severity = 'critical' | 'warning' | 'monitor' | 'stable';
export type SourceStatus = 'guideline' | 'draft' | 'consensus' | 'trial' | 'position' | 'local' | 'unverified' | 'observational';
export type WeightBasis = 'actual' | 'ideal' | 'adjusted';
export type Sex = 'male' | 'female' | 'intersex';
export type CrrtMode = 'CVVH' | 'CVVHD' | 'CVVHDF' | 'SCUF';
export type Anticoagulation = 'regional-citrate' | 'systemic-heparin' | 'none' | 'other';
export type SourceControlStatus = 'not-indicated' | 'planned' | 'in-progress' | 'achieved' | 'inadequate';
export type Trend = 'improving' | 'unchanged' | 'worsening';
export type HaDevice = 'CytoSorb' | 'HA330' | 'HA380' | 'polymyxin-B' | 'oXiris' | 'other';

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

/** level describes the publication design, not an invented source-wide GRADE. */
export interface EvidenceSource {
  readonly id: string;
  readonly title: string;
  readonly status: SourceStatus;
  readonly level: string | undefined;
  readonly year: number | undefined;
  readonly url: string | undefined;
  readonly doi?: string;
  readonly publicationDate?: string;
  readonly version?: string;
  readonly verification: 'verified' | 'unverified';
  readonly checkedOn: string;
  readonly verificationUrl?: string;
  readonly notes?: string;
  readonly supportedClaims: readonly {
    readonly ruleId: string;
    readonly scope: string;
    readonly strength?: string;
  }[];
}

export interface PatientCase {
  id: string;
  anonymousCode: string;
  ageRange?: '18-39' | '40-64' | '65-79' | '80-plus';
  sex?: Sex;
  heightCm?: number;
  actualWeightKg?: number;
  idealWeightKg?: number;
  adjustedWeightKg?: number;
  weightBasis?: WeightBasis;
  weightBasisReason?: string;
  ckdStage?: 'G1' | 'G2' | 'G3a' | 'G3b' | 'G4' | 'G5';
  baselineCreatinineMgDl?: number;
  baselineCreatinineSource?: 'measured-outpatient' | 'measured-inpatient' | 'estimated' | 'back-calculated';
  baselineCreatinineTimestamp?: string;
  baselineCreatinineConfidence?: 'high' | 'moderate' | 'low';
  comorbidities?: string[];
  infectionSource?: 'pulmonary' | 'urinary' | 'abdominal' | 'bloodstream' | 'skin-soft-tissue' | 'other';
  infectionOnsetTimestamp?: string;
  sepsisOnsetTimestamp?: string;
  shockOnsetTimestamp?: string;
  ecmoType?: 'VA' | 'VV' | 'VAV' | 'other';
  ecmoStartedTimestamp?: string;
  ecmoCircuitDescription?: string;
  ecmoAnticoagulation?: Anticoagulation;
}

export interface SofaComponents {
  respiratory?: 0 | 1 | 2 | 3 | 4;
  coagulation?: 0 | 1 | 2 | 3 | 4;
  hepatic?: 0 | 1 | 2 | 3 | 4;
  cardiovascular?: 0 | 1 | 2 | 3 | 4;
  neurological?: 0 | 1 | 2 | 3 | 4;
  renal?: 0 | 1 | 2 | 3 | 4;
}

export interface DrugExposure {
  drugName: string;
  administeredTimestamp: string;
  doseMg?: number;
  infusionRateMgHours?: number;
  route?: 'intravenous' | 'oral' | 'other';
}

export interface TherapeuticDrugMonitoring {
  drugName: string;
  sampledTimestamp: string;
  concentrationMgL?: number;
  auc24MgHoursL?: number;
  micMgL?: number;
  pharmacistPlan?: string;
}

export interface TreatmentAdverseEvent {
  timestamp: string;
  kind: 'bleeding' | 'thrombocytopenia' | 'circuit-clotting' | 'hypotension' | 'electrolyte-disturbance' | 'drug-underexposure' | 'albumin-loss' | 'hemolysis' | 'other';
  severity?: 'mild' | 'moderate' | 'severe';
  description?: string;
}

export interface HemoadsorptionExposure {
  device: HaDevice;
  targetAdsorbate?: 'cytokines' | 'endotoxin' | 'cytokines-and-endotoxin' | 'other';
  startedTimestamp: string;
  stoppedTimestamp?: string;
  bloodFlowMlMin?: number;
  cartridgeChangeTimestamps?: string[];
  cumulativeProcessedBloodVolumeL?: number;
  drugExposures?: DrugExposure[];
  therapeuticDrugMonitoring?: TherapeuticDrugMonitoring[];
  response?: Trend;
  responseReviewedTimestamp?: string;
  adverseEvents?: TreatmentAdverseEvent[];
}

/** Explicit clinician assessments, not conclusions inferred from a biomarker. */
export interface HemoadsorptionAssessment {
  /** Observation storage is distinct from documented multidisciplinary review. Never a treatment indication. */
  reviewStatus?: 'incomplete' | 'multidisciplinary-review';
  optedIn?: boolean;
  adultConfirmed?: boolean;
  septicShockConfirmed?: boolean;
  requestedDevice?: HaDevice;
  targetAdsorbate?: HemoadsorptionExposure['targetAdsorbate'];
  standardCare?: {
    antimicrobials?: boolean;
    sourceControl?: boolean;
    fluids?: boolean;
    vasopressors?: boolean;
    corticosteroids?: boolean;
  };
  shockTrajectory?: 'persistent' | 'worsening' | 'resolving';
  reversibleTrait?: boolean;
  hyperinflammatoryPhenotype?: boolean;
  endotoxinPhenotype?: boolean;
  immunoparalysis?: boolean;
  /** Clinician/interpreting laboratory assessment; no universal HLA-DR cutoff. */
  lowHlaDr?: boolean;
  suspectedGramNegativeInfection?: boolean;
  targetStillPresent?: boolean;
  safety?: {
    plateletsAcceptable?: boolean;
    coagulationAcceptable?: boolean;
    albuminAcceptable?: boolean;
    hepaticRenalReviewed?: boolean;
    electrolytesReviewed?: boolean;
    vascularAccessReviewed?: boolean;
    anticoagulationReviewed?: boolean;
    circuitCompatible?: boolean;
    drugRemovalPlan?: boolean;
    uncontrolledBleeding?: boolean;
    irreversibleOrganFailure?: boolean;
    goalsCompatible?: boolean;
  };
  governance?: {
    criticalCareApproved?: boolean;
    nephrologyApproved?: boolean;
    infectiousDiseasesApproved?: boolean;
    pharmacistExposurePlan?: boolean;
    setting?: 'protocol' | 'registry' | 'research';
    consent?: 'obtained' | 'not-required' | 'pending' | 'declined';
    monitoringPlan?: boolean;
    stopPlan?: boolean;
    deviceProtocolReviewed?: boolean;
    /** App-local time-limited review ceiling, not a validated treatment duration. */
    reviewAtHours?: number;
  };
}

/** Clinician review, explicitly separate from measured recovery proxies. */
export interface LiberationAssessment {
  originalIndicationResolved?: boolean;
  nativeSoluteControlAdequate?: boolean;
  nativeFluidBalanceAdequate?: boolean;
  observationAdequate?: boolean;
  downtimeReviewed?: boolean;
  diureticEffectReviewed?: boolean;
  timedCreatinineClearanceMlMin?: number;
  clearanceCollectionHours?: number;
  monitoringPlan?: {
    urineOutput?: boolean;
    fluidBalance?: boolean;
    electrolytesAcidBase?: boolean;
    respiratoryHemodynamic?: boolean;
    restartTriggersReviewed?: boolean;
    reviewWithinHours?: number;
  };
}

/** Explicit, optional clinician inputs to review arithmetic; never a machine-executable order. */
export interface PrescriptionAssessment {
  adultConfirmed?: boolean;
  weightBasisReason?: string;
  deliveredTargetMlKgHr?: number;
  dialysateMlHr?: number;
  preReplacementMlHr?: number;
  postReplacementMlHr?: number;
  preBloodPumpMlHr?: number;
  bloodFlowMlMin?: number;
  hematocritFraction?: number;
  perfusionAdequate?: boolean;
  citrateContraindication?: boolean;
  citrateProtocolAvailable?: boolean;
  bleedingRiskReviewed?: boolean;
  systemicAnticoagulationReviewed?: boolean;
  device?: 'Prismaflex' | 'PrisMax' | 'other';
  confirmations?: Partial<Record<'device' | 'solutionComposition' | 'weightBasis' | 'anticoagulation' | 'pharmacyDosing', boolean>>;
}

export interface ClinicalSnapshot {
  id: string;
  caseId: string;
  /** ISO 8601 timestamp including UTC offset; validate at the persistence boundary. */
  timestamp: string;
  hoursFromSepsisOnset: number;
  creatinineMgDl?: number;
  bunMgDl?: number;
  urineVolumeMl?: number;
  urineObservationHours?: number;
  urineWeightBasis?: WeightBasis;
  urineNormalizationWeightKg?: number;
  diureticExposure?: boolean;
  diureticExposures?: DrugExposure[];
  actualWeightKg: number;

  mapMmHg?: number;
  heartRateBeatsMin?: number;
  norepinephrineEquivalentMcgKgMin?: number;
  vasopressorTrend?: Trend;
  lactateMmolL?: number;
  capillaryRefillSeconds?: number;
  mentalStatus?: 'alert' | 'altered' | 'unresponsive' | 'sedated';
  skinMottling?: boolean;
  peripheralTemperature?: 'warm' | 'cool';

  fluidIntervalHours?: number;
  intervalFluidInputMl?: number;
  intervalFluidOutputMl?: number;
  intervalNetFluidBalanceMl?: number;
  cumulativeFluidBalanceMl?: number;
  bodyWeightChangeKg?: number;

  passiveLegRaiseResult?: 'responsive' | 'nonresponsive' | 'indeterminate' | 'not-performed';
  vtiCm?: number;
  vtiResponsePercent?: number;
  strokeVolumeMl?: number;
  strokeVolumeResponsePercent?: number;
  lvSystolicFunction?: 'preserved' | 'mildly-reduced' | 'moderately-reduced' | 'severely-reduced';
  rvFunction?: 'preserved' | 'impaired';
  rvDilation?: boolean;
  lungBLines?: 'absent' | 'focal' | 'bilateral-diffuse';
  ivcDiameterMm?: number;
  ivcRespiratoryVariationPercent?: number;
  vexusGrade?: 0 | 1 | 2 | 3;
  cvpMmHg?: number;

  arterialPh?: number;
  bicarbonateMmolL?: number;
  potassiumMmolL?: number;
  sodiumMmolL?: number;
  ionizedCalciumMmolL?: number;
  magnesiumMmolL?: number;
  phosphateMmolL?: number;
  glucoseMgDl?: number;
  uremicManifestations?: ('encephalopathy' | 'pericarditis' | 'bleeding' | 'other')[];
  /** Clinician-confirmed failure of appropriate medical treatment; missing is unknown. */
  refractoryHyperkalemia?: boolean;
  refractoryAcidemia?: boolean;
  /** Clinician-confirmed pulmonary edema/hypoxemia despite medical AND respiratory support. */
  refractoryPulmonaryEdema?: boolean;
  /** Explicit clinician assessment, not inferred from a single electrolyte value. */
  lifeThreateningElectrolyteDisturbance?: boolean;
  /** Toxicology-confirmed dialyzable exposure requiring extracorporeal-clearance review. */
  dialyzableToxin?: boolean;
  /** Specialist-confirmed need to review KRT for controlled sodium correction. */
  requiresControlledSodiumCorrection?: boolean;
  hemodynamicTolerance?: 'stable' | 'intermediate' | 'unstable';
  rapidSoluteClearanceNeeded?: boolean;
  preciseFluidElectrolyteControlNeeded?: boolean;

  respiratorySupport?: 'room-air' | 'conventional-oxygen' | 'high-flow-nasal-oxygen' | 'noninvasive-ventilation' | 'invasive-ventilation';
  pao2Fio2RatioMmHg?: number;
  pulmonaryEdema?: boolean;
  intracranialPressureRisk?: boolean;
  onEcmo: boolean;
  ecmoConnection?: 'independent-catheter' | 'integrated-circuit' | 'not-established';
  /** Pressures at the proposed/current CRRT access and return sites, not generic ECMO pressures. */
  ecmoAccessPressureMmHg?: number;
  ecmoReturnPressureMmHg?: number;
  ecmoAirRiskReviewed?: boolean;
  ecmoPressureCompatibilityReviewed?: boolean;
  ecmoFlowLMin?: number;
  ecmoAnticoagulation?: Anticoagulation;

  sofaComponents?: SofaComponents;
  sofaScore?: number;
  modsScore?: number;
  sourceControlStatus?: SourceControlStatus;
  sourceControlTimestamp?: string;
  firstAntimicrobialTimestamp?: string;
  antimicrobials?: DrugExposure[];

  crrtMode?: CrrtMode;
  crrtStartedTimestamp?: string;
  crrtStoppedTimestamp?: string;
  prescribedEffluentMlKgHours?: number;
  deliveredEffluentMlKgHours?: number;
  crrtDoseWeightKg?: number;
  crrtDoseWeightBasis?: WeightBasis;
  crrtDowntimeHours?: number;
  crrtObservationHours?: number;
  ufNetMlHours?: number;
  ufNetMlKgHours?: number;
  filterLifeHours?: number;
  anticoagulation?: Anticoagulation;
  crrtAdverseEvents?: TreatmentAdverseEvent[];
  prescriptionAssessment?: PrescriptionAssessment;
  liberationAssessment?: LiberationAssessment;

  il6PgMl?: number;
  endotoxinActivityAssay?: number; // Dimensionless EAA, not an endotoxin concentration.
  crpMgL?: number;
  procalcitoninNgMl?: number;
  ferritinNgMl?: number;
  platelets10e9L?: number;
  fibrinogenGL?: number;
  dDimerMgLFeu?: number;
  albuminGL?: number;
  monocyteHlaDrAntibodiesPerCell?: number;
  hemoadsorptionAssessment?: HemoadsorptionAssessment;
  hemoadsorptionExposures?: HemoadsorptionExposure[];
}
