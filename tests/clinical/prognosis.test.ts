import { classifyAkiTrajectory, evaluatePrognosis } from '../../src/clinical/prognosis';
import { resolveRuleSources } from '../../src/clinical/sources';
import type { ClinicalSnapshot, PatientCase } from '../../src/clinical/types';

const patient: PatientCase = { id: 'c', anonymousCode: 'A', ckdStage: 'G3b', shockOnsetTimestamp: '2026-09-20T00:00:00Z' };
function s(hour: number, creatinineMgDl: number, urineVolumeMl: number, extra: Partial<ClinicalSnapshot> = {}): ClinicalSnapshot {
  return { id: `s${hour}`, caseId: 'c', timestamp: `2026-09-21T${String(hour).padStart(2, '0')}:00:00Z`, hoursFromSepsisOnset: hour, actualWeightKg: 70, onEcmo: false,
    creatinineMgDl, urineVolumeMl, urineObservationHours: 6, diureticExposure: false,
    mapMmHg: 70, norepinephrineEquivalentMcgKgMin: 0.1, lactateMmolL: 2,
    respiratorySupport: 'invasive-ventilation', pao2Fio2RatioMmHg: 200,
    cumulativeFluidBalanceMl: 2000, sofaScore: 8, sourceControlStatus: 'achieved', ...extra };
}
describe('observed renal trajectory, not predicted recovery', () => {
  it.each([
    [[s(0, 4, 100), s(6, 3, 200)], 'improving'],
    [[s(0, 3, 200), s(6, 4, 100)], 'worsening'],
    [[s(0, 3, 100), s(6, 3, 100)], 'persistent'],
    [[s(0, 4, 100), s(6, 3, 200), s(12, 4, 100)], 'relapsing'],
    [[s(0, 4, 100), s(6, 3, 50)], 'insufficient-data'],
    [[s(0, 4, 100)], 'insufficient-data'],
    [[], 'insufficient-data'],
  ] as const)('classifies measured concordance: %s', (snapshots, expected) => {
    expect(classifyAkiTrajectory([...snapshots])).toBe(expected);
  });
  it('uses urine rate instead of comparing unequal collection volumes', () => {
    expect(classifyAkiTrajectory([s(0, 4, 120), s(12, 3, 180, { urineObservationHours: 12 })])).toBe('insufficient-data');
  });
  it('orders timepoints without changing caller arrays', () => {
    const snapshots = [s(6, 3, 200), s(0, 4, 100)]; const copy = structuredClone(snapshots);
    expect(classifyAkiTrajectory(snapshots)).toBe('improving'); expect(snapshots).toEqual(copy);
  });
  it.each([
    [s(0, 4, 100), s(0, 3, 200)],
    [s(0, 4, 100), s(6, 3, 200, { caseId: 'other' })],
    [s(0, 4, 100), s(6, 3, 200, { urineObservationHours: undefined })],
    [s(0, 4, 100), s(6, 3, 200, { urineVolumeMl: undefined })],
    [s(0, 4, 100), s(6, 3, 200, { diureticExposure: true })],
    [s(0, 4, 100), s(6, 3, 200, { crrtStartedTimestamp: '2026-09-20T00:00:00Z' })],
    [s(0, 4, 100), s(6, Number.NaN, 200)],
    [s(0, 4, 100), s(6, 3, 200, { timestamp: 'invalid' })],
  ])('fails closed on missing, confounded or ambiguous trajectories', (...snapshots) => {
    expect(classifyAkiTrajectory(snapshots)).toBe('insufficient-data');
  });
  it('preserves zero urine as observed rather than missing', () => {
    expect(classifyAkiTrajectory([s(0, 4, 0), s(6, 4, 0)])).toBe('persistent');
  });
  it('does not label recorded CRRT with missing timing as native recovery', () => {
    expect(classifyAkiTrajectory([s(0, 4, 100, { crrtMode: 'CVVHD' }), s(6, 3, 200, { crrtMode: 'CVVHD' })])).toBe('insufficient-data');
  });
  it('does not use urine collections overlapping the CRRT stop or CRRT between samples as native recovery', () => {
    const recent = { crrtStartedTimestamp: '2026-09-21T01:00:00Z', crrtStoppedTimestamp: '2026-09-21T05:00:00Z' };
    expect(classifyAkiTrajectory([s(0, 4, 100), s(6, 3, 200, recent)])).toBe('insufficient-data');
    expect(classifyAkiTrajectory([s(0, 4, 100), s(12, 3, 200, recent)])).toBe('insufficient-data');
  });
  it('allows descriptive paired observations after a complete off-CRRT observation interval', () => {
    const remote = { crrtStartedTimestamp: '2026-09-19T00:00:00Z', crrtStoppedTimestamp: '2026-09-20T00:00:00Z' };
    expect(classifyAkiTrajectory([s(0, 4, 100, remote), s(6, 3, 200, remote)])).toBe('improving');
  });
});

describe('factor-based prognosis review', () => {
  it('reports improving and worsening domains separately with uncertainty', () => {
    const result = evaluatePrognosis(patient, [s(0, 4, 100), s(6, 3, 200, { mapMmHg: 60, lactateMmolL: 4, norepinephrineEquivalentMcgKgMin: 0.3, pao2Fio2RatioMmHg: 300, cumulativeFluidBalanceMl: 3000, sofaScore: 12 })]);
    const text = JSON.stringify(result);
    expect(text).toMatch(/renal.*improving/);
    expect(text).toMatch(/hemodynamic.*worsening/);
    expect(text).toMatch(/respiratory.*improving/);
    expect(text).toMatch(/fluid.*worsening/);
    expect(text).toMatch(/organ.*worsening/);
    expect(text).toMatch(/uncertainty|不確定/);
    for (const r of result) expect(resolveRuleSources(r.id, r.sourceIds).length).toBeGreaterThan(0);
  });
  it('conflicting measured shock and clinician pressor assessment remain visible', () => {
    const text = JSON.stringify(evaluatePrognosis(patient, [s(0, 4, 100), s(6, 3, 200, { mapMmHg: 80, lactateMmolL: 1, norepinephrineEquivalentMcgKgMin: 0.3, vasopressorTrend: 'improving' })]));
    expect(text).toMatch(/hemodynamic.*indeterminate/);
    expect(text).toMatch(/clinician assessment.*improving/);
  });
  it('records CKD, shock exposure, multiorgan, fluid and nephrotoxin context without inventing exposure', () => {
    const text = JSON.stringify(evaluatePrognosis(patient, [s(0, 4, 100), s(6, 3, 200)]));
    expect(text).toContain('G3b'); expect(text).toMatch(/shock.*30/);
    expect(text).toMatch(/multiorgan/); expect(text).toMatch(/nephrotoxin.*unknown/);
    expect(text).toMatch(/MAKE30/); expect(text).toMatch(/MAKE90/);
    expect(text).toMatch(/death.*new.*KRT.*persistent.*kidney/i);
    for (const confounder of ['RRT clearance', 'dilution', 'diuretics', 'residual', 'source control']) expect(text).toContain(confounder);
  });
  it('does not mistake a single snapshot, foreign case or duplicate timestamps for a known trajectory', () => {
    for (const snapshots of [[s(0, 4, 100)], [s(0, 4, 100), s(0, 3, 200)], [s(0, 4, 100), s(6, 3, 200, { caseId: 'other' })]]) {
      const result = evaluatePrognosis(patient, snapshots);
      expect(result[0].missingData.length).toBeGreaterThan(0);
      expect(result[0].conclusion).toMatch(/indeterminate/);
    }
  });
  it('renal biomarkers never produce individual probabilities, survival statements or treatment orders', () => {
    const text = JSON.stringify(evaluatePrognosis(patient, [s(0, 4, 100, { il6PgMl: 4000 }), s(6, 3, 200, { il6PgMl: 10 })]));
    expect(text).not.toMatch(/\d\s*%|will die|will recover|mortality risk is|stop CRRT|start CRRT|必然死亡|必然恢復/);
    expect(text).toMatch(/not.*individual|非.*個人/);
  });
});
