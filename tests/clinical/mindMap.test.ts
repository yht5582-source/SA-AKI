import { calculateKdigoStage } from '../../src/clinical/diagnosis';
import { evaluateFluid } from '../../src/clinical/fluid';
import { evaluateKrtInitiation } from '../../src/clinical/krt';
import { evidenceSources } from '../../src/clinical/sources';
import type { ClinicalSnapshot } from '../../src/clinical/types';
import { findDemoCase } from '../../src/features/demo/demoCases';
import { mindMaps, type MapNode } from '../../src/features/mindmap/mindMapData';

const walk = (node: MapNode): MapNode[] => [node, ...(node.children ?? []).flatMap(walk)];
const base: ClinicalSnapshot = { id: 's', caseId: 'c', timestamp: '2026-05-01T12:00:00Z', hoursFromSepsisOnset: 12, actualWeightKg: 70, onEcmo: false };
const screen = { lifeThreateningElectrolyteDisturbance: false, dialyzableToxin: false, requiresControlledSodiumCorrection: false, uremicManifestations: [] as ClinicalSnapshot['uremicManifestations'], pulmonaryEdema: false, potassiumMmolL: 4.5, arterialPh: 7.38, bicarbonateMmolL: 24 };
const krt = (patch: Partial<ClinicalSnapshot>) => evaluateKrtInitiation({ ...base, ...screen, ...patch })[0];

it('has a diagnosis and a treatment map whose items are well formed', () => {
  expect(mindMaps.map(map => map.id)).toEqual(['diagnosis', 'treatment']);
  for (const map of mindMaps) {
    expect(map.branches.length).toBeGreaterThanOrEqual(5);
    for (const branch of map.branches) {
      expect(branch.children?.length).toBeGreaterThan(0);
      if (branch.demoId) expect(findDemoCase(branch.demoId), branch.id).toBeDefined();
      const texts = walk(branch).map(node => node.text);
      expect(new Set(texts).size, branch.id).toBe(texts.length);
    }
  }
});

it('labels every leaf with a registered, verified source or as an app convention', () => {
  for (const map of mindMaps) for (const branch of map.branches) for (const node of walk(branch)) {
    if (node.src) expect(evidenceSources[node.src]?.verification, node.text).toBe('verified');
    if (!node.children) expect(!!node.src !== !!node.local, node.text).toBe(true);
  }
});

// The map repeats numbers from the rules, so pin those numbers to the engine.
describe('printed thresholds match the engine', () => {
  it.each([
    [{ potassiumMmolL: 6 }, { potassiumMmolL: 5.9 }],
    [{ arterialPh: 7.2 }, { arterialPh: 7.21 }],
    [{ bicarbonateMmolL: 12 }, { bicarbonateMmolL: 13 }],
    [{ pao2Fio2RatioMmHg: 200 }, { pao2Fio2RatioMmHg: 201 }],
  ])('KRT screen boundary %j', (at, past) => {
    expect(krt(at).conclusion).toContain('urgent confirmation');
    expect(krt(past).conclusion).toContain('deferred');
  });
  it('urine and creatinine stage boundaries', () => {
    expect(calculateKdigoStage({ urineVolumeMl: 200, urineObservationHours: 12, urineWeightKg: 70 }).urineStage).toBe(2);
    expect(calculateKdigoStage({ urineVolumeMl: 400, urineObservationHours: 24, urineWeightKg: 70 }).urineStage).toBe(3);
    expect(calculateKdigoStage({ urineVolumeMl: 0, urineObservationHours: 12, urineWeightKg: 70 }).urineStage).toBe(3);
    const staged = (current: number) => calculateKdigoStage({ currentCreatinineMgDl: current, baselineCreatinineMgDl: 1, baselineAgeHours: 72, baselineSource: 'measured-outpatient', baselineConfidence: 'high' }).stage;
    expect([staged(1.5), staged(2), staged(3)]).toEqual([1, 2, 3]);
  });
  it('perfusion triggers', () => {
    const rose = (patch: Partial<ClinicalSnapshot>) => evaluateFluid({ ...base, mapMmHg: 70, lactateMmolL: 1.5, capillaryRefillSeconds: 2, norepinephrineEquivalentMcgKgMin: 0, vasopressorTrend: 'unchanged', ...patch }).find(result => result.id === 'fluid-rose')!.severity;
    expect(rose({})).toBe('monitor');
    for (const patch of [{ mapMmHg: 64 }, { lactateMmolL: 2.1 }, { capillaryRefillSeconds: 3.1 }]) expect(rose(patch)).toBe('warning');
  });
});
