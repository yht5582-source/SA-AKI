import { evaluateEcmoConnection, selectKrtModality } from '../../src/clinical/modality';
import { resolveRuleSources } from '../../src/clinical/sources';
import type { ClinicalSnapshot } from '../../src/clinical/types';
import { caseExportSchema, clinicalSnapshotSchema } from '../../src/data/schema';

const snapshot = (extra: Partial<ClinicalSnapshot> = {}): ClinicalSnapshot => ({ id: 's', caseId: 'c', timestamp: '2026-09-21T00:00:00Z', hoursFromSepsisOnset: 0, actualWeightKg: 70, onEcmo: false, ...extra });
const stable: Partial<ClinicalSnapshot> = { hemodynamicTolerance: 'stable', mapMmHg: 75, norepinephrineEquivalentMcgKgMin: 0, vasopressorTrend: 'unchanged', lactateMmolL: 1.5, intracranialPressureRisk: false, preciseFluidElectrolyteControlNeeded: false };
const modality = (extra: Partial<ClinicalSnapshot> = {}) => selectKrtModality(snapshot(extra))[0];
const ecmo = (extra: Partial<ClinicalSnapshot> = {}) => evaluateEcmoConnection(snapshot({ onEcmo: true, ...extra }))[0];
const completeCircuit: Partial<ClinicalSnapshot> = {
  ecmoConnection: 'integrated-circuit', ecmoAccessPressureMmHg: 200, ecmoReturnPressureMmHg: 180,
  ecmoAirRiskReviewed: true, ecmoPressureCompatibilityReviewed: true, ecmoFlowLMin: 4,
  ecmoAnticoagulation: 'systemic-heparin', anticoagulation: 'none',
};

describe('conditional modality review, never initiation', () => {
  // Catches missing precision-control assessment being silently interpreted as false.
  it.each([
    ['stable', undefined, '資料不足或衝突，暫不偏好單一模式'],
    ['stable', false, 'IHD review'],
    ['stable', true, 'CRRT review'],
    ['intermediate', undefined, '資料不足或衝突，暫不偏好單一模式'],
    ['intermediate', false, 'PIRRT review'],
    ['intermediate', true, 'CRRT review'],
  ] as const)('requires precision assessment for %s tolerance: %s yields %s', (hemodynamicTolerance, preciseFluidElectrolyteControlNeeded, expected) => {
    const decision = modality({ ...stable, hemodynamicTolerance, preciseFluidElectrolyteControlNeeded });
    expect(decision.conclusion).toContain(expected);
    if (preciseFluidElectrolyteControlNeeded === undefined) {
      expect(decision.missingData).toContain('是否需精密液體／電解質控制');
      expect(decision.actions.join(' ')).toContain('液體／電解質控制目標重評模式');
    } else {
      expect(decision.missingData).not.toContain('是否需精密液體／電解質控制');
    }
  });
  // Catches incorrect prioritization and conversion of modality into an indication.
  it.each([
    [{ mapMmHg: 55 }, 'CRRT'],
    [{ hemodynamicTolerance: 'unstable' }, 'CRRT'],
    [{ ...stable, rapidSoluteClearanceNeeded: true }, 'IHD'],
    [{ ...stable, hemodynamicTolerance: 'intermediate', norepinephrineEquivalentMcgKgMin: 0.03 }, 'PIRRT'],
    [{ ...stable, intracranialPressureRisk: true, rapidSoluteClearanceNeeded: true }, 'CRRT'],
    [{ ...stable, preciseFluidElectrolyteControlNeeded: true }, 'CRRT'],
  ] satisfies [Partial<ClinicalSnapshot>, string][])('reviews %s as %s only if KRT is separately indicated', (extra, option) => {
    const decision = modality(extra);
    expect(decision.conclusion).toContain(`${option} review`);
    expect(decision.conclusion).toContain('若 KRT 適應症另經確認');
    expect(decision.conclusion).toContain('非機器處方');
    expect(decision.evidence.join(' ')).toContain('無已證實存活優勢');
  });
  it.each([{ mapMmHg: 55 }, { vasopressorTrend: 'worsening' }, { lactateMmolL: 5 }, { norepinephrineEquivalentMcgKgMin: 0.4 }, { skinMottling: true }, { peripheralTemperature: 'cool' }, { capillaryRefillSeconds: 5 }] satisfies Partial<ClinicalSnapshot>[])('does not accept the stable label over conflicting perfusion %j', extra => {
    const decision = modality({ ...stable, rapidSoluteClearanceNeeded: true, ...extra });
    expect(decision.conclusion).not.toContain('IHD review');
    expect(decision.evidence.join(' ')).toContain('衝突');
    expect(decision.actions.join(' ')).toContain('重評');
  });
  it('does not label missing hemodynamics or ICP risk as stable', () => {
    expect(modality({ rapidSoluteClearanceNeeded: true }).conclusion).toContain('資料不足');
    expect(modality({ ...stable, intracranialPressureRisk: undefined, rapidSoluteClearanceNeeded: true }).conclusion).not.toContain('IHD review');
    expect(modality().missingData.join(' ')).toMatch(/MAP.*升壓.*顱內壓/);
  });
  it('explains CRRT mechanisms without assigning survival superiority', () => {
    const results = selectKrtModality(snapshot({ mapMmHg: 50 }));
    const mechanisms = results.find(item => item.id === 'krt-modality-mechanisms')!;
    expect(mechanisms.evidence.join(' ')).toMatch(/CVVHD.*擴散.*CVVH.*對流.*CVVHDF.*擴散.*對流/);
    expect(mechanisms.conclusion).toContain('無已證實存活優勢');
    expect(mechanisms.actions.join(' ')).toContain('非機器處方');
  });
});

describe('ECMO access review', () => {
  it('does not expose circuit selection for a patient off ECMO', () => {
    expect(evaluateEcmoConnection(snapshot())).toEqual([]);
  });
  it.each(['independent-catheter', 'integrated-circuit', 'not-established'] as const)('compares both routes and withholds selection for incomplete %s configuration', ecmoConnection => {
    const decision = ecmo({ ecmoConnection });
    expect(decision.conclusion).toContain('不選定接法');
    expect(decision.evidence.join(' ')).toContain('獨立導管');
    expect(decision.evidence.join(' ')).toContain('整合 ECMO 迴路');
    expect(decision.missingData.join(' ')).toMatch(/壓力.*空氣.*流量/);
    expect(decision.actions.join(' ')).toMatch(/有效.*劑量/);
    expect(decision.actions.join(' ')).toMatch(/溶血.*凝血.*TMP/);
    expect(decision.actions.join(' ')).toMatch(/抗凝.*出血.*中斷/);
  });
  it.each(['systemic-heparin', 'regional-citrate', 'none'] as const)('never assumes ECMO %s guarantees filter life', ecmoAnticoagulation => {
    expect(ecmo({ ecmoAnticoagulation }).evidence.join(' ')).toContain('不保證 CRRT 濾器壽命');
  });
  it('retains physician/perfusionist review even with recorded pressures and air assessment', () => {
    const decision = ecmo(completeCircuit);
    expect(decision.conclusion).toContain('團隊複核');
    expect(decision.conclusion).toContain('非接管指令');
    expect(decision.evidence.join(' ')).toContain('200 mmHg');
    expect(decision.evidence.join(' ')).toContain('180 mmHg');
    expect(decision.actions.join(' ')).toContain('灌流師');
    expect(decision.missingData).toEqual([]);
  });
  it.each([
    [{ ecmoAirRiskReviewed: false }, '空氣進入／回流與氣栓風險確認'],
    [{ ecmoPressureCompatibilityReviewed: false }, '接入／回輸壓力與機器相容性確認'],
    [{ ecmoFlowLMin: 0 }, 'ECMO 有效病人流量及分流／再循環評估'],
    [{ anticoagulation: undefined }, 'CRRT 抗凝選擇與 ECMO 抗凝重疊／出血風險'],
  ] satisfies [Partial<ClinicalSnapshot>, string][])('isolates each unresolved circuit safety blocker %j', (extra, missing) => {
    const decision = ecmo({ ...completeCircuit, ...extra });
    expect(decision.conclusion).toContain('不選定接法');
    expect(decision.missingData).toEqual([missing]);
  });
  it('gives all modality/ECMO decisions scoped sources and actionable counterfactuals', () => {
    for (const decision of [...selectKrtModality(snapshot()), ...selectKrtModality(snapshot(stable)), ...evaluateEcmoConnection(snapshot({ onEcmo: true }))]) {
      expect(resolveRuleSources(decision.id, decision.sourceIds).length).toBeGreaterThan(0);
      expect(decision.evidence.length).toBeGreaterThan(0);
      expect(decision.actions.length).toBeGreaterThan(0);
      expect(decision.counterfactuals.length).toBeGreaterThan(0);
      expect(decision.sourceIds).not.toContain('KDIGO_2026_DRAFT');
    }
  });
});

describe('modality/ECMO schema import', () => {
  it.each([
    { hemodynamicTolerance: 'intermediate', rapidSoluteClearanceNeeded: true, preciseFluidElectrolyteControlNeeded: false },
    { ecmoConnection: 'integrated-circuit', ecmoAccessPressureMmHg: -100, ecmoReturnPressureMmHg: 200, ecmoFlowLMin: 4, ecmoAirRiskReviewed: false, ecmoPressureCompatibilityReviewed: true, ecmoAnticoagulation: 'none' },
  ] satisfies Partial<ClinicalSnapshot>[])('round-trips optional field group %j', extra => {
    const input = { schemaVersion: 1, case: { id: 'c', anonymousCode: 'C' }, snapshots: [snapshot(extra)] };
    expect(caseExportSchema.parse(JSON.parse(JSON.stringify(input)))).toEqual(input);
  });
  it.each([{ ecmoAccessPressureMmHg: Infinity }, { ecmoFlowLMin: -1 }, { hemodynamicTolerance: 'normal' }, { ecmoAirRiskReviewed: 'yes' }])('rejects malformed safety field %j', extra => {
    expect(clinicalSnapshotSchema.safeParse({ ...snapshot(), ...extra }).success).toBe(false);
  });
});
