import { evaluateKrtInitiation } from '../../src/clinical/krt';
import { resolveRuleSources } from '../../src/clinical/sources';
import type { ClinicalSnapshot } from '../../src/clinical/types';
import { caseExportSchema } from '../../src/data/schema';

const snapshot = (extra: Partial<ClinicalSnapshot> = {}): ClinicalSnapshot => ({ id: 's', caseId: 'c', timestamp: '2026-09-21T00:00:00Z', hoursFromSepsisOnset: 0, actualWeightKg: 70, onEcmo: false, ...extra });
const result = (extra: Partial<ClinicalSnapshot> = {}) => evaluateKrtInitiation(snapshot(extra))[0];
const negatives: Partial<ClinicalSnapshot> = { potassiumMmolL: 4, arterialPh: 7.4, pulmonaryEdema: false, uremicManifestations: [], refractoryHyperkalemia: false, refractoryAcidemia: false, refractoryPulmonaryEdema: false, lifeThreateningElectrolyteDisturbance: false, dialyzableToxin: false, requiresControlledSodiumCorrection: false };

describe('complication-driven KRT review', () => {
  // Mutations caught: threshold-only initiation and inflammation/device-driven CRRT.
  it.each([{ bunMgDl: 150 }, { creatinineMgDl: 8 }, { urineVolumeMl: 0, urineObservationHours: 24 }, { il6PgMl: 100000, crpMgL: 500 }, { sofaScore: 20 }, { crrtMode: 'CVVHDF' }] satisfies Partial<ClinicalSnapshot>[])('defers isolated non-indications %j', extra => {
    const decision = result({ ...negatives, ...extra });
    expect(decision.conclusion).toContain('deferred with reassessment');
    expect(decision.severity).not.toBe('critical');
    expect(decision.actions.join(' ')).toContain('重評');
    expect(decision.reassessWithinHours).toBeLessThanOrEqual(1);
    expect(decision.counterfactuals.join(' ')).toMatch(/高血鉀.*酸.*肺水腫/);
  });
  it('uses deferred reassessment in the review-focus severe AKI case', () => {
    const decision = result({ creatinineMgDl: 5.2, bunMgDl: 118, urineVolumeMl: 84, urineObservationHours: 6, potassiumMmolL: 5.1, arterialPh: 7.29, refractoryPulmonaryEdema: false, uremicManifestations: [] });
    expect(decision.conclusion).toContain('deferred with reassessment');
    expect(decision.conclusion).not.toContain('立即 CRRT');
    expect(decision.actions.join(' ')).toContain('重評');
  });
  // Removing confirmation gating must fail, even when the number is alarming.
  it.each([{ potassiumMmolL: 7.2 }, { arterialPh: 7.05 }, { bicarbonateMmolL: 8 }, { pulmonaryEdema: true, pao2Fio2RatioMmHg: 90, respiratorySupport: 'invasive-ventilation' }, { uremicManifestations: ['other'] }] satisfies Partial<ClinicalSnapshot>[])('requires urgent confirmation for severe but unconfirmed input %j', extra => {
    const decision = result(extra);
    expect(decision.conclusion).toContain('urgent confirmation');
    expect(decision.conclusion).not.toContain('urgent KRT evaluation');
    expect(decision.missingData.length).toBeGreaterThan(0);
    expect(decision.reassessWithinHours).toBeLessThanOrEqual(0.25);
  });
  it.each([
    [{ potassiumMmolL: 6.5, refractoryHyperkalemia: true }, '高血鉀'],
    [{ arterialPh: 7.1, refractoryAcidemia: true }, '酸血症'],
    [{ pulmonaryEdema: true, pao2Fio2RatioMmHg: 100, respiratorySupport: 'invasive-ventilation', refractoryPulmonaryEdema: true }, '肺水腫'],
    [{ uremicManifestations: ['pericarditis'] }, 'pericarditis'],
    [{ uremicManifestations: ['encephalopathy'] }, 'encephalopathy'],
    [{ uremicManifestations: ['bleeding'] }, 'bleeding'],
    [{ lifeThreateningElectrolyteDisturbance: true }, '電解質'],
    [{ dialyzableToxin: true }, '毒物'],
    [{ requiresControlledSodiumCorrection: true }, '鈉'],
  ] satisfies [Partial<ClinicalSnapshot>, string][])('escalates confirmed indication %j for review only', (extra, trigger) => {
    const decision = result(extra);
    expect(decision.conclusion).toContain('urgent KRT evaluation');
    expect(decision.severity).toBe('critical');
    expect(decision.evidence.join(' ')).toContain(trigger);
    expect(decision.actions.join(' ')).toContain('臨床醫師');
    expect(decision.conclusion).toContain('非機器處方');
    expect(decision.reassessWithinHours).toBe(0);
  });
  // Positive refractory labels cannot override contradictory or absent observations.
  it.each([{ potassiumMmolL: 4, refractoryHyperkalemia: true }, { refractoryHyperkalemia: true }, { arterialPh: 7.4, refractoryAcidemia: true }, { refractoryAcidemia: true }, { pulmonaryEdema: false, refractoryPulmonaryEdema: true }, { pulmonaryEdema: true, refractoryPulmonaryEdema: true }] satisfies Partial<ClinicalSnapshot>[])('requests confirmation for discordant/incomplete refractory documentation %j', extra => {
    expect(result(extra).conclusion).toContain('urgent confirmation');
  });
  it('does not interpret missing information as absence of indications', () => {
    const decision = result();
    expect(decision.conclusion).toContain('資料不足');
    expect(decision.missingData.join(' ')).toMatch(/鉀.*pH.*肺水腫.*尿毒/);
    expect(decision.actions.join(' ')).toContain('立即補齊');
  });
  it('preserves explicit negative assessments and cites scoped evidence in every branch', () => {
    expect(result(negatives).missingData).toEqual([]);
    for (const extra of [{}, negatives, { potassiumMmolL: 7 }, { uremicManifestations: ['pericarditis'] }] satisfies Partial<ClinicalSnapshot>[]) {
      const decision = result(extra);
      expect(resolveRuleSources(decision.id, decision.sourceIds).length).toBeGreaterThan(0);
      expect(decision.evidence.length).toBeGreaterThan(0);
      expect(decision.counterfactuals.length).toBeGreaterThan(0);
      expect(decision.sourceIds).not.toContain('KDIGO_2026_DRAFT');
    }
  });
});

describe('optional KRT field persistence', () => {
  // Catch dropped fields at the strict schema/import boundary, and accidental required fields.
  it.each([
    { refractoryHyperkalemia: true, refractoryAcidemia: false, refractoryPulmonaryEdema: true, lifeThreateningElectrolyteDisturbance: false },
    { dialyzableToxin: true, requiresControlledSodiumCorrection: false },
    {},
  ] satisfies Partial<ClinicalSnapshot>[])('round-trips indication fields in schemaVersion 1: %j', extra => {
    const input = { schemaVersion: 1, case: { id: 'c', anonymousCode: 'C' }, snapshots: [snapshot(extra)] };
    expect(caseExportSchema.parse(JSON.parse(JSON.stringify(input)))).toEqual(input);
  });
});
