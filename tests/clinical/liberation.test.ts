import { evaluateLiberation } from '../../src/clinical/liberation';
import { resolveRuleSources } from '../../src/clinical/sources';
import type { ClinicalSnapshot } from '../../src/clinical/types';
import { caseExportSchema, clinicalSnapshotSchema } from '../../src/data/schema';

function snapshot(hour = 12, overrides: Partial<ClinicalSnapshot> = {}): ClinicalSnapshot {
  return {
    id: `s${hour}`, caseId: 'c', timestamp: `2026-09-21T${String(hour).padStart(2, '0')}:00:00Z`,
    hoursFromSepsisOnset: hour, actualWeightKg: 70, onEcmo: false,
    creatinineMgDl: 2, bunMgDl: 35, urineVolumeMl: 360, urineObservationHours: 6, diureticExposure: false,
    mapMmHg: 75, lactateMmolL: 1.5, norepinephrineEquivalentMcgKgMin: 0, vasopressorTrend: 'unchanged', hemodynamicTolerance: 'stable',
    potassiumMmolL: 4, arterialPh: 7.4, bicarbonateMmolL: 24,
    pulmonaryEdema: false, lungBLines: 'absent', vexusGrade: 0, respiratorySupport: 'room-air', pao2Fio2RatioMmHg: 400,
    refractoryHyperkalemia: false, refractoryAcidemia: false, refractoryPulmonaryEdema: false,
    lifeThreateningElectrolyteDisturbance: false, dialyzableToxin: false, requiresControlledSodiumCorrection: false, uremicManifestations: [],
    fluidIntervalHours: 6, intervalFluidInputMl: 400, intervalFluidOutputMl: 450, intervalNetFluidBalanceMl: -50, cumulativeFluidBalanceMl: 500,
    crrtStartedTimestamp: '2026-09-20T00:00:00Z', crrtObservationHours: 6, crrtDowntimeHours: 0,
    liberationAssessment: {
      originalIndicationResolved: true, nativeSoluteControlAdequate: true, nativeFluidBalanceAdequate: true,
      observationAdequate: true, downtimeReviewed: true,
      monitoringPlan: { urineOutput: true, fluidBalance: true, electrolytesAcidBase: true, respiratoryHemodynamic: true, restartTriggersReviewed: true, reviewWithinHours: 2 },
    },
    ...overrides,
  };
}
const evaluate = (s = snapshot(), prior = [snapshot(6)]) => evaluateLiberation(s, prior)[0];

describe('supervised CRRT liberation review', () => {
  it('allows consideration only with concordant observations and explicit clinical/monitoring gates', () => {
    const result = evaluate();
    expect(result.conclusion).toContain('consider supervised trial-off');
    expect(result.actions.join(' ')).toMatch(/觀察|observation/i);
    expect(result.actions.join(' ')).toMatch(/restart|重啟/i);
    expect(result.reassessWithinHours).toBe(2);
    expect(resolveRuleSources(result.id, result.sourceIds).length).toBeGreaterThan(0);
  });
  it.each([
    { refractoryHyperkalemia: true, potassiumMmolL: 6.4 },
    { refractoryAcidemia: true, arterialPh: 7.1 },
    { refractoryPulmonaryEdema: true, pulmonaryEdema: true, pao2Fio2RatioMmHg: 150, respiratorySupport: 'invasive-ventilation' as const },
    { uremicManifestations: ['pericarditis'] as ClinicalSnapshot['uremicManifestations'] },
  ])('persistent definitive indication vetoes trial-off: %j', change => {
    expect(evaluate(snapshot(12, change)).conclusion).toContain('continue and reassess');
    expect(evaluate(snapshot(12, change)).severity).toBe('critical');
  });
  it.each([
    { vasopressorTrend: 'worsening' as const }, { mapMmHg: 60 }, { lactateMmolL: 4 },
    { norepinephrineEquivalentMcgKgMin: 0.2 }, { hemodynamicTolerance: 'unstable' as const },
    { pulmonaryEdema: true }, { lungBLines: 'bilateral-diffuse' as const }, { vexusGrade: 3 as const },
    { pao2Fio2RatioMmHg: 180 }, { respiratorySupport: 'invasive-ventilation' as const },
    { potassiumMmolL: 6.2 }, { arterialPh: 7.15 }, { bicarbonateMmolL: 10 },
    { bunMgDl: 60 }, { creatinineMgDl: 4 }, { cumulativeFluidBalanceMl: 2000 },
    { urineVolumeMl: 0 }, { urineObservationHours: 1 }, { crrtDowntimeHours: 7 },
  ])('does not bypass concerning measurements with favorable clinician assessments: %j', change => {
    expect(evaluate(snapshot(12, change)).conclusion).toContain('continue and reassess');
  });
  it.each(['potassiumMmolL', 'arterialPh', 'urineVolumeMl', 'urineObservationHours', 'diureticExposure', 'mapMmHg', 'vasopressorTrend', 'crrtDowntimeHours', 'fluidIntervalHours', 'pulmonaryEdema', 'uremicManifestations'] as const)(
    'missing %s fails closed', field => {
      const result = evaluate(snapshot(12, { [field]: undefined }));
      expect(result.conclusion).toContain('continue and reassess');
      expect(result.missingData.length).toBeGreaterThan(0);
    });
  it('distinguishes observed anuria from absent urine volume', () => {
    expect(evaluate(snapshot(12, { urineVolumeMl: 0 })).evidence.join(' ')).toMatch(/anuria|無尿/);
    expect(evaluate(snapshot(12, { urineVolumeMl: undefined })).evidence.join(' ')).not.toMatch(/anuria|無尿/);
  });
  it('requires observation, original resolution, native sufficiency and all monitoring domains separately', () => {
    for (const field of ['originalIndicationResolved', 'nativeSoluteControlAdequate', 'nativeFluidBalanceAdequate', 'observationAdequate', 'downtimeReviewed'] as const) {
      const s = snapshot(); s.liberationAssessment![field] = undefined;
      expect(evaluate(s).conclusion).toContain('continue and reassess');
    }
    for (const field of ['urineOutput', 'fluidBalance', 'electrolytesAcidBase', 'respiratoryHemodynamic', 'restartTriggersReviewed', 'reviewWithinHours'] as const) {
      const s = snapshot(); delete s.liberationAssessment!.monitoringPlan![field];
      expect(evaluate(s).conclusion).toContain('continue and reassess');
    }
  });
  it('a single urine or short clearance result cannot independently establish readiness', () => {
    const s = snapshot(); s.liberationAssessment = { timedCreatinineClearanceMlMin: 30, clearanceCollectionHours: 2 };
    expect(evaluate(s, []).conclusion).toContain('continue and reassess');
    expect(evaluate(s).evidence.join(' ')).toMatch(/clearance|清除率/i);
  });
  it('requires explicit diuretic interpretation even with improving urine', () => {
    const s = snapshot(12, { diureticExposure: true, urineVolumeMl: 600 });
    expect(evaluate(s).conclusion).toContain('continue and reassess');
    s.liberationAssessment!.diureticEffectReviewed = true;
    expect(evaluate(s).conclusion).toContain('consider supervised trial-off');
    expect(evaluate(s).evidence.join(' ')).toMatch(/diuretic|利尿/);
  });
  it('high inputs require native balance adequacy and do not become an automatic threshold', () => {
    const s = snapshot(12, { intervalFluidInputMl: 3000, intervalFluidOutputMl: 3050 });
    s.liberationAssessment!.nativeFluidBalanceAdequate = false;
    expect(evaluate(s).conclusion).toContain('continue and reassess');
  });
  it.each([{ potassiumMmolL: 6.5, refractoryHyperkalemia: true }, { arterialPh: 7.1, refractoryAcidemia: true }, { pulmonaryEdema: true, refractoryPulmonaryEdema: true, pao2Fio2RatioMmHg: 120, respiratorySupport: 'invasive-ventilation' as const }])(
    'flags confirmed recurrence during observed trial-off for immediate review: %j', change => {
      const result = evaluate(snapshot(12, { ...change, crrtStoppedTimestamp: '2026-09-21T08:00:00Z' }));
      expect(result.conclusion).toContain('restart trigger met');
      expect(result.reassessWithinHours).toBe(0);
    });
  it('unconfirmed recurrence requires urgent review but never an automatic restart', () => {
    const result = evaluate(snapshot(12, { potassiumMmolL: 6.5, crrtStoppedTimestamp: '2026-09-21T08:00:00Z' }));
    expect(result.conclusion).toContain('continue and reassess');
    expect(result.reassessWithinHours).toBeLessThanOrEqual(0.25);
  });
  it('an already active trial-off remains monitored rather than being told to stop again', () => {
    const result = evaluate(snapshot(12, { crrtStoppedTimestamp: '2026-09-21T08:00:00Z' }));
    expect(result.conclusion).toContain('continue and reassess');
    expect(result.actions.join(' ')).toMatch(/trial-off/);
  });
  it('normalizes unordered historical timepoints without mutating input', () => {
    const trend = [snapshot(6), snapshot(0)]; const original = structuredClone(trend);
    expect(evaluate(snapshot(), trend).conclusion).toContain('consider supervised trial-off');
    expect(trend).toEqual(original);
  });
  it.each([[snapshot(6), snapshot(6)], [snapshot(18)], [snapshot(6, { caseId: 'other' })], [snapshot(6, { timestamp: 'invalid' })]])(
    'rejects ambiguous, future or foreign observations', (...trend) => {
      expect(evaluate(snapshot(), trend).conclusion).toContain('continue and reassess');
    });
  it('includes the current snapshot once when callers pass the complete series', () => {
    const s = snapshot(); expect(evaluate(s, [snapshot(6), s]).conclusion).toContain('consider supervised trial-off');
    expect(evaluate(s, [snapshot(6), { ...s, potassiumMmolL: 7 }]).conclusion).toContain('continue and reassess');
  });
  it('rejects implausible dates and non-finite measurements even when bypassing persistence', () => {
    expect(evaluate(snapshot(12, { timestamp: 'invalid' })).conclusion).toContain('continue and reassess');
    expect(evaluate(snapshot(12, { potassiumMmolL: Number.NaN })).conclusion).toContain('continue and reassess');
  });
  it.each([{ arterialPh: 9 }, { bunMgDl: -1 }, { creatinineMgDl: -1 }, { norepinephrineEquivalentMcgKgMin: -1 }, { liberationAssessment: { ...snapshot().liberationAssessment, timedCreatinineClearanceMlMin: Number.NaN, clearanceCollectionHours: 2 } }])(
    'malformed runtime clinical data cannot qualify despite positive assessment: %j', change => {
      expect(evaluate(snapshot(12, change)).conclusion).toContain('continue and reassess');
    });
  it('does not combine urine windows that overlap each other into sustained observation', () => {
    expect(evaluate(snapshot(12, { urineObservationHours: 12, urineVolumeMl: 720 })).conclusion).toContain('continue and reassess');
  });
  it('does not display a routine monitoring delay when urgent reassessment is necessary', () => {
    const result = evaluate(snapshot(12, { refractoryHyperkalemia: true, potassiumMmolL: 6.5 }));
    expect(result.actions.join(' ')).not.toContain('至遲 2 h');
  });
  it('keeps every outcome advisory without device commands', () => {
    const cases = [snapshot(), snapshot(12, { potassiumMmolL: 6.5 }), snapshot(12, { refractoryHyperkalemia: true, potassiumMmolL: 6.5, crrtStoppedTimestamp: '2026-09-21T08:00:00Z' })];
    for (const s of cases) {
      const text = JSON.stringify(evaluate(s));
      expect(text).toMatch(/review|複核/);
      expect(text).not.toMatch(/stop CRRT now|restart CRRT now|automatically stop|自動停機|自動重啟/);
    }
  });
});

describe('optional liberation assessment persistence', () => {
  it('round-trips schema v1 and old sparse snapshots without default clinical assessments', () => {
    const s = snapshot();
    const payload = JSON.parse(JSON.stringify({ schemaVersion: 1, case: { id: 'c', anonymousCode: 'A' }, snapshots: [s] }));
    expect(caseExportSchema.parse(payload).snapshots[0].liberationAssessment).toEqual(s.liberationAssessment);
    delete s.liberationAssessment;
    expect(clinicalSnapshotSchema.parse(s)).not.toHaveProperty('liberationAssessment');
  });
  it.each([{ monitoringPlan: { reviewWithinHours: 0 } }, { monitoringPlan: { reviewWithinHours: -1 } }, { timedCreatinineClearanceMlMin: -1 }, { clearanceCollectionHours: 0 }, { originalIndicationResolved: 'yes' }, { deviceStop: true }])(
    'rejects invalid imported assessments: %j', liberationAssessment => {
      expect(caseExportSchema.safeParse({ schemaVersion: 1, case: { id: 'c', anonymousCode: 'A' }, snapshots: [{ ...snapshot(), liberationAssessment }] }).success).toBe(false);
    });
});

describe('liberation direct-call runtime boundary', () => {
  const mandatory = ['originalIndicationResolved', 'nativeSoluteControlAdequate', 'nativeFluidBalanceAdequate', 'observationAdequate', 'downtimeReviewed'] as const;
  it.each(mandatory)('requires literal true, never a truthy string, for %s', key => {
    const s = snapshot();
    s.liberationAssessment = { ...s.liberationAssessment, [key]: 'false' } as unknown as ClinicalSnapshot['liberationAssessment'];
    const result = evaluate(s);
    expect(result.conclusion).toContain('continue and reassess');
    expect(result.missingData.join(' ')).toMatch(/invalid.*liberationAssessment/i);
  });
  it('rejects all mandatory affirmative gates encoded as string false', () => {
    const s = snapshot();
    s.liberationAssessment = { ...s.liberationAssessment, ...Object.fromEntries(mandatory.map(key => [key, 'false'])) } as unknown as ClinicalSnapshot['liberationAssessment'];
    const result = evaluate(s);
    expect(result.conclusion).toContain('continue and reassess');
    for (const key of mandatory) expect(result.missingData.join(' ')).toContain(key);
  });
  it.each([
    { diureticExposure: 'unknown' }, { vasopressorTrend: 'stable' }, { lungBLines: 'normal' },
    { vexusGrade: Number.NaN }, { vexusGrade: -1 }, { vexusGrade: 4 }, { vexusGrade: 0.5 }, { vexusGrade: '0' },
    { pulmonaryEdema: 0 }, { hemodynamicTolerance: 'good' }, { respiratorySupport: 'none' },
    { potassiumMmolL: '4' }, { mapMmHg: -1 }, { lactateMmolL: -1 }, { urineObservationHours: 0 },
    { refractoryHyperkalemia: 'false' }, { lifeThreateningElectrolyteDisturbance: 'false' },
    { uremicManifestations: {} }, { diureticExposures: false }, { onEcmo: 'false' },
  ])('rejects malformed current and prior comparable context without throwing: %j', change => {
    const current = { ...snapshot(), ...change } as unknown as ClinicalSnapshot;
    const prior = { ...snapshot(6), ...change } as unknown as ClinicalSnapshot;
    for (const result of [evaluate(current), evaluate(snapshot(), [prior])]) {
      expect(result.conclusion).toContain('continue and reassess');
      expect(result.missingData.join(' ')).toMatch(/invalid/i);
    }
  });
  it('keeps valid false observations distinct from malformed false strings', () => {
    expect(evaluate().conclusion).toContain('consider supervised trial-off');
    const s = snapshot(); s.liberationAssessment!.originalIndicationResolved = false;
    expect(evaluate(s).conclusion).toContain('continue and reassess');
  });
});

describe('longitudinal CRRT treatment-state reconciliation', () => {
  const stopped = () => snapshot(6, { crrtStoppedTimestamp: '2026-09-21T05:00:00Z' });
  it.each([false, true])('cannot resurrect a stopped episode when current stop is omitted (start omitted: %s)', omitStart => {
    const current = snapshot(12, omitStart ? { crrtStartedTimestamp: undefined } : {});
    const series = [stopped()];
    expect(clinicalSnapshotSchema.safeParse(current).success).toBe(true);
    expect(clinicalSnapshotSchema.safeParse(series[0]).success).toBe(true);
    const result = evaluate(current, series);
    expect(result.conclusion).toContain('continue and reassess');
    expect(result.missingData.join(' ')).toMatch(/treatment-state uncertainty/i);
  });
  it('retains a historical stop even if an intervening snapshot omits it, regardless of array order', () => {
    const early = snapshot(0, { crrtStoppedTimestamp: '2026-09-20T23:00:00Z' });
    const mid = snapshot(6);
    for (const history of [[early, mid], [mid, early]]) {
      const result = evaluate(snapshot(), history);
      expect(result.conclusion).toContain('continue and reassess');
      expect(result.missingData.join(' ')).toMatch(/treatment-state uncertainty/i);
    }
  });
  it('accepts a documented later start as a new active episode, with all other gates still required', () => {
    const current = snapshot(12, { crrtStartedTimestamp: '2026-09-21T07:00:00Z' });
    for (const history of [[snapshot(0), stopped()], [stopped(), snapshot(0)]]) {
      expect(evaluate(current, history).conclusion).toContain('consider supervised trial-off');
    }
    current.liberationAssessment!.originalIndicationResolved = undefined;
    expect(evaluate(current, [stopped()]).conclusion).toContain('continue and reassess');
  });
  it('does not accept an equal-time stop/start as proof of a later restart', () => {
    const result = evaluate(snapshot(12, { crrtStartedTimestamp: '2026-09-21T05:00:00Z' }), [stopped()]);
    expect(result.conclusion).toContain('continue and reassess');
    expect(result.missingData.join(' ')).toMatch(/treatment-state uncertainty/i);
  });
  it('rejects conflicting equal snapshot timestamps deterministically', () => {
    for (const history of [[stopped(), snapshot(6)], [snapshot(6), stopped()]]) {
      const result = evaluate(snapshot(), history);
      expect(result.conclusion).toContain('continue and reassess');
      expect(result.missingData.join(' ')).toMatch(/treatment-state uncertainty/i);
    }
  });
  it('rejects historical treatment events recorded after their snapshot time', () => {
    const history = [snapshot(6, { crrtStoppedTimestamp: '2026-09-21T07:00:00Z' })];
    const result = evaluate(snapshot(12, { crrtStartedTimestamp: '2026-09-21T08:00:00Z' }), history);
    expect(result.conclusion).toContain('continue and reassess');
    expect(result.missingData.join(' ')).toMatch(/treatment-state uncertainty/i);
  });
  it('does not discard conflicting stops for one episode when a later start is recorded, in either order', () => {
    const early = snapshot(0, { crrtStoppedTimestamp: '2026-09-20T23:00:00Z' });
    const later = stopped();
    const current = snapshot(12, { crrtStartedTimestamp: '2026-09-21T07:00:00Z' });
    for (const history of [[early, later], [later, early]]) {
      const result = evaluate(current, history);
      expect(result.conclusion).toContain('continue and reassess');
      expect(result.missingData.join(' ')).toMatch(/treatment-state.*conflict.*same.*episode/i);
    }
  });
  it('preserves urgent trigger evidence without declaring restart state when same-episode stops conflict', () => {
    const early = snapshot(0, { crrtStoppedTimestamp: '2026-09-20T23:00:00Z' });
    const later = stopped();
    const current = snapshot(12, { crrtStoppedTimestamp: '2026-09-21T05:00:00Z', potassiumMmolL: 6.5, refractoryHyperkalemia: true });
    for (const history of [[early, later], [later, early]]) {
      const result = evaluate(current, history);
      expect(result.conclusion).toContain('continue and reassess');
      expect(result.conclusion).not.toContain('restart trigger met');
      expect(result.missingData.join(' ')).toMatch(/treatment-state.*conflict.*same.*episode/i);
      expect(result.severity).toBe('critical');
      expect(result.reassessWithinHours).toBe(0);
      expect(result.evidence.join(' ')).toMatch(/高血鉀.*難治/);
      expect(result.actions.join(' ')).toMatch(/立即.*複核/);
    }
  });
  it('does not treat identical episode start/stop repetitions at distinct observation times as a conflict', () => {
    const episode = { crrtStoppedTimestamp: '2026-09-20T23:00:00Z' };
    const current = snapshot(12, { crrtStartedTimestamp: '2026-09-21T07:00:00Z' });
    for (const history of [[snapshot(0, episode), snapshot(6, episode)], [snapshot(6, episode), snapshot(0, episode)]]) {
      const result = evaluate(current, history);
      expect(result.conclusion).toContain('consider supervised trial-off');
      expect(result.missingData).toEqual([]);
    }
  });
  it('keeps different valid stop times separate when they belong to distinct episodes', () => {
    const first = snapshot(0, { crrtStoppedTimestamp: '2026-09-20T23:00:00Z' });
    const second = snapshot(6, { crrtStartedTimestamp: '2026-09-21T01:00:00Z', crrtStoppedTimestamp: '2026-09-21T05:00:00Z' });
    const current = snapshot(12, { crrtStartedTimestamp: '2026-09-21T07:00:00Z' });
    for (const history of [[first, second], [second, first]]) {
      const result = evaluate(current, history);
      expect(result.conclusion).toContain('consider supervised trial-off');
      expect(result.missingData).toEqual([]);
    }
  });
});
