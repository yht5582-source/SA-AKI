import { evaluateKrtInitiation } from '../../src/clinical/krt';
import { selectKrtModality } from '../../src/clinical/modality';
import { modalityAdvice } from '../../src/clinical/modalityAdvice';
import type { ClinicalSnapshot } from '../../src/clinical/types';

const snapshot = (patch: Partial<ClinicalSnapshot> = {}): ClinicalSnapshot => ({
  id: 's', caseId: 'c', timestamp: '2026-09-21T06:00:00Z', hoursFromSepsisOnset: 6,
  actualWeightKg: 70, onEcmo: false, potassiumMmolL: 6.5, refractoryHyperkalemia: true, ...patch,
});
const stable: Partial<ClinicalSnapshot> = {
  hemodynamicTolerance: 'stable', mapMmHg: 75, norepinephrineEquivalentMcgKgMin: 0,
  vasopressorTrend: 'unchanged', lactateMmolL: 1.5, intracranialPressureRisk: false,
  preciseFluidElectrolyteControlNeeded: false, rapidSoluteClearanceNeeded: true,
};

it.each([
  [{ ...stable }, 'IHD'],
  [{ ...stable, hemodynamicTolerance: 'intermediate', norepinephrineEquivalentMcgKgMin: 0.03 }, 'PIRRT'],
  [{ ...stable, hemodynamicTolerance: 'unstable', norepinephrineEquivalentMcgKgMin: 0.3 }, 'CRRT'],
] as const)('offers %s for clinical review only with confirmed indication and complete mode data', (patch, name) => {
  const s = snapshot(patch);
  expect(modalityAdvice(evaluateKrtInitiation(s)[0], selectKrtModality(s)[0])).toContain(`優先討論 ${name}`);
  expect(modalityAdvice(evaluateKrtInitiation(snapshot({ ...patch, potassiumMmolL: 4.2, refractoryHyperkalemia: false }))[0], selectKrtModality(s)[0]))
    .toContain('尚不選定 KRT 模式');
});

it('withholds mode selection when a known unstable datum conflicts with the stable label or another parameter is absent', () => {
  const incomplete = snapshot({ ...stable, intracranialPressureRisk: undefined });
  expect(modalityAdvice(evaluateKrtInitiation(incomplete)[0], selectKrtModality(incomplete)[0])).toContain('資料不足，暫不選定');
  const conflicting = snapshot({ ...stable, mapMmHg: 55 });
  expect(modalityAdvice(evaluateKrtInitiation(conflicting)[0], selectKrtModality(conflicting)[0])).toContain('資料互相衝突');
});
