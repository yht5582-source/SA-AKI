import { classifyRosePhase, evaluateFluid } from '../../src/clinical/fluid';
import { resolveDecisionSources, resolveRuleSources } from '../../src/clinical/sources';
import type { ClinicalSnapshot, DecisionResult } from '../../src/clinical/types';

const snapshot = (extra: Partial<ClinicalSnapshot> = {}): ClinicalSnapshot => ({
  id: 'current', caseId: 'case-1', timestamp: '2026-09-01T02:00:00Z',
  hoursFromSepsisOnset: 2, actualWeightKg: 70, onEcmo: false, ...extra,
});
const clearTolerance: Partial<ClinicalSnapshot> = { lungBLines: 'absent', pulmonaryEdema: false, vexusGrade: 0, respiratorySupport: 'room-air', pao2Fio2RatioMmHg: 400 };
const stable: Partial<ClinicalSnapshot> = { mapMmHg: 70, lactateMmolL: 1.5, capillaryRefillSeconds: 2, norepinephrineEquivalentMcgKgMin: 0, vasopressorTrend: 'unchanged' };
const prior = (extra: Partial<ClinicalSnapshot> = {}) => snapshot({ id: 'previous', timestamp: '2026-09-01T01:00:00Z', hoursFromSepsisOnset: 1, ...extra });
const byId = (results: DecisionResult[], id: string) => results.find(result => result.id === id)!;
const result = (extra: Partial<ClinicalSnapshot>, id = 'fluid-dynamic-assessment') => byId(evaluateFluid(snapshot(extra)), id);
const text = (decision: DecisionResult) => [decision.conclusion, ...decision.evidence, ...decision.actions, ...decision.missingData].join(' ');

describe('fluid decisions explain their own clinical triggers', () => {
  // Catches a challenge card omitting the actual perfusion trigger while citing PLR alone.
  it.each([
    [{ mapMmHg: 60 }, 'MAP 60 mmHg'],
    [{ lactateMmolL: 4 }, 'lactate 4 mmol/L'],
    [{ capillaryRefillSeconds: 4 }, 'CRT 4 s'],
    [{ vasopressorTrend: 'worsening' }, '趨勢 worsening'],
    [{ skinMottling: true }, 'mottling true'],
    [{ peripheralTemperature: 'cool' }, '周邊溫度 cool'],
    [{ mentalStatus: 'altered' }, '意識 altered'],
  ] satisfies [Partial<ClinicalSnapshot>, string][])('includes the challenge-triggering observation %j in that card', (extra, observation) => {
    const plan = result({ ...stable, ...clearTolerance, passiveLegRaiseResult: 'responsive', vtiResponsePercent: 15, urineVolumeMl: 123, urineObservationHours: 6, ...extra }, 'fluid-plan');
    expect(plan.conclusion).toContain('可考慮');
    expect(plan.evidence.join(' ')).toContain(observation);
    expect(plan.evidence.join(' ')).not.toContain('尿量 123');
  });
  it('includes rising lactate that triggers a challenge despite an in-range current value', () => {
    const decisions = evaluateFluid(snapshot({ ...stable, ...clearTolerance, passiveLegRaiseResult: 'responsive', vtiResponsePercent: 15, lactateMmolL: 1.9 }), prior({ lactateMmolL: 1 }));
    const plan = byId(decisions, 'fluid-plan');
    expect(plan.conclusion).toContain('可考慮');
    expect(plan.evidence.join(' ')).toContain('1 → 1.9 mmol/L');
  });
  // Catches evacuation claims detached from the actual congestion observation.
  it.each([
    [{ pulmonaryEdema: true }, '肺水腫 true'],
    [{ lungBLines: 'bilateral-diffuse' }, 'B-lines bilateral-diffuse'],
    [{ vexusGrade: 3 }, 'VExUS 3'],
  ] satisfies [Partial<ClinicalSnapshot>, string][])('includes the evacuation-triggering congestion %j in the ROSE card', (extra, observation) => {
    const rose = result({ ...stable, cumulativeFluidBalanceMl: 4000, passiveLegRaiseResult: 'responsive', vtiResponsePercent: 15, ...extra }, 'fluid-rose');
    expect(rose.conclusion).toContain('evacuation');
    expect(rose.evidence.join(' ')).toContain(observation);
    expect(rose.evidence.join(' ')).toContain('累積平衡 4000 mL');
    expect(rose.evidence.join(' ')).not.toContain('PLR responsive');
  });
  it('explains optimization due to rising respiratory support despite reassuring perfusion', () => {
    const decisions = evaluateFluid(snapshot({ ...stable, ...clearTolerance, respiratorySupport: 'invasive-ventilation' }), prior({ respiratorySupport: 'conventional-oxygen' }));
    const rose = byId(decisions, 'fluid-rose');
    expect(rose.conclusion).toContain('optimization');
    expect(rose.evidence.join(' ')).toContain('呼吸支持 invasive-ventilation');
    expect(rose.evidence.join(' ')).toContain('近期氧合惡化 有訊號');
  });
  it('explains optimization due to declining P/F despite reassuring perfusion', () => {
    const decisions = evaluateFluid(snapshot({ ...stable, ...clearTolerance, pao2Fio2RatioMmHg: 180 }), prior({ pao2Fio2RatioMmHg: 300 }));
    const rose = byId(decisions, 'fluid-rose');
    expect(rose.conclusion).toContain('optimization');
    expect(rose.evidence.join(' ')).toContain('P/F 180 mmHg');
    expect(rose.evidence.join(' ')).toContain('近期氧合惡化 有訊號');
  });
  it('carries missing congestion, oxygenation and accumulation context on the ROSE card without unrelated tests', () => {
    const rose = result({ ...stable }, 'fluid-rose');
    expect(rose.missingData).toContain('肺水腫評估');
    expect(rose.missingData).toContain('可解讀的肺超音波 B-lines 與病因');
    expect(rose.missingData).toContain('完整靜脈充血／VExUS 評估');
    expect(rose.missingData.join(' ')).toContain('氧合及呼吸支持趨勢');
    expect(rose.missingData).toContain('累積液體平衡及記錄期間');
    expect(rose.missingData).toContain('相對同一基準的體重變化');
    expect(rose.missingData.join(' ')).not.toContain('PLR');
    expect(rose.missingData.join(' ')).not.toContain('尿量');
  });
});

describe('fluid responsiveness and tolerance are independent', () => {
  // Catches default-normal/false for unmeasured axes and silent unqualified boluses.
  it('preserves missing dynamic and tolerance data as unknown', () => {
    expect(result({}).conclusion).toContain('未知');
    expect(result({}, 'fluid-tolerance').conclusion).toContain('未知');
    expect(result({}).missingData.join(' ')).toContain('PLR');
    expect(result({}, 'fluid-plan').conclusion).toContain('不可直接追加輸液');
  });
  // Catches changing the operational 10% inclusive boundary, or accepting a measurement without PLR context.
  it.each(['vtiResponsePercent', 'strokeVolumeResponsePercent'] as const)('uses %s at the inclusive local PLR response boundary', field => {
    expect(result({ passiveLegRaiseResult: 'responsive', [field]: 10 }).conclusion).toContain('陽性');
    expect(result({ passiveLegRaiseResult: 'nonresponsive', [field]: 9.999 }).conclusion).toContain('陰性');
    expect(result({ passiveLegRaiseResult: 'nonresponsive', [field]: 0 }).conclusion).toContain('陰性');
    expect(result({ passiveLegRaiseResult: 'nonresponsive', [field]: -5 }).conclusion).toContain('陰性');
    expect(result({ [field]: 15 }).conclusion).toContain('未知');
  });
  it('does not substitute qualitative PLR alone for measured VTI/SV', () => {
    expect(result({ passiveLegRaiseResult: 'responsive' }).conclusion).toContain('未知');
  });
  it.each([
    { passiveLegRaiseResult: 'responsive', vtiResponsePercent: 5 },
    { passiveLegRaiseResult: 'nonresponsive', strokeVolumeResponsePercent: 15 },
    { passiveLegRaiseResult: 'responsive', strokeVolumeResponsePercent: 15, vtiResponsePercent: 5 },
    { passiveLegRaiseResult: 'indeterminate', strokeVolumeResponsePercent: 15 },
    { passiveLegRaiseResult: 'not-performed', strokeVolumeResponsePercent: 15 },
  ] satisfies Partial<ClinicalSnapshot>[])('does not resolve inconsistent or indeterminate dynamic tests as responsive: %j', extra => {
    expect(result(extra).conclusion).toContain('未知');
    expect(result(extra, 'fluid-plan').conclusion).toContain('不可直接追加輸液');
  });
  it.each([{ cvpMmHg: 2 }, { cvpMmHg: 20 }, { ivcDiameterMm: 8, ivcRespiratoryVariationPercent: 60 }])('never uses static-only input %j to trigger fluid', extra => {
    expect(result(extra).conclusion).toContain('未知');
    expect(result(extra, 'fluid-plan').conclusion).toContain('不可直接追加輸液');
    expect(result(extra).actions.join(' ')).toContain('PLR');
  });
  // Catches a positive response overriding a safety blocker.
  it.each([{ lungBLines: 'bilateral-diffuse' }, { vexusGrade: 2 }, { vexusGrade: 3 }, { pulmonaryEdema: true }] satisfies Partial<ClinicalSnapshot>[])('blocks unqualified bolus despite responsiveness when intolerance is %j', extra => {
    const results = evaluateFluid(snapshot({ passiveLegRaiseResult: 'responsive', strokeVolumeResponsePercent: 15, ...extra }));
    expect(byId(results, 'fluid-tolerance').conclusion).toContain('不佳');
    const plan = byId(results, 'fluid-plan');
    expect(plan.conclusion).toContain('不可直接追加輸液');
    expect(plan.conclusion).toContain('衝突');
    expect(plan.actions).toContain('重新確認 shock phenotype 並考慮升壓或去充血策略');
    expect(text(plan)).toContain('停止');
    expect(plan.reassessWithinHours).toBeLessThanOrEqual(0.25);
  });
  it('keeps incomplete or equivocal tolerance unknown even with a negative edema field', () => {
    expect(result({ pulmonaryEdema: false }, 'fluid-tolerance').conclusion).toContain('未知');
    expect(result({ ...clearTolerance, lungBLines: 'focal' }, 'fluid-tolerance').conclusion).toContain('未知');
    expect(result({ ...clearTolerance, vexusGrade: 1 }, 'fluid-tolerance').conclusion).toContain('未知');
  });
  // Catches reassuring lung/venous fields overriding missing oxygenation or a cardiac warning.
  it.each([
    { respiratorySupport: undefined, pao2Fio2RatioMmHg: undefined },
    { respiratorySupport: 'invasive-ventilation', pao2Fio2RatioMmHg: undefined },
    { pao2Fio2RatioMmHg: 199.999 },
    { rvFunction: 'impaired' },
    { rvDilation: true },
    { lvSystolicFunction: 'severely-reduced' },
  ] satisfies Partial<ClinicalSnapshot>[])('withholds challenge until additional tolerance concern is reviewed: %j', extra => {
    const results = evaluateFluid(snapshot({ ...clearTolerance, passiveLegRaiseResult: 'responsive', vtiResponsePercent: 15, mapMmHg: 60, ...extra }));
    expect(byId(results, 'fluid-tolerance').conclusion).toContain('未知');
    expect(byId(results, 'fluid-plan').conclusion).toContain('不可直接追加輸液');
    expect(byId(results, 'fluid-tolerance').missingData.length).toBeGreaterThan(0);
  });
  it('allows review at the local oxygenation-screen boundary without interpreting hypoxemia as edema', () => {
    expect(result({ ...clearTolerance, pao2Fio2RatioMmHg: 200 }, 'fluid-tolerance').conclusion).toContain('未見');
    expect(result({ ...clearTolerance, pao2Fio2RatioMmHg: 150 }, 'fluid-tolerance').conclusion).not.toContain('不佳');
  });
  it('offers only clinician-reviewed monitored challenge when response, tolerance and perfusion need align', () => {
    const plan = result({ ...clearTolerance, mapMmHg: 60, passiveLegRaiseResult: 'responsive', vtiResponsePercent: 15 }, 'fluid-plan');
    expect(plan.conclusion).toContain('可考慮');
    expect(plan.actions.join(' ')).toMatch(/VTI.*SV|SV.*VTI/);
    expect(plan.actions.join(' ')).toContain('停止');
    expect(plan.actions.join(' ')).toContain('臨床醫師');
    expect(plan.reassessWithinHours).toBeLessThanOrEqual(0.25);
  });
  it('does not treat responsiveness as proof that fluid is needed', () => {
    expect(result({ ...stable, ...clearTolerance, passiveLegRaiseResult: 'responsive', vtiResponsePercent: 15 }, 'fluid-plan').conclusion).toContain('不可直接追加輸液');
  });
  it('does not recommend a challenge for a negative response with poor perfusion', () => {
    expect(result({ ...clearTolerance, mapMmHg: 60, passiveLegRaiseResult: 'nonresponsive', vtiResponsePercent: 5 }, 'fluid-plan').conclusion).toContain('不可直接追加輸液');
  });
});

describe('fluid trajectory and ROSE safety', () => {
  // Catches unobserved perfusion being labeled stable or an elapsed-time-only phase.
  it('labels missing phase data provisional rather than stable', () => {
    expect(classifyRosePhase(snapshot())).toBe('optimization');
    expect(result({}, 'fluid-rose').conclusion).toContain('暫定');
    expect(result({}, 'fluid-rose').missingData.length).toBeGreaterThan(0);
  });
  it.each([
    [{ mapMmHg: 64.999 }, 'resuscitation'],
    [{ ...stable, mapMmHg: 65 }, 'stabilization'],
    [{ ...stable, lactateMmolL: 2.001 }, 'optimization'],
    [{ ...stable, lactateMmolL: 2, capillaryRefillSeconds: 3 }, 'stabilization'],
    [{ ...stable, capillaryRefillSeconds: 3.001 }, 'optimization'],
    [{ ...stable, vasopressorTrend: 'worsening' }, 'resuscitation'],
    [{ ...stable, cumulativeFluidBalanceMl: 4000, lungBLines: 'bilateral-diffuse' }, 'evacuation'],
    [{ ...stable, bodyWeightChangeKg: 4, vexusGrade: 3 }, 'evacuation'],
    [{ ...stable, cumulativeFluidBalanceMl: 4000 }, 'stabilization'],
  ] satisfies [Partial<ClinicalSnapshot>, string][])('classifies the reviewed snapshot %j as %s', (extra, phase) => {
    expect(classifyRosePhase(snapshot(extra))).toBe(phase);
    expect(classifyRosePhase(snapshot({ ...extra, hoursFromSepsisOnset: 300 }))).toBe(phase);
  });
  it('uses cumulative balance and weight gain as context, not proof of overload or a removal order', () => {
    const balance = result({ ...stable, cumulativeFluidBalanceMl: 5000, bodyWeightChangeKg: 4 }, 'fluid-balance');
    expect(text(balance)).toContain('5000');
    expect(text(balance)).toContain('4 kg');
    expect(text(balance)).toContain('不等同');
    expect(result({ ...stable, cumulativeFluidBalanceMl: 5000 }, 'fluid-ufnet').conclusion).toContain('不自動');
  });
  it('preserves discordant weight and balance instead of treating either as an order', () => {
    expect(text(result({ cumulativeFluidBalanceMl: 5000, bodyWeightChangeKg: -3 }, 'fluid-balance'))).toContain('不一致');
  });
  it('distinguishes zero urine over an observed interval from missing or untimed urine', () => {
    expect(text(result({ urineVolumeMl: 0, urineObservationHours: 12 }, 'fluid-balance'))).toContain('無尿');
    expect(result({ urineObservationHours: 12 }, 'fluid-balance').missingData.join(' ')).toContain('尿量');
    expect(result({ urineVolumeMl: 0 }, 'fluid-balance').missingData.join(' ')).toContain('觀察時數');
    expect(result({ urineVolumeMl: 0, urineObservationHours: 12 }, 'fluid-plan').conclusion).toContain('不可直接追加輸液');
  });
  it('blocks de-resuscitation when pressors rise numerically despite an unchanged label', () => {
    const results = evaluateFluid(snapshot({ ...stable, norepinephrineEquivalentMcgKgMin: 0.2, cumulativeFluidBalanceMl: 5000, vexusGrade: 3 }), prior({ norepinephrineEquivalentMcgKgMin: 0.1 }));
    expect(byId(results, 'fluid-rose').conclusion).toContain('resuscitation');
    expect(byId(results, 'fluid-ufnet').conclusion).toContain('UFNET 0');
    expect(text(byId(results, 'fluid-ufnet'))).toContain('不一致');
  });
  it.each([{ vasopressorTrend: 'worsening' }, { mapMmHg: 60 }, { lactateMmolL: 4 }, { capillaryRefillSeconds: 4 }] satisfies Partial<ClinicalSnapshot>[])('uses zero-default UFNET safety review in unstable/perfusion-risk state %j', extra => {
    const uf = result({ ...stable, cumulativeFluidBalanceMl: 5000, vexusGrade: 3, ...extra }, 'fluid-ufnet');
    expect(uf.conclusion).toContain('UFNET 0');
    expect(text(uf)).toContain('非機器處方');
    expect(uf.reassessWithinHours).toBeLessThanOrEqual(0.25);
  });
  it('offers gradual clinician-reviewed removal only for stable congestion', () => {
    const uf = result({ ...stable, cumulativeFluidBalanceMl: 5000, vexusGrade: 3 }, 'fluid-ufnet');
    expect(uf.conclusion).toContain('漸進去復甦');
    expect(text(uf)).toContain('非機器處方');
    expect(uf.actions.join(' ')).toContain('停止');
  });
  it('does not infer stability from an isolated normal MAP', () => {
    expect(result({ mapMmHg: 70, vexusGrade: 3, cumulativeFluidBalanceMl: 5000 }, 'fluid-ufnet').conclusion).not.toContain('可考慮漸進');
  });
  it('blocks fluid and removal escalation when oxygenation worsens between comparable snapshots', () => {
    const results = evaluateFluid(snapshot({ ...stable, ...clearTolerance, pao2Fio2RatioMmHg: 180, cumulativeFluidBalanceMl: 5000, vexusGrade: 3, passiveLegRaiseResult: 'responsive', vtiResponsePercent: 15 }), prior({ pao2Fio2RatioMmHg: 300 }));
    expect(byId(results, 'fluid-tolerance').conclusion).toContain('不佳');
    expect(byId(results, 'fluid-plan').conclusion).toContain('不可直接追加輸液');
    expect(byId(results, 'fluid-ufnet').conclusion).toContain('不自動');
  });
  // Catches worsening bedside perfusion being hidden by in-range MAP/CRT/lactate.
  it.each([{ skinMottling: true }, { peripheralTemperature: 'cool' }, { mentalStatus: 'altered' }] satisfies Partial<ClinicalSnapshot>[])('does not claim stable removal readiness with %j', extra => {
    const results = evaluateFluid(snapshot({ ...stable, cumulativeFluidBalanceMl: 5000, vexusGrade: 3, ...extra }));
    expect(byId(results, 'fluid-ufnet').conclusion).toContain('UFNET 0');
    expect(byId(results, 'fluid-rose').conclusion).toContain('optimization');
  });
  it('does not interpret rising lactate as stability merely because both values are below 2', () => {
    const results = evaluateFluid(snapshot({ ...stable, lactateMmolL: 1.9, cumulativeFluidBalanceMl: 5000, vexusGrade: 3 }), prior({ lactateMmolL: 1 }));
    expect(byId(results, 'fluid-ufnet').conclusion).toContain('UFNET 0');
    expect(byId(results, 'fluid-ufnet').evidence.join(' ')).toContain('1 → 1.9');
  });
  it('recognizes rising respiratory support even without serial P/F ratio', () => {
    const results = evaluateFluid(snapshot({ ...clearTolerance, respiratorySupport: 'invasive-ventilation' }), prior({ respiratorySupport: 'conventional-oxygen' }));
    expect(byId(results, 'fluid-tolerance').conclusion).toContain('不佳');
  });
  it('does not use stale prior observations to establish a reassuring trajectory', () => {
    const results = evaluateFluid(snapshot({ ...stable, norepinephrineEquivalentMcgKgMin: 0.2 }), prior({ timestamp: '2026-08-30T01:00:00Z', norepinephrineEquivalentMcgKgMin: 0.1 }));
    expect(byId(results, 'fluid-rose').missingData.join(' ')).toContain('6 h');
  });
  it.each([
    ['2026-08-31T20:00:00.000Z', 'resuscitation', false],
    ['2026-08-31T19:59:59.999Z', 'optimization', true],
  ] as const)('includes a prior at exactly 6 h but rejects one millisecond older: %s', (timestamp, phase, stale) => {
    const decisions = evaluateFluid(snapshot({ ...stable, norepinephrineEquivalentMcgKgMin: 0.2 }), prior({ timestamp, hoursFromSepsisOnset: -4, norepinephrineEquivalentMcgKgMin: 0.1 }));
    const rose = byId(decisions, 'fluid-rose');
    expect(rose.conclusion).toContain(phase);
    expect(rose.missingData.some(item => item.includes('≤6 h'))).toBe(stale);
    expect(byId(decisions, 'fluid-ufnet').conclusion).not.toContain('可考慮漸進');
  });
  it.each([{ lactateMmolL: NaN }, { actualWeightKg: 0 }, { timestamp: 'not-a-date' }])('rejects schema-invalid prior %j before comparing trends', extra => {
    expect(() => evaluateFluid(snapshot(stable), prior(extra))).toThrow();
  });
  it.each([{ caseId: 'different' }, { timestamp: '2026-09-01T03:00:00Z' }, { timestamp: '2026-09-01T02:00:00Z' }] as Partial<ClinicalSnapshot>[])('rejects incomparable prior snapshots %j', extra => {
    expect(() => evaluateFluid(snapshot(), prior(extra))).toThrow();
  });
  it('rejects nonfinite direct-call input before emitting decisions', () => {
    expect(() => evaluateFluid(snapshot({ vtiResponsePercent: NaN }))).toThrow();
  });
  it('emits deterministic explainable decisions with scoped executable sources and no input mutation', () => {
    const input = Object.freeze(snapshot({ ...stable, ...clearTolerance }));
    const decisions = evaluateFluid(input);
    expect(evaluateFluid(input)).toEqual(decisions);
    for (const decision of decisions) {
      expect(decision.actions.length).toBeGreaterThan(0);
      expect(decision.counterfactuals.length).toBeGreaterThan(0);
      expect(resolveDecisionSources(decision).length).toBeGreaterThan(0);
      expect(() => resolveRuleSources(decision.id, decision.sourceIds)).not.toThrow();
      expect(text(decision)).toContain('app-local');
    }
  });
});
