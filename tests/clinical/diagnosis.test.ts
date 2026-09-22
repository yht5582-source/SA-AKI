import { calculateKdigoStage, evaluateDiagnosis } from '../../src/clinical/diagnosis';
import { resolveDecisionSources, resolveRuleSources } from '../../src/clinical/sources';
import type { ClinicalSnapshot, PatientCase } from '../../src/clinical/types';
import { caseExportSchema } from '../../src/data/schema';

const measured = { baselineCreatinineMgDl: 1, baselineSource: 'measured-outpatient' as const, baselineAgeHours: 24 };
const urineNormal = { urineVolumeMl: 720, urineObservationHours: 12, urineWeightKg: 60 };

describe('KDIGO creatinine criteria', () => {
  // Catches binary representation falling just below exact decimal fold thresholds.
  it.each([[1.2, 1], [1.6, 2], [2.4, 3]])('stages decimal SCr %s against measured 0.8 at 168 h as %s', (currentCreatinineMgDl, stage) => {
    expect(calculateKdigoStage({ ...measured, ...urineNormal, baselineCreatinineMgDl: 0.8, baselineAgeHours: 168, currentCreatinineMgDl })).toMatchObject({ stage, confidence: 'high' });
  });
  it.each([[1.2, 1], [2.4, 3]])('applies the same decimal-fold comparison to serial SCr %s', (currentCreatinineMgDl, stage) => {
    expect(calculateKdigoStage({ ...urineNormal, currentCreatinineMgDl, priorCreatinineMeasurements: [{ creatinineMgDl: 0.8, hoursAgo: 168 }] }).stage).toBe(stage);
  });
  it.each([[1.19999, 0], [1.59999, 1], [2.39999, 2]])('does not clinically round subthreshold SCr %s against baseline 0.8 up to the next stage', (currentCreatinineMgDl, stage) => {
    expect(calculateKdigoStage({ ...measured, ...urineNormal, baselineCreatinineMgDl: 0.8, baselineAgeHours: 168, currentCreatinineMgDl }).stage).toBe(stage);
  });
  // Catches incorrect inclusive fold cutoffs; values independently hand checked.
  it.each([[1.49, 1], [1.5, 1], [1.99, 1], [2, 2], [2.99, 2], [3, 3]])('SCr %s yields stage %s with recent baseline 1', (currentCreatinineMgDl, stage) => {
    expect(calculateKdigoStage({ ...measured, currentCreatinineMgDl }).creatinineStage).toBe(stage);
  });
  it.each([[1.49, 0], [1.5, 1], [2, 2], [3, 3]])('SCr fold-only %s at 168 h yields %s', (currentCreatinineMgDl, stage) => {
    expect(calculateKdigoStage({ ...measured, baselineAgeHours: 168, currentCreatinineMgDl }).creatinineStage).toBe(stage);
  });
  it.each([[47.999, 1], [48, 1], [48.001, 0]])('+0.3 at %s h yields %s', (baselineAgeHours, stage) => {
    expect(calculateKdigoStage({ ...measured, baselineCreatinineMgDl: 2, baselineAgeHours, currentCreatinineMgDl: 2.3 }).creatinineStage).toBe(stage);
  });
  it('does not round a genuinely subthreshold rise up to 0.3', () => {
    expect(calculateKdigoStage({ ...measured, baselineCreatinineMgDl: 2, currentCreatinineMgDl: 2.29999 }).creatinineStage).toBe(0);
  });
  it('finds a timed acute rise even without baseline', () => {
    expect(calculateKdigoStage({ currentCreatinineMgDl: 2.3, priorCreatinineMeasurements: [{ creatinineMgDl: 2, hoursAgo: 48 }] }).creatinineStage).toBe(1);
  });
  it('does not use a future or simultaneous measurement as evidence of increase', () => {
    expect(calculateKdigoStage({ currentCreatinineMgDl: 2, priorCreatinineMeasurements: [{ creatinineMgDl: 1, hoursAgo: -1 }, { creatinineMgDl: 1, hoursAgo: 0 }] }).creatinineStage).toBeNull();
  });
  it('does not use a future baseline to create even a provisional acute fold rise', () => {
    expect(calculateKdigoStage({ ...measured, baselineAgeHours: -24, currentCreatinineMgDl: 2 }).creatinineStage).toBeNull();
  });
  it('requires AKI evidence before applying the absolute 4 mg/dL stage-3 criterion', () => {
    expect(calculateKdigoStage({ ...measured, baselineCreatinineMgDl: 4, currentCreatinineMgDl: 4.1 }).stage).toBe(0);
    expect(calculateKdigoStage({ ...measured, baselineCreatinineMgDl: 3.7, currentCreatinineMgDl: 4 }).stage).toBe(3);
    expect(calculateKdigoStage({ currentCreatinineMgDl: 4 }).creatinineStage).toBeNull();
  });
  it('can establish AKI by urine before applying the absolute creatinine threshold', () => {
    expect(calculateKdigoStage({ currentCreatinineMgDl: 4, urineVolumeMl: 100, urineObservationHours: 6, urineWeightKg: 60 }).stage).toBe(3);
  });
  it.each(['estimated', 'back-calculated'] as const)('keeps %s baseline provisional and low confidence', baselineSource => {
    expect(calculateKdigoStage({ currentCreatinineMgDl: 2.1, baselineCreatinineMgDl: 1, baselineSource })).toMatchObject({ stage: 2, confidence: 'low', provisional: true });
  });
  it.each([undefined, 168.001])('does not claim an acute fold rise from unknown/stale timing %s', baselineAgeHours => {
    const result = calculateKdigoStage({ ...measured, baselineAgeHours, currentCreatinineMgDl: 2 });
    expect(result).toMatchObject({ stage: 2, confidence: 'low', provisional: true });
    expect(result.missingData.length).toBeGreaterThan(0);
  });
  it('preserves an explicitly low baseline confidence despite measured provenance', () => {
    expect(calculateKdigoStage({ ...measured, baselineConfidence: 'low', currentCreatinineMgDl: 2 }).confidence).toBe('low');
  });
});

describe('KDIGO urine criteria', () => {
  // All rates are derived from total mL / 60 kg / hours; catches duration and strict-rate errors.
  it.each([
    [149.97, 5.999, null], [179.99, 6, 1], [180, 6, 0],
    [300, 11.999, 1], [359.99, 12, 2], [360, 12, 0],
    [400, 23.999, 2], [431.99, 24, 3], [432, 24, 2],
    [0, 6, 1], [0, 11.999, 1], [0, 12, 3],
  ])('%s mL over %s h at 60 kg yields %s', (urineVolumeMl, urineObservationHours, stage) => {
    expect(calculateKdigoStage({ urineVolumeMl, urineObservationHours, urineWeightKg: 60 }).urineStage).toBe(stage);
  });
  it('uses the explicitly chosen normalization weight', () => {
    expect(calculateKdigoStage({ urineVolumeMl: 200, urineObservationHours: 6, urineWeightKg: 60 }).urineStage).toBe(0);
    expect(calculateKdigoStage({ urineVolumeMl: 200, urineObservationHours: 6, urineWeightKg: 80 }).urineStage).toBe(1);
  });
  it('keeps incomplete urine observations unknown rather than normal', () => {
    expect(calculateKdigoStage({ urineVolumeMl: 10, urineWeightKg: 60 }).urineStage).toBeNull();
    expect(calculateKdigoStage({ urineVolumeMl: 10, urineObservationHours: 6 }).urineStage).toBeNull();
  });
  it('recognizes documented 12-hour anuria without requiring normalization weight', () => {
    expect(calculateKdigoStage({ urineVolumeMl: 0, urineObservationHours: 12 }).urineStage).toBe(3);
  });
});

describe('combined staging and uncertainty', () => {
  it.each([[2, 0, 24, 3], [3, 100, 6, 3], [1, 100, 12, 2]])('uses more severe SCr %s and UO %s/%s', (currentCreatinineMgDl, urineVolumeMl, urineObservationHours, stage) => {
    expect(calculateKdigoStage({ ...measured, currentCreatinineMgDl, urineVolumeMl, urineObservationHours, urineWeightKg: 60 }).stage).toBe(stage);
  });
  it('stages initiation of acute renal replacement therapy as 3', () => {
    expect(calculateKdigoStage({ renalReplacementTherapy: true })).toMatchObject({ stage: 3, creatinineStage: null, urineStage: null, provisional: false });
  });
  it('never labels completely missing measurements as normal', () => {
    const result = calculateKdigoStage({});
    expect(result).toMatchObject({ stage: 0, creatinineStage: null, urineStage: null, confidence: 'low', status: 'insufficient-data' });
    expect(result.missingData.length).toBeGreaterThan(0);
  });
  it('reports high confidence only with complete reliable axes', () => {
    expect(calculateKdigoStage({ ...measured, ...urineNormal, currentCreatinineMgDl: 2 })).toMatchObject({ stage: 2, confidence: 'high', provisional: false });
    expect(calculateKdigoStage({ ...measured, currentCreatinineMgDl: 2 })).toMatchObject({ stage: 2, confidence: 'moderate', urineStage: null });
  });
  it.each([NaN, Infinity, -1])('rejects invalid current creatinine %s', currentCreatinineMgDl => {
    expect(() => calculateKdigoStage({ currentCreatinineMgDl })).toThrow();
  });
  it('rejects invalid denominators without deriving a normal stage', () => {
    expect(() => calculateKdigoStage({ urineVolumeMl: 10, urineObservationHours: 0, urineWeightKg: 60 })).toThrow();
    expect(() => calculateKdigoStage({ ...measured, baselineCreatinineMgDl: 0, currentCreatinineMgDl: 2 })).toThrow();
  });
});

const caseData: PatientCase = {
  id: 'case-1', anonymousCode: 'A1', infectionSource: 'pulmonary',
  sepsisOnsetTimestamp: '2026-09-01T00:00:00Z', baselineCreatinineMgDl: 1,
  baselineCreatinineSource: 'measured-outpatient', baselineCreatinineTimestamp: '2026-09-01T00:00:00Z',
};
const snapshot = (hours: number, extra: Partial<ClinicalSnapshot> = {}): ClinicalSnapshot => ({
  id: `s-${hours}`, caseId: 'case-1', timestamp: new Date(Date.parse('2026-09-01T00:00:00Z') + hours * 3_600_000).toISOString(),
  hoursFromSepsisOnset: hours, actualWeightKg: 60, onEcmo: false,
  creatinineMgDl: 1, ...extra,
});
const decision = (hours: number) => evaluateDiagnosis(caseData, [snapshot(hours, { urineVolumeMl: 100, urineObservationHours: 6, urineNormalizationWeightKg: 60, urineWeightBasis: 'actual' })]).find(result => result.id === 'sa-aki-timing')!;

describe('diagnosis decisions', () => {
  it('excludes a schema-valid zero baseline and preserves documented anuria stage 3 with an explanation', () => {
    const payload = caseExportSchema.parse({ schemaVersion: 1, case: { ...caseData, baselineCreatinineMgDl: 0 }, snapshots: [snapshot(24, { urineVolumeMl: 0, urineObservationHours: 12 })] });
    const result = evaluateDiagnosis(payload.case, payload.snapshots).find(item => item.id === 'aki-staging')!;
    expect(result.conclusion).toContain('stage 3');
    expect(result.missingData).toContain('基準 SCr 為 0，無法作為有效比較值；請補齊可靠基準');
    expect(result.evidence.join(' ')).toContain('SCr 分期 未知');
  });
  // Mutating <= to < at 48/168, or allowing negative elapsed time, breaks these.
  it.each([[0, 'early'], [47.999, 'early'], [48, 'early'], [48.001, 'late'], [168, 'late'], [168.001, 'outside'], [-1, 'before']])('first observed AKI at %s h is %s', (hours, label) => {
    expect(decision(hours).conclusion).toContain(label);
  });
  it('retains the first documented AKI timing after the seven-day window', () => {
    const result = evaluateDiagnosis(caseData, [snapshot(24, { creatinineMgDl: 2 }), snapshot(200, { creatinineMgDl: 2 })]);
    expect(result.find(item => item.id === 'sa-aki-timing')?.conclusion).toContain('early');
  });
  it('uses the earliest qualifying observation in unordered imports, not the first array entry or a preceding normal value', () => {
    const observations = [snapshot(72, { creatinineMgDl: 3 }), snapshot(0), snapshot(24, { creatinineMgDl: 2 })];
    const unchanged = structuredClone(observations);
    const results = evaluateDiagnosis(caseData, observations);
    const timing = results.find(item => item.id === 'sa-aki-timing')!;
    expect(timing.conclusion).toContain('early');
    expect(timing.evidence[0]).toContain('2026-09-02T00:00:00.000Z');
    expect(results.find(item => item.id === 'aki-staging')?.conclusion).toContain('stage 3');
    expect(observations).toEqual(unchanged);
  });
  it('honors an explicit current selection at an equal timestamp instead of replacing it with the ID tie-break', () => {
    const prior = snapshot(0, { creatinineMgDl: 1, sofaScore: 4 });
    const severe = { ...snapshot(6, { creatinineMgDl: 3, sofaScore: 12 }), id: 'a-severe' };
    const normal = { ...snapshot(6, { creatinineMgDl: 1, sofaScore: 2 }), id: 'z-normal' };
    const results = evaluateDiagnosis(caseData, [prior, severe, normal], severe.id);
    expect(results.find(item => item.id === 'aki-staging')?.conclusion).toContain('stage 3');
    expect(results.find(item => item.id === 'sepsis-assessment')?.evidence.join(' ')).toContain('目前 SOFA：12');
  });
  it('does not use unconfirmed estimated-baseline AKI to claim confirmed SA-AKI', () => {
    const results = evaluateDiagnosis({ ...caseData, baselineCreatinineSource: 'estimated' }, [snapshot(24, { creatinineMgDl: 2 })]);
    expect(results.find(item => item.id === 'aki-staging')?.conclusion).toContain('暫定');
    expect(results.find(item => item.id === 'sa-aki-timing')?.conclusion).toContain('暫定');
  });
  it('does not invent a sepsis origin from the required elapsed-hours field', () => {
    const results = evaluateDiagnosis({ ...caseData, sepsisOnsetTimestamp: undefined }, [snapshot(24, { creatinineMgDl: 2 })]);
    expect(results.find(item => item.id === 'sa-aki-timing')?.missingData).toContain('Sepsis 起始時間');
    expect(results.find(item => item.id === 'sa-aki-timing')?.conclusion).not.toMatch(/early|late/);
  });
  it('does not infer normal baseline SOFA or sepsis from one high SOFA score', () => {
    const result = evaluateDiagnosis({ id: 'case-1', anonymousCode: 'A1' }, [snapshot(24, { sofaScore: 8 })]).find(item => item.id === 'sepsis-assessment')!;
    expect(result.missingData).toContain('感染前 SOFA 與急性變化／感染歸因');
    expect(result.conclusion).toContain('無法獨立確認');
  });
  it('does not treat empty snapshots as no AKI', () => {
    const result = evaluateDiagnosis(caseData, []).find(item => item.id === 'aki-staging')!;
    expect(result.severity).not.toBe('stable');
    expect(result.conclusion).toContain('資料不足');
  });
  it('uses serial measured creatinine to confirm acute increase without an outpatient baseline', () => {
    const result = evaluateDiagnosis({ id: 'case-1', anonymousCode: 'A1' }, [snapshot(0, { creatinineMgDl: 2 }), snapshot(48, { creatinineMgDl: 2.3 })]).find(item => item.id === 'aki-staging')!;
    expect(result.conclusion).toContain('stage 1');
  });
  it('does not infer a urine normalization choice from actual body weight', () => {
    const result = evaluateDiagnosis(caseData, [snapshot(24, { urineVolumeMl: 100, urineObservationHours: 6 })]).find(item => item.id === 'aki-staging')!;
    expect(result.missingData).toContain('尿量正規化體重與體重基準');
  });
  it('requests missing diuretic context for urine interpretation without changing KDIGO cutoffs', () => {
    const result = evaluateDiagnosis(caseData, [snapshot(24, { urineVolumeMl: 100, urineObservationHours: 6, urineNormalizationWeightKg: 60, urineWeightBasis: 'actual' })]).find(item => item.id === 'aki-staging')!;
    expect(result.missingData).toContain('利尿劑使用情形');
    expect(result.conclusion).toContain('stage 1');
  });
  it('documents active acute CRRT as stage 3, without prescribing initiation', () => {
    const result = evaluateDiagnosis(caseData, [snapshot(24, { crrtStartedTimestamp: '2026-09-01T01:00:00Z', crrtMode: 'CVVHDF' })]).find(item => item.id === 'aki-staging')!;
    expect(result.conclusion).toContain('stage 3');
    expect(result.actions.join(' ')).toContain('不等同新啟動 KRT 適應症');
  });
  it('carries documented ongoing acute CRRT forward when a later immutable observation omits treatment fields', () => {
    const result = evaluateDiagnosis(caseData, [
      snapshot(12, { crrtStartedTimestamp: '2026-09-01T12:00:00Z', crrtMode: 'CVVHDF' }),
      snapshot(24, { creatinineMgDl: 1, urineVolumeMl: 720, urineObservationHours: 12, urineNormalizationWeightKg: 60, urineWeightBasis: 'actual' }),
    ]).find(item => item.id === 'aki-staging')!;
    expect(result.conclusion).toContain('stage 3');
    expect(result.evidence.join(' ')).toContain('急性病程已開始 RRT');
  });
  it('does not keep current KDIGO stage 3 after a linked documented CRRT stop, while retaining the episode maximum', () => {
    const result = evaluateDiagnosis(caseData, [
      snapshot(18, { crrtStartedTimestamp: '2026-09-01T12:00:00Z', crrtStoppedTimestamp: '2026-09-01T18:00:00Z' }),
      snapshot(24, { creatinineMgDl: 1, urineVolumeMl: 720, urineObservationHours: 12, urineNormalizationWeightKg: 60, urineWeightBasis: 'actual' }),
    ]).find(item => item.id === 'aki-staging')!;
    expect(result.conclusion).not.toContain('stage 3');
    expect(result.evidence.join(' ')).toContain('本次急性病程歷史最高 KDIGO stage 3');
  });
  it('treats repeated documentation of the same CRRT event as corroboration, not conflicting episodes', () => {
    const result = evaluateDiagnosis(caseData, [
      snapshot(12, { crrtStartedTimestamp: '2026-09-01T12:00:00Z' }),
      snapshot(18, { crrtStartedTimestamp: '2026-09-01T12:00:00Z' }),
      snapshot(24, { creatinineMgDl: 1, urineVolumeMl: 720, urineObservationHours: 12, urineNormalizationWeightKg: 60, urineWeightBasis: 'actual' }),
    ]).find(item => item.id === 'aki-staging')!;
    expect(result.conclusion).toContain('KDIGO stage 3');
    expect(result.conclusion).not.toContain('暫定');
    expect(result.missingData.join(' ')).not.toContain('CRRT 病程時間戳互相矛盾');
  });
  it('keeps current staging provisional rather than inferring recovery when a start and stop are not reliably linked', () => {
    const result = evaluateDiagnosis(caseData, [
      snapshot(12, { crrtStartedTimestamp: '2026-09-01T12:00:00Z' }),
      snapshot(18, { crrtStoppedTimestamp: '2026-09-01T15:00:00Z' }),
      snapshot(24, { creatinineMgDl: 1, urineVolumeMl: 720, urineObservationHours: 12, urineNormalizationWeightKg: 60, urineWeightBasis: 'actual' }),
    ]).find(item => item.id === 'aki-staging')!;
    expect(result.conclusion).toContain('資料不足');
    expect(result.evidence.join(' ')).toContain('本次急性病程歷史最高 KDIGO stage 3');
    expect(result.missingData.join(' ')).toContain('無法可靠連結');
  });
  it('does not treat a planned future CRRT start as performed merely because later time passes without reconfirmation', () => {
    const result = evaluateDiagnosis(caseData, [
      snapshot(12, { crrtStartedTimestamp: '2026-09-01T20:00:00Z' }),
      snapshot(24, { creatinineMgDl: 1, urineVolumeMl: 720, urineObservationHours: 12, urineNormalizationWeightKg: 60, urineWeightBasis: 'actual' }),
    ]).find(item => item.id === 'aki-staging')!;
    expect(result.conclusion).not.toContain('stage 3');
    expect(result.missingData.join(' ')).toContain('晚於記錄它的觀察');
  });
  it('retains uncertainty for conflicting stops on the same CRRT start despite a later start', () => {
    const result = evaluateDiagnosis(caseData, [
      snapshot(18, { crrtStartedTimestamp: '2026-09-01T12:00:00Z', crrtStoppedTimestamp: '2026-09-01T16:00:00Z' }),
      snapshot(20, { crrtStartedTimestamp: '2026-09-01T12:00:00Z', crrtStoppedTimestamp: '2026-09-01T18:00:00Z' }),
      snapshot(22, { crrtStartedTimestamp: '2026-09-01T20:00:00Z' }),
      snapshot(24, { creatinineMgDl: 1, urineVolumeMl: 720, urineObservationHours: 12, urineNormalizationWeightKg: 60, urineWeightBasis: 'actual' }),
    ]).find(item => item.id === 'aki-staging')!;
    expect(result.conclusion).toContain('資料不足');
    expect(result.missingData.join(' ')).toContain('同一 CRRT 開始時間有互相矛盾的停止時間');
  });
  it('fails closed for overlapping linked CRRT pairs', () => {
    const result = evaluateDiagnosis(caseData, [
      { ...snapshot(20, { crrtStartedTimestamp: '2026-09-01T12:00:00Z', crrtStoppedTimestamp: '2026-09-01T20:00:00Z' }), id: 'pair-12-20' },
      { ...snapshot(22, { crrtStartedTimestamp: '2026-09-01T18:00:00Z', crrtStoppedTimestamp: '2026-09-01T22:00:00Z' }), id: 'pair-18-22' },
      snapshot(24, { urineVolumeMl: 720, urineObservationHours: 12, urineNormalizationWeightKg: 60, urineWeightBasis: 'actual' }),
    ]).find(item => item.id === 'aki-staging')!;
    expect(result.conclusion).toContain('資料不足');
    expect(result.missingData.join(' ')).toContain('成對病程區間');
  });
  it.each([
    ['inside completed interval', '2026-09-01T18:00:00Z'],
    ['at completed interval boundary', '2026-09-01T20:00:00Z'],
  ])('fails closed for an unlinked start %s', (_label, start) => {
    const result = evaluateDiagnosis(caseData, [
      { ...snapshot(20, { crrtStartedTimestamp: '2026-09-01T12:00:00Z', crrtStoppedTimestamp: '2026-09-01T20:00:00Z' }), id: 'pair-12-20' },
      { ...snapshot(21, { crrtStartedTimestamp: start }), id: `unlinked-${start}` },
      snapshot(24, { urineVolumeMl: 720, urineObservationHours: 12, urineNormalizationWeightKg: 60, urineWeightBasis: 'actual' }),
    ]).find(item => item.id === 'aki-staging')!;
    expect(result.conclusion).toContain('資料不足');
    expect(result.missingData.join(' ')).toContain('已完成病程區間');
  });
  it('fails closed for a zero-duration linked CRRT pair', () => {
    const result = evaluateDiagnosis(caseData, [
      snapshot(20, { crrtStartedTimestamp: '2026-09-01T20:00:00Z', crrtStoppedTimestamp: '2026-09-01T20:00:00Z' }),
      snapshot(24, { urineVolumeMl: 720, urineObservationHours: 12, urineNormalizationWeightKg: 60, urineWeightBasis: 'actual' }),
    ]).find(item => item.id === 'aki-staging')!;
    expect(result.conclusion).toContain('資料不足');
    expect(result.missingData.join(' ')).toContain('成對病程區間');
  });
  it('accepts strictly separated sequential linked CRRT pairs without creating ambiguity', () => {
    const result = evaluateDiagnosis(caseData, [
      snapshot(18, { crrtStartedTimestamp: '2026-09-01T12:00:00Z', crrtStoppedTimestamp: '2026-09-01T18:00:00Z' }),
      snapshot(22, { crrtStartedTimestamp: '2026-09-01T20:00:00Z', crrtStoppedTimestamp: '2026-09-01T22:00:00Z' }),
      snapshot(24, { urineVolumeMl: 720, urineObservationHours: 12, urineNormalizationWeightKg: 60, urineWeightBasis: 'actual' }),
    ]).find(item => item.id === 'aki-staging')!;
    expect(result.conclusion).not.toContain('資料不足');
    expect(result.conclusion).not.toContain('stage 3');
    expect(result.missingData.join(' ')).not.toContain('成對病程區間');
  });
  it('resolves citations and limits the early/late threshold to app-local scope', () => {
    const results = evaluateDiagnosis(caseData, [snapshot(24, { creatinineMgDl: 2 })]);
    for (const result of results) {
      expect(resolveDecisionSources(result).length).toBeGreaterThan(0);
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.counterfactuals.length).toBeGreaterThan(0);
    }
    const timing = results.find(item => item.id === 'sa-aki-timing')!;
    expect(resolveDecisionSources(timing).some(source => source.status === 'local')).toBe(true);
    expect(() => resolveRuleSources('sa-aki-early-late-local', ['ADQI_28'])).toThrow();
    expect(resolveRuleSources('aki-definition-staging', ['KDIGO_2012'])).toHaveLength(1);
  });
});
