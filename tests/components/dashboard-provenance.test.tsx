import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApplicationRoutes } from '../../src/app/routes';
import { evaluateDashboard } from '../../src/features/dashboard/evaluateDashboard';
import { caseRepository } from '../../src/data/caseRepository';
import type { ClinicalSnapshot } from '../../src/clinical/types';
import { haResponseInput } from '../clinical/haFixtures';
import { reconcileHaExposures } from '../../src/features/ha/exposureHistory';

const patient = { id: 'ha-case', anonymousCode: 'A-provenance' };
const mount = (route = '/case/ha-case') => render(<MemoryRouter initialEntries={[route]}><ApplicationRoutes/></MemoryRouter>);
beforeEach(async () => { await caseRepository.clearAll(); sessionStorage.clear(); });
const seed = (snapshots: ClinicalSnapshot[]) => caseRepository.importCase({ schemaVersion: 1, case: patient, snapshots });

it('keeps duplicate-time cases usable with a strictly earlier fluid comparator and visible competing trend values', async () => {
  const fixture = haResponseInput();
  const earlier = { ...fixture.baseline.previousSnapshot, hemoadsorptionAssessment: undefined };
  const a = { ...fixture.baseline.snapshot, id: 'a-current', creatinineMgDl: 2, lactateMmolL: 5, hemoadsorptionAssessment: undefined };
  const z = { ...a, id: 'z-current', creatinineMgDl: 4, lactateMmolL: 6, potassiumMmolL: 6.8, refractoryHyperkalemia: true };
  await seed([z, earlier, a]); mount();
  expect(await screen.findByRole('heading', { name: '決策首頁' })).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByLabelText('評估時間點')).toHaveValue('z-current');
  expect(screen.getByRole('article', { name: /同一時間點有多筆觀察/ })).toBeVisible();
  expect(screen.getByRole('article', { name: /urgent KRT evaluation/ })).toBeVisible();
  expect(screen.getAllByText(/3.5 → 6 mmol\/L/).length).toBeGreaterThan(0);
  const table = screen.getByRole('table', { name: 'SCr 數據' });
  const duplicate = within(table).getByRole('row', { name: /6 h.*多筆觀察/ });
  expect(duplicate).toHaveTextContent('2 / 4 mg/dL');
  expect(screen.getByRole('region', { name: '床邊摘要' })).toBeVisible();
  expect((screen.getByLabelText('交班摘要') as HTMLTextAreaElement).value).toContain('同一時間點有多筆觀察');
  const user = userEvent.setup(); await user.selectOptions(screen.getByLabelText('評估時間點'), 'a-current');
  expect(within(table).getByRole('row', { name: /6 h.*多筆觀察/ })).toHaveTextContent('2 / 4 mg/dL');
});

it('keeps an explicit same-time dashboard selection as the diagnosis and SOFA current observation', () => {
  const earlier: ClinicalSnapshot = { id: 'prior', caseId: patient.id, timestamp: '2026-09-21T00:00:00Z', hoursFromSepsisOnset: 0, actualWeightKg: 70, onEcmo: false, creatinineMgDl: 1, sofaScore: 4 };
  const severe: ClinicalSnapshot = { ...earlier, id: 'a-severe', timestamp: '2026-09-21T06:00:00Z', hoursFromSepsisOnset: 6, creatinineMgDl: 3, sofaScore: 12 };
  const normal: ClinicalSnapshot = { ...severe, id: 'z-normal', creatinineMgDl: 1, sofaScore: 2 };

  const severeResults = evaluateDashboard(patient, [earlier, severe, normal], severe.id);
  expect(severeResults.find(result => result.id === 'aki-staging')?.conclusion).toContain('stage 3');
  expect(severeResults.find(result => result.id === 'sepsis-assessment')?.evidence.join(' ')).toContain('目前 SOFA：12');

  const normalResults = evaluateDashboard(patient, [earlier, severe, normal], normal.id);
  expect(normalResults.find(result => result.id === 'aki-staging')?.conclusion).not.toContain('stage 3');
  expect(normalResults.find(result => result.id === 'sepsis-assessment')?.evidence.join(' ')).toContain('目前 SOFA：2');
  expect(normalResults.find(result => result.id === 'snapshot-time-provenance')).toBeDefined();
});

it('orders equal timestamps deterministically without claiming an ambiguous prior bucket is a valid comparator', () => {
  const fixture = haResponseInput();
  const prior = { ...fixture.baseline.previousSnapshot, hemoadsorptionAssessment: undefined };
  const a = { ...fixture.baseline.snapshot, id: 'a', hemoadsorptionAssessment: undefined, lactateMmolL: 8 };
  const z = { ...a, id: 'z', lactateMmolL: 9 };
  const forward = evaluateDashboard(patient, [prior, a, z]);
  const reverse = evaluateDashboard(patient, [z, a, prior]);
  expect(forward).toEqual(reverse);
  expect(forward.find(result => result.id === 'snapshot-time-provenance')?.reassessWithinHours).toBe(0);
  expect(forward.find(result => result.id === 'fluid-rose')?.evidence.join(' ')).toContain('3.5 → 9');
  const later = { ...fixture.snapshot, hemoadsorptionAssessment: undefined, hemoadsorptionExposures: undefined };
  const results = evaluateDashboard(patient, [prior, a, z, later]);
  expect(results.find(result => result.id === 'snapshot-time-provenance')).toBeDefined();
  expect(results.find(result => result.id === 'fluid-rose')?.evidence.join(' ')).not.toMatch(/8 →|9 →/);
});

const baselineCases = [
  ['ambiguous', (fixture: ReturnType<typeof haResponseInput>) => [fixture.baseline.previousSnapshot, fixture.baseline.snapshot, { ...fixture.baseline.snapshot, id: 'duplicate-assessed' }, fixture.snapshot]],
  ['unassessed', (fixture: ReturnType<typeof haResponseInput>) => [fixture.baseline.previousSnapshot, { ...fixture.baseline.snapshot, hemoadsorptionAssessment: undefined }, fixture.snapshot]],
  ['missing', (fixture: ReturnType<typeof haResponseInput>) => [fixture.baseline.previousSnapshot, fixture.snapshot]],
  ['incompatible', (fixture: ReturnType<typeof haResponseInput>) => [fixture.baseline.previousSnapshot, { ...fixture.baseline.snapshot, hemoadsorptionAssessment: { ...fixture.baseline.snapshot.hemoadsorptionAssessment, requestedDevice: 'HA330' as const } }, fixture.snapshot]],
] as const;

it.each(baselineCases)('fails closed for an %s exposure baseline on both dashboard and HA route, independent of input order', async (_name, makeSnapshots) => {
  const fixture = haResponseInput({ norepinephrineEquivalentMcgKgMin: 0.5 });
  const snapshots = makeSnapshots(fixture);
  for (const input of [snapshots, [...snapshots].reverse()]) {
    const result = evaluateDashboard(patient, input).find(item => item.id === 'ha-response-review');
    expect(result?.conclusion).toBe('HA 暴露基準來源不明確；立即多專科重評');
    expect(result?.severity).toBe('critical'); expect(result?.reassessWithinHours).toBe(0);
    expect(result?.missingData.join(' ')).toContain('唯一、已評估且裝置／目標相容');
  }
  await seed(snapshots); const view = mount();
  const dashboardCard = await screen.findByRole('article', { name: 'HA 暴露基準來源不明確；立即多專科重評' });
  expect(dashboardCard).toHaveAttribute('data-severity', 'critical');
  expect((screen.getByLabelText('交班摘要') as HTMLTextAreaElement).value).toContain('HA 暴露基準來源不明確');
  view.unmount(); mount('/case/ha-case/ha');
  expect(await screen.findByRole('article', { name: 'HA 暴露基準來源不明確；立即多專科重評' })).toHaveTextContent('立即重評');
});

it('uses the unique assessed compatible baseline among same-time unassessed observations, independent of order', async () => {
  const fixture = haResponseInput({ norepinephrineEquivalentMcgKgMin: 0.5 });
  const unassessed = { ...fixture.baseline.snapshot, id: 'a-unassessed', hemoadsorptionAssessment: undefined };
  const snapshots = [fixture.baseline.previousSnapshot, unassessed, fixture.baseline.snapshot, fixture.snapshot];
  for (const input of [snapshots, [...snapshots].reverse()]) {
    const response = evaluateDashboard(patient, input).find(result => result.id === 'ha-response-review');
    expect(response?.conclusion).toBe('stop and reassess with the bedside multidisciplinary team');
    expect(response?.evidence).toContain('Rising NE-equivalent');
  }
  await seed(snapshots); mount('/case/ha-case/ha');
  expect(await screen.findByRole('article', { name: 'stop and reassess with the bedside multidisciplinary team' })).toHaveAttribute('data-severity', 'critical');
});

it('keeps a documented 12 h HA exposure visible when the 14 h worsening observation omits treatment documentation', async () => {
  const fixture = haResponseInput();
  const later = { ...fixture.snapshot, id: 'later', timestamp: '2026-09-21T14:00:00Z', hoursFromSepsisOnset: 14, norepinephrineEquivalentMcgKgMin: 0.6, hemoadsorptionExposures: undefined };
  const snapshots = [fixture.baseline.previousSnapshot, fixture.baseline.snapshot, fixture.snapshot, later];
  const response = evaluateDashboard(patient, snapshots).find(result => result.id === 'ha-response-review');
  expect(response?.severity).toBe('critical');
  expect(response?.reassessWithinHours).toBe(0);
  expect(response?.missingData.join(' ')).toContain('目前時間點未重新記錄');
  expect(response?.evidence.join(' ')).toContain('Rising NE-equivalent');
  await seed(snapshots); mount('/case/ha-case/ha');
  expect(await screen.findByRole('article', { name: /HA 暴露.*立即多專科重評/ })).toHaveTextContent('目前時間點未重新記錄');
});

it('carries an explicit valid stop forward but never applies a future stop to an earlier selected observation', () => {
  const fixture = haResponseInput();
  const stopped = { ...fixture.snapshot, id: 'stopped', timestamp: '2026-09-21T13:00:00Z', hoursFromSepsisOnset: 13, hemoadsorptionExposures: [{ ...fixture.snapshot.hemoadsorptionExposures![0], stoppedTimestamp: '2026-09-21T13:00:00Z' }] };
  const later = { ...fixture.snapshot, id: 'later', timestamp: '2026-09-21T14:00:00Z', hoursFromSepsisOnset: 14, hemoadsorptionExposures: undefined };
  const snapshots = [fixture.baseline.previousSnapshot, fixture.baseline.snapshot, fixture.snapshot, stopped, later];
  expect(evaluateDashboard(patient, snapshots).find(result => result.id === 'ha-response-review')).toBeUndefined();
  expect(evaluateDashboard(patient, snapshots, fixture.snapshot.id).find(result => result.id === 'ha-response-review')).toBeDefined();
});

it.each(['duplicate', 'conflicting-device', 'future-stop', 'reopened'] as const)('fails closed for %s HA exposure documentation', kind => {
  const fixture = haResponseInput();
  const exposure = fixture.snapshot.hemoadsorptionExposures![0];
  const prior = kind === 'reopened' ? { ...fixture.snapshot, hemoadsorptionExposures: [{ ...exposure, stoppedTimestamp: '2026-09-21T12:00:00Z' }] } : fixture.snapshot;
  const later = { ...fixture.snapshot, id: 'later', timestamp: '2026-09-21T14:00:00Z', hoursFromSepsisOnset: 14,
    hemoadsorptionExposures: kind === 'duplicate' ? [exposure, exposure] : kind === 'conflicting-device' ? [{ ...exposure, device: 'HA330' as const }] : kind === 'future-stop' ? [{ ...exposure, stoppedTimestamp: '2026-09-21T15:00:00Z' }] : [exposure] };
  const response = evaluateDashboard(patient, [fixture.baseline.previousSnapshot, fixture.baseline.snapshot, prior, later]).find(result => result.id === 'ha-response-review');
  expect(response?.severity).toBe('critical'); expect(response?.reassessWithinHours).toBe(0);
  expect(response?.missingData.join(' ')).toMatch(/重複|衝突|停止時間|已停止/);
});

it('does not borrow HA exposure history from another case', () => {
  const fixture = haResponseInput();
  const later = { ...fixture.snapshot, id: 'later', timestamp: '2026-09-21T14:00:00Z', hoursFromSepsisOnset: 14, hemoadsorptionExposures: undefined };
  // The public boundary rejects mixed-case data before any exposure can be borrowed.
  const foreign = { ...fixture.snapshot, caseId: 'another-case' };
  expect(() => evaluateDashboard(patient, [foreign, later])).toThrow('snapshot caseId must match case ID');
});

it('retains factual adverse-event and drug history when a later exposure record omits its subrecords', () => {
  const fixture = haResponseInput();
  fixture.snapshot.hemoadsorptionExposures![0].adverseEvents = [{ timestamp: '2026-09-21T11:00:00Z', kind: 'hypotension', severity: 'severe' }];
  const later = { ...fixture.snapshot, id: 'later', timestamp: '2026-09-21T14:00:00Z', hoursFromSepsisOnset: 14,
    hemoadsorptionExposures: [{ device: 'CytoSorb' as const, targetAdsorbate: 'cytokines' as const, startedTimestamp: '2026-09-21T06:00:00Z' }] };
  const results = evaluateDashboard(patient, [fixture.baseline.previousSnapshot, fixture.baseline.snapshot, fixture.snapshot, later]);
  expect(results.find(result => result.id === 'ha-response-review')?.evidence).toContain('Adverse event: hypotension');
  expect(results.find(result => result.id === 'ha-drug-exposure-review')?.evidence.join(' ')).toContain('vancomycin');
});

it('does not count the same historical circuit event twice, but visibly fails closed on conflicting subrecord revisions', () => {
  const fixture = haResponseInput();
  fixture.snapshot.hemoadsorptionExposures![0].adverseEvents = [{ timestamp: '2026-09-21T11:00:00Z', kind: 'circuit-clotting', severity: 'mild' }];
  const later = { ...fixture.snapshot, id: 'later', timestamp: '2026-09-21T14:00:00Z', hoursFromSepsisOnset: 14 };
  const snapshots = [fixture.baseline.previousSnapshot, fixture.baseline.snapshot, fixture.snapshot, later];
  expect(evaluateDashboard(patient, snapshots).find(result => result.id === 'ha-response-review')?.evidence).not.toContain('Recurrent circuit clotting');
  later.hemoadsorptionExposures = [{ ...fixture.snapshot.hemoadsorptionExposures![0], drugExposures: [{ drugName: 'vancomycin', administeredTimestamp: '2026-09-21T07:00:00Z', doseMg: 750 }] }];
  const response = evaluateDashboard(patient, snapshots).find(result => result.id === 'ha-response-review');
  expect(response?.severity).toBe('critical');
  expect(response?.missingData.join(' ')).toContain('子紀錄衝突');
});

it.each([['mild', 'moderate'], ['severe', 'mild']] as const)('does not manufacture recurrence or adopt severity when one event is revised %s to %s', (earlierSeverity, laterSeverity) => {
  const fixture = haResponseInput();
  const exposure = fixture.snapshot.hemoadsorptionExposures![0];
  exposure.adverseEvents = [{ timestamp: '2026-09-21T11:00:00Z', kind: 'circuit-clotting', severity: earlierSeverity }];
  const later = { ...fixture.snapshot, id: 'later', timestamp: '2026-09-21T14:00:00Z', hoursFromSepsisOnset: 14,
    hemoadsorptionExposures: [{ ...exposure, adverseEvents: [{ ...exposure.adverseEvents[0], severity: laterSeverity }] }] };
  const repeated = { ...later, id: 'repeated', timestamp: '2026-09-21T16:00:00Z', hoursFromSepsisOnset: 16 };
  const snapshots = [fixture.baseline.previousSnapshot, fixture.baseline.snapshot, fixture.snapshot, later, repeated];
  const response = evaluateDashboard(patient, snapshots).find(result => result.id === 'ha-response-review')!;
  expect(response.severity).toBe('critical'); expect(response.reassessWithinHours).toBe(0);
  expect(response.missingData.join(' ')).toContain('子紀錄衝突');
  expect(response.evidence).not.toContain('Recurrent circuit clotting');
  expect(response.evidence).not.toContain('Adverse event: circuit-clotting');
  const events = reconcileHaExposures(repeated, snapshots).active[0].adverseEvents!;
  expect(events).toHaveLength(1); expect(events[0].severity).toBeUndefined();
});

it('retains two genuinely different circuit-event identities even when one has conflicting descriptive revisions', () => {
  const fixture = haResponseInput(); const exposure = fixture.snapshot.hemoadsorptionExposures![0];
  exposure.adverseEvents = [{ timestamp: '2026-09-21T11:00:00Z', kind: 'circuit-clotting', severity: 'mild' }];
  const later = { ...fixture.snapshot, id: 'later', timestamp: '2026-09-21T14:00:00Z', hoursFromSepsisOnset: 14,
    hemoadsorptionExposures: [{ ...exposure, adverseEvents: [
      { timestamp: '2026-09-21T11:00:00Z', kind: 'circuit-clotting' as const, severity: 'moderate' as const },
      { timestamp: '2026-09-21T13:00:00Z', kind: 'circuit-clotting' as const, severity: 'mild' as const },
    ] }] };
  const snapshots = [fixture.baseline.previousSnapshot, fixture.baseline.snapshot, fixture.snapshot, later];
  expect(reconcileHaExposures(later, snapshots).active[0].adverseEvents).toHaveLength(2);
  expect(evaluateDashboard(patient, snapshots).find(result => result.id === 'ha-response-review')?.evidence).toContain('Recurrent circuit clotting');
});

it('keeps one uncertain drug/TDM identity without selecting a conflicting dose or concentration', () => {
  const fixture = haResponseInput(); const exposure = fixture.snapshot.hemoadsorptionExposures![0];
  exposure.therapeuticDrugMonitoring = [{ drugName: 'vancomycin', sampledTimestamp: '2026-09-21T11:00:00Z', concentrationMgL: 12 }];
  const later = { ...fixture.snapshot, id: 'later', timestamp: '2026-09-21T14:00:00Z', hoursFromSepsisOnset: 14,
    hemoadsorptionExposures: [{ ...exposure, drugExposures: [{ ...exposure.drugExposures![0], doseMg: 750 }], therapeuticDrugMonitoring: [{ ...exposure.therapeuticDrugMonitoring[0], concentrationMgL: 18 }] }] };
  const repeated = { ...later, id: 'repeated', timestamp: '2026-09-21T16:00:00Z', hoursFromSepsisOnset: 16 };
  const snapshots = [fixture.baseline.previousSnapshot, fixture.baseline.snapshot, fixture.snapshot, later, repeated];
  const active = reconcileHaExposures(repeated, snapshots).active[0];
  expect(active.drugExposures).toHaveLength(1); expect(active.drugExposures![0].doseMg).toBeUndefined();
  expect(active.therapeuticDrugMonitoring).toHaveLength(1); expect(active.therapeuticDrugMonitoring![0].concentrationMgL).toBeUndefined();
  const decisions = evaluateDashboard(patient, snapshots);
  expect(decisions.find(result => result.id === 'ha-response-review')?.missingData.join(' ')).toContain('子紀錄衝突');
  const drug = decisions.find(result => result.id === 'ha-drug-exposure-review')!;
  expect(drug.evidence.filter(item => item.startsWith('Drug vancomycin;'))).toHaveLength(1);
  expect(drug.evidence.filter(item => item.startsWith('TDM vancomycin;'))).toHaveLength(1);
});

it.each([true, false])('preserves reconciled drug/TDM/cartridge monitoring alongside omitted-exposure uncertainty, current opt-in %s', optedIn => {
  const fixture = haResponseInput();
  fixture.snapshot.hemoadsorptionExposures![0].therapeuticDrugMonitoring = [{ drugName: 'vancomycin', sampledTimestamp: '2026-09-21T11:00:00Z', concentrationMgL: 12 }];
  const later = { ...fixture.snapshot, id: 'later', timestamp: '2026-09-21T14:00:00Z', hoursFromSepsisOnset: 14,
    hemoadsorptionExposures: undefined, hemoadsorptionAssessment: optedIn ? fixture.snapshot.hemoadsorptionAssessment : undefined };
  const results = evaluateDashboard(patient, [fixture.baseline.previousSnapshot, fixture.baseline.snapshot, fixture.snapshot, later]);
  const response = results.find(result => result.id === 'ha-response-review')!;
  expect(response.severity).toBe('critical'); expect(response.reassessWithinHours).toBe(0);
  const drug = results.find(result => result.id === 'ha-drug-exposure-review')!;
  expect(drug).toBeDefined();
  expect(drug.evidence).toContain('Drug vancomycin; administration timestamp: 2026-09-21T07:00:00Z');
  expect(drug.evidence).toContain('TDM vancomycin; sample timestamp: 2026-09-21T11:00:00Z');
  expect(drug.evidence).toContain('Cartridge timestamps: 2026-09-21T10:00:00Z');
  expect(drug.actions.join(' ')).toContain('no automatic supplemental doses');
});
