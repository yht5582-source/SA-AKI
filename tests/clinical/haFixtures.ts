import type { ClinicalSnapshot, HemoadsorptionAssessment } from '../../src/clinical/types';

export function haAssessment(patch: Partial<HemoadsorptionAssessment> = {}): HemoadsorptionAssessment {
  return {
    optedIn: true, adultConfirmed: true, septicShockConfirmed: true,
    requestedDevice: 'CytoSorb', targetAdsorbate: 'cytokines',
    standardCare: { antimicrobials: true, sourceControl: true, fluids: true, vasopressors: true, corticosteroids: true },
    shockTrajectory: 'worsening', reversibleTrait: true, hyperinflammatoryPhenotype: true,
    immunoparalysis: false, lowHlaDr: false, targetStillPresent: true,
    safety: {
      plateletsAcceptable: true, coagulationAcceptable: true, albuminAcceptable: true,
      hepaticRenalReviewed: true, electrolytesReviewed: true, vascularAccessReviewed: true,
      anticoagulationReviewed: true, circuitCompatible: true, drugRemovalPlan: true,
      uncontrolledBleeding: false, irreversibleOrganFailure: false, goalsCompatible: true,
    },
    governance: {
      criticalCareApproved: true, nephrologyApproved: true, infectiousDiseasesApproved: true,
      pharmacistExposurePlan: true, setting: 'registry', consent: 'obtained',
      monitoringPlan: true, stopPlan: true, deviceProtocolReviewed: true, reviewAtHours: 6,
    },
    ...patch,
  };
}

export function haSnapshot(patch: Partial<ClinicalSnapshot> = {}): ClinicalSnapshot {
  return {
    id: 'ha-baseline', caseId: 'ha-case', timestamp: '2026-09-21T06:00:00Z',
    hoursFromSepsisOnset: 6, actualWeightKg: 70, onEcmo: false,
    mapMmHg: 62, norepinephrineEquivalentMcgKgMin: 0.3, vasopressorTrend: 'worsening',
    lactateMmolL: 4, capillaryRefillSeconds: 4, sofaScore: 12, modsScore: 10,
    sourceControlStatus: 'achieved', firstAntimicrobialTimestamp: '2026-09-21T01:00:00Z',
    il6PgMl: 1800, endotoxinActivityAssay: 0.7, platelets10e9L: 150,
    fibrinogenGL: 3, dDimerMgLFeu: 2, albuminGL: 28,
    urineVolumeMl: 60, urineObservationHours: 2,
    hemoadsorptionAssessment: haAssessment(), ...patch,
  };
}

export function haInput(patch: Partial<ClinicalSnapshot> = {}) {
  return {
    snapshot: haSnapshot(patch),
    previousSnapshot: haSnapshot({
      id: 'pre-ha', timestamp: '2026-09-21T04:00:00Z', hoursFromSepsisOnset: 4,
      norepinephrineEquivalentMcgKgMin: 0.2, lactateMmolL: 3.5, sofaScore: 11, il6PgMl: 1200,
    }),
  };
}

export function haResponseInput(patch: Partial<ClinicalSnapshot> = {}) {
  return {
    baseline: haInput(),
    snapshot: haSnapshot({
      id: 'ha-review', timestamp: '2026-09-21T12:00:00Z', hoursFromSepsisOnset: 12,
      norepinephrineEquivalentMcgKgMin: 0.1, lactateMmolL: 2.5, capillaryRefillSeconds: 2,
      sofaScore: 10, il6PgMl: 800,
      hemoadsorptionExposures: [{
        device: 'CytoSorb', targetAdsorbate: 'cytokines', startedTimestamp: '2026-09-21T06:00:00Z',
        cartridgeChangeTimestamps: ['2026-09-21T10:00:00Z'],
        drugExposures: [{ drugName: 'vancomycin', administeredTimestamp: '2026-09-21T07:00:00Z', doseMg: 1500 }],
      }],
      ...patch,
    }),
  };
}
