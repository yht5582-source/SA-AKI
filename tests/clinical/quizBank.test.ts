import { calculateKdigoStage, evaluateDiagnosis } from '../../src/clinical/diagnosis';
import { evaluateFluid } from '../../src/clinical/fluid';
import { evaluateKrtInitiation } from '../../src/clinical/krt';
import { evaluateLiberation } from '../../src/clinical/liberation';
import { modalityAdvice } from '../../src/clinical/modalityAdvice';
import { selectKrtModality } from '../../src/clinical/modality';
import { calculatePrescription } from '../../src/clinical/prescription';
import { evaluateHaEligibility } from '../../src/clinical/ha';
import { evidenceSources } from '../../src/clinical/sources';
import type { ClinicalSnapshot, DecisionResult } from '../../src/clinical/types';
import { prescriptionInput } from '../../src/features/dashboard/evaluateDashboard';
import { findDemoCase } from '../../src/features/demo/demoCases';
import { passMark, questions, quizDomains } from '../../src/features/quiz/questions';

const correct = (id: string) => { const q = questions.find(item => item.id === id)!; return q.options[q.answer].text; };
const base: ClinicalSnapshot = { id: 's', caseId: 'c', timestamp: '2026-05-01T12:00:00Z', hoursFromSepsisOnset: 12, actualWeightKg: 70, onEcmo: false };
const snapshot = (patch: Partial<ClinicalSnapshot>): ClinicalSnapshot => ({ ...base, ...patch });
const rule = (results: DecisionResult[], id: string) => results.find(result => result.id === id)!;
const allNegative = { lifeThreateningElectrolyteDisturbance: false, dialyzableToxin: false, requiresControlledSodiumCorrection: false, uremicManifestations: [] as ClinicalSnapshot['uremicManifestations'], pulmonaryEdema: false };
const measured = { baselineSource: 'measured-outpatient' as const, baselineConfidence: 'high' as const };
const flows = { adultConfirmed: true, weightBasisReason: '無明顯水腫', deliveredTargetMlKgHr: 25, preBloodPumpMlHr: 0, perfusionAdequate: true, pressorTrend: 'stable' as const };

describe('question bank structure', () => {
  it('has 10 basic and 10 advanced single-best-answer questions', () => {
    expect(questions).toHaveLength(20);
    expect(new Set(questions.map(q => q.id)).size).toBe(20);
    expect(questions.filter(q => q.level === '基礎')).toHaveLength(10);
    expect(questions.filter(q => q.level === '高階')).toHaveLength(10);
    expect(passMark(20)).toBe(16); expect(passMark(10)).toBe(8);
    for (const q of questions) {
      expect(new Set(q.options.map(option => option.text)).size).toBe(4);
      for (const option of q.options) expect(option.why.length).toBeGreaterThan(0);
    }
  });
  it('covers every clinical domain of the app', () => {
    expect(quizDomains).toEqual(['診斷與分期', '液體管理', 'KRT 啟動', '模式選擇', 'CRRT 處方', 'CRRT 脫離', '血液吸附']);
  });
  it('cites only registered, verified sources and links only real demo cases', () => {
    for (const q of questions) {
      expect(q.sourceIds.length).toBeGreaterThan(0);
      for (const id of q.sourceIds) expect(evidenceSources[id]?.verification, `${q.id} ${id}`).toBe('verified');
      if (q.demoId) expect(findDemoCase(q.demoId), q.id).toBeDefined();
    }
  });
  it('does not make the correct option guessable by length or position', () => {
    const longest = questions.filter(q => Math.max(...q.options.map(option => option.text.length)) === q.options[q.answer].text.length);
    expect(longest.length).toBeLessThanOrEqual(10);
    for (const position of [0, 1, 2, 3]) expect(questions.filter(q => q.answer === position).length).toBeGreaterThanOrEqual(2);
  });
});

// Each answer is tied to the same engine the dashboard runs, so a future rule change fails here.
describe('basic answers agree with the engine', () => {
  it('q01 SCr 2.2-fold with normal urine is stage 2', () => {
    const result = calculateKdigoStage({ currentCreatinineMgDl: 2, baselineCreatinineMgDl: 0.9, baselineAgeHours: 72, ...measured, urineVolumeMl: 336, urineObservationHours: 6, urineWeightKg: 70 });
    expect(result.stage).toBe(2); expect(result.urineStage).toBe(0); expect(correct('q01')).toBe('第 2 期');
  });
  it('q02 first AKI at 200 h is outside the window', () => {
    const at200 = snapshot({ id: 'late', timestamp: '2026-05-09T08:00:00Z', hoursFromSepsisOnset: 200, creatinineMgDl: 3 });
    const results = evaluateDiagnosis({ id: 'c', anonymousCode: 'x', sepsisOnsetTimestamp: '2026-05-01T00:00:00Z', baselineCreatinineMgDl: 1, baselineCreatinineSource: 'measured-outpatient', baselineCreatinineConfidence: 'high', baselineCreatinineTimestamp: '2026-05-08T00:00:00Z' }, [at200]);
    expect(rule(results, 'sa-aki-timing').conclusion).toContain('outside');
    expect(correct('q02')).toContain('超出 7 天窗');
  });
  it('q03 responsive but intolerant blocks more fluid', () => {
    const results = evaluateFluid(snapshot({ passiveLegRaiseResult: 'responsive', vtiResponsePercent: 12, lungBLines: 'bilateral-diffuse', vexusGrade: 2, pao2Fio2RatioMmHg: 148, respiratorySupport: 'invasive-ventilation', mapMmHg: 68, lactateMmolL: 2.5, capillaryRefillSeconds: 3, norepinephrineEquivalentMcgKgMin: 0.1, vasopressorTrend: 'unchanged' }));
    expect(rule(results, 'fluid-plan').conclusion).toContain('responsiveness 與 tolerance 衝突');
    expect(correct('q03')).toContain('不追加輸液');
  });
  it('q04 static measures alone do not produce a challenge', () => {
    const results = evaluateFluid(snapshot({ mapMmHg: 70, lactateMmolL: 3, cvpMmHg: 4, ivcRespiratoryVariationPercent: 60, pulmonaryEdema: false, lungBLines: 'absent', vexusGrade: 0, respiratorySupport: 'room-air' }));
    expect(rule(results, 'fluid-plan').conclusion).toContain('不可直接追加輸液');
    expect(rule(results, 'fluid-dynamic-assessment').conclusion).toContain('未知');
    expect(correct('q04')).toContain('PLR');
  });
  it('q05 stage 3 with no danger stays deferred', () => {
    const result = evaluateKrtInitiation(snapshot({ ...allNegative, bunMgDl: 110, potassiumMmolL: 5.2, arterialPh: 7.3 }))[0];
    expect(result.conclusion).toContain('deferred with reassessment');
    expect(correct('q05')).toContain('不開始 RRT');
  });
  it('q06 only uremic pericarditis is a confirmed indication', () => {
    const screen = { ...allNegative, potassiumMmolL: 4.5, arterialPh: 7.35 };
    expect(evaluateKrtInitiation(snapshot({ ...screen, uremicManifestations: ['pericarditis'] }))[0].severity).toBe('critical');
    for (const distractor of [{ bunMgDl: 120 }, { urineVolumeMl: 0, urineObservationHours: 14 }, { sofaScore: 12 }]) {
      expect(evaluateKrtInitiation(snapshot({ ...screen, ...distractor }))[0].severity).not.toBe('critical');
    }
    expect(correct('q06')).toBe('確認的尿毒性心包炎');
  });
  it('q07 ICP risk favours CRRT even when hemodynamically stable', () => {
    const results = selectKrtModality({ mapMmHg: 80, norepinephrineEquivalentMcgKgMin: 0, vasopressorTrend: 'unchanged', lactateMmolL: 1.2, hemodynamicTolerance: 'stable', intracranialPressureRisk: true, rapidSoluteClearanceNeeded: true, preciseFluidElectrolyteControlNeeded: false });
    expect(rule(results, 'krt-modality-selection').conclusion).toContain('CRRT review');
    expect(correct('q07')).toBe('CRRT');
  });
  it('q08 downtime compensation is 2,188 mL/h', () => {
    const result = calculatePrescription({ ...flows, actualWeightKg: 70, weightBasis: 'actual', mode: 'CVVHD', bloodFlowMlMin: 150, hematocritFraction: 0.3, dialysateMlHr: 2000, preReplacementMlHr: 0, postReplacementMlHr: 0, requestedUfNetMlHr: 0, downtimeFraction: 0.2 });
    expect(result.totalEffluentMlHr).toBe(2188);
    expect(correct('q08')).toBe('2,188 mL/h');
  });
  it('q09 refractory K is an indication and the distractors are not', () => {
    expect(evaluateKrtInitiation(snapshot({ ...allNegative, potassiumMmolL: 6.5, refractoryHyperkalemia: true, arterialPh: 7.3 }))[0].severity).toBe('critical');
    for (const distractor of [{ creatinineMgDl: 2.1 }, { bunMgDl: 60 }, { cumulativeFluidBalanceMl: 300 }]) {
      expect(evaluateKrtInitiation(snapshot({ ...allNegative, potassiumMmolL: 4.5, arterialPh: 7.36, ...distractor }))[0].severity).not.toBe('critical');
    }
    expect(correct('q09')).toContain('血鉀 6.5');
  });
  it('q10 a high IL-6 and opt-in alone do not pass the HA gates', () => {
    const evaluation = evaluateHaEligibility({ snapshot: snapshot({ il6PgMl: 50000, hemoadsorptionAssessment: { optedIn: true, requestedDevice: 'CytoSorb', targetAdsorbate: 'cytokines' } }) });
    expect(evaluation.status).not.toBe('multidisciplinary-review');
    expect(correct('q10')).toContain('SSC 2026');
  });
});

describe('advanced answers agree with the engine', () => {
  it('q11 an unreliable baseline is provisional until serial measurements confirm stage 3', () => {
    const baseline = { baselineCreatinineMgDl: 0.9, baselineSource: 'back-calculated' as const, baselineConfidence: 'low' as const };
    const first = calculateKdigoStage({ currentCreatinineMgDl: 5, ...baseline });
    expect(first.stage).toBe(3); expect(first.provisional).toBe(true);
    const second = calculateKdigoStage({ currentCreatinineMgDl: 7.2, ...baseline, priorCreatinineMeasurements: [{ creatinineMgDl: 5, hoursAgo: 48 }] });
    expect(second.stage).toBe(3); expect(second.provisional).toBe(false);
    expect(correct('q11')).toContain('第 72 小時暫定');
  });
  it('q12 current stage after a stopped episode is separate from historical stage 3', () => {
    const start = '2026-05-03T00:00:00Z';
    const patient = { id: 'c', anonymousCode: 'x', baselineCreatinineMgDl: 1, baselineCreatinineSource: 'measured-outpatient' as const, baselineCreatinineConfidence: 'high' as const, baselineCreatinineTimestamp: '2026-05-01T00:00:00Z' };
    const earlier = snapshot({ id: 'a', timestamp: '2026-05-05T00:00:00Z', creatinineMgDl: 1.7, crrtStartedTimestamp: start });
    const current = snapshot({ id: 'b', timestamp: '2026-05-07T00:00:00Z', creatinineMgDl: 1.3, urineVolumeMl: 1008, urineObservationHours: 24, urineWeightBasis: 'actual', urineNormalizationWeightKg: 70, crrtStartedTimestamp: start, crrtStoppedTimestamp: '2026-05-06T00:00:00Z' });
    const staging = rule(evaluateDiagnosis(patient, [earlier, current], 'b'), 'aki-staging');
    expect(staging.conclusion).toContain('未達 AKI 條件');
    expect(staging.evidence.join()).toContain('歷史最高 KDIGO stage 3');
    expect(correct('q12')).toContain('歷史最高第 3 期另記');
  });
  it('q13 a measured pressor rise overrides the label, zeroes UFNET and blocks the checklist', () => {
    const previous = snapshot({ id: 'p', timestamp: '2026-05-01T08:00:00Z', norepinephrineEquivalentMcgKgMin: 0.1, lactateMmolL: 1.5 });
    const current = snapshot({ norepinephrineEquivalentMcgKgMin: 0.25, vasopressorTrend: 'unchanged', lactateMmolL: 1.6, ufNetMlHours: 100, crrtDoseWeightBasis: 'actual', crrtDoseWeightKg: 70, crrtMode: 'CVVHD', crrtDowntimeHours: 0, crrtObservationHours: 4, prescriptionAssessment: { adultConfirmed: true, weightBasisReason: 'x', deliveredTargetMlKgHr: 25, dialysateMlHr: 1800, preReplacementMlHr: 0, postReplacementMlHr: 0, preBloodPumpMlHr: 0, bloodFlowMlMin: 150, hematocritFraction: 0.3, perfusionAdequate: true } });
    const input = prescriptionInput({ id: 'c', anonymousCode: 'x' }, current, previous);
    expect(input.pressorTrend).toBe('rising');
    expect(input.perfusionConflictReasons?.length).toBeGreaterThan(0);
    const result = calculatePrescription(input);
    expect(result.ufNetMlHr).toBe(0); expect(result.checklistComplete).toBe(false);
    expect(correct('q13')).toContain('UFNET 歸零');
  });
  it('q14 discordant VTI and SV stay unknown and block a challenge', () => {
    const results = evaluateFluid(snapshot({ passiveLegRaiseResult: 'responsive', vtiResponsePercent: 14, strokeVolumeResponsePercent: 6, pulmonaryEdema: false, lungBLines: 'absent', vexusGrade: 0, pao2Fio2RatioMmHg: 300, respiratorySupport: 'conventional-oxygen', lactateMmolL: 3.2, capillaryRefillSeconds: 4 }));
    expect(rule(results, 'fluid-dynamic-assessment').conclusion).toContain('未知');
    expect(rule(results, 'fluid-plan').conclusion).toContain('不可直接追加輸液');
    expect(correct('q14')).toContain('判為未知');
  });
  it('q15 a refractory label without concordant oxygenation is urgent confirmation', () => {
    const result = evaluateKrtInitiation(snapshot({ ...allNegative, pulmonaryEdema: true, refractoryPulmonaryEdema: true, pao2Fio2RatioMmHg: 260, respiratorySupport: 'conventional-oxygen', potassiumMmolL: 4.5, arterialPh: 7.38 }))[0];
    expect(result.severity).toBe('warning');
    expect(result.conclusion).toContain('urgent confirmation');
    expect(correct('q15')).toContain('立即確認');
  });
  it('q16 pH 7.16 without a treatment response is urgent confirmation', () => {
    const result = evaluateKrtInitiation(snapshot({ ...allNegative, arterialPh: 7.16, bicarbonateMmolL: 13, potassiumMmolL: 5 }))[0];
    expect(result.conclusion).toContain('urgent confirmation');
    expect(correct('q16')).toContain('bicarbonate');
  });
  it('q17 a conflicting stable label withholds a mode', () => {
    const modality = rule(selectKrtModality({ mapMmHg: 68, norepinephrineEquivalentMcgKgMin: 0.15, vasopressorTrend: 'unchanged', lactateMmolL: 3.8, hemodynamicTolerance: 'stable', intracranialPressureRisk: false, rapidSoluteClearanceNeeded: true, preciseFluidElectrolyteControlNeeded: false }), 'krt-modality-selection');
    const indication = evaluateKrtInitiation(snapshot({ ...allNegative, potassiumMmolL: 6.8, refractoryHyperkalemia: true, arterialPh: 7.3 }))[0];
    expect(modalityAdvice(indication, modality)).toContain('模式資料互相衝突');
    expect(correct('q17')).toContain('暫不選定模式');
  });
  it('q18 delivered estimate corrects for both pre-dilution and downtime', () => {
    const result = calculatePrescription({ ...flows, adjustedWeightKg: 82, actualWeightKg: 96, weightBasis: 'adjusted', mode: 'CVVHDF', bloodFlowMlMin: 180, hematocritFraction: 0.3, dialysateMlHr: 1200, preReplacementMlHr: 600, postReplacementMlHr: 400, requestedUfNetMlHr: 100, downtimeFraction: 1 / 12 });
    expect(result.estimatedDeliveredMlKgHr).toBe(23.8);
    expect(correct('q18')).toBe('23.8');
  });
  it('q19 flow beyond the plasma ceiling withholds the calculation', () => {
    const result = calculatePrescription({ ...flows, actualWeightKg: 100, weightBasis: 'actual', mode: 'CVVHD', bloodFlowMlMin: 60, hematocritFraction: 0.35, dialysateMlHr: 2800, preReplacementMlHr: 0, postReplacementMlHr: 0, requestedUfNetMlHr: 0, downtimeFraction: 0.1 });
    expect(result.totalEffluentMlHr).toBeUndefined();
    expect(result.missingData.join()).toContain('saturation');
    expect(correct('q19')).toContain('血漿流量上限');
  });
  it('q20 overlapping urine windows block an otherwise ready trial-off', () => {
    const [prior, ready] = findDemoCase('demo-t4')!.timepoints.slice(0, 2).map(point => point.snapshot);
    expect(evaluateLiberation(ready, [prior, ready])[0].conclusion).toContain('consider supervised trial-off');
    const overlapping = { ...prior, timestamp: new Date(Date.parse(ready.timestamp) - 12 * 3_600_000).toISOString() };
    const result = evaluateLiberation(ready, [overlapping, ready])[0];
    expect(result.conclusion).toContain('continue and reassess');
    expect(result.evidence.join()).toContain('overlapping urine collection');
    expect(correct('q20')).toContain('區間重疊');
  });
});
