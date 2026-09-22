import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApplicationRoutes } from '../../src/app/routes';
import { caseRepository } from '../../src/data/caseRepository';
import { haAssessment, haInput, haResponseInput } from '../clinical/haFixtures';
import type { ClinicalSnapshot } from '../../src/clinical/types';

const mount = () => render(<MemoryRouter initialEntries={['/case/ha-case/ha']}><ApplicationRoutes/></MemoryRouter>);
beforeEach(async () => { await caseRepository.clearAll(); sessionStorage.clear(); });
async function seed(patch: Partial<ClinicalSnapshot> = {}) { const { snapshot, previousSnapshot } = haInput(patch); await caseRepository.importCase({ schemaVersion: 1, case: { id: 'ha-case', anonymousCode: 'A-HA' }, snapshots: [previousSnapshot, snapshot] }); }

it('places SSC/ADQI warning before all gates and the assessment-input navigation', async () => {
  await seed(); mount();
  const warning = await screen.findByRole('note', { name: 'HA 非常規治療警告' });
  expect(warning).toHaveTextContent('SSC 2026'); expect(warning).toHaveTextContent('ADQI 30');
  for (const name of ['臨床門檻', '目標門檻', '安全門檻', '治理門檻']) expect(screen.getByRole('heading', { name })).toBeVisible();
  expect(warning.compareDocumentPosition(screen.getByRole('link', { name: '輸入新的 HA 評估' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole('status')).toHaveTextContent('待確認多專科審查');
  expect(screen.queryByText('不符合審查資格')).not.toBeInTheDocument();
  const user = userEvent.setup(); await user.click(screen.getByRole('link', { name: '輸入新的 HA 評估' }));
  expect(await screen.findByRole('heading', { name: '選配 HA' })).toBeVisible();
  expect(screen.getByRole('note', { name: 'HA 非常規治療警告' }).compareDocumentPosition(screen.getByRole('checkbox', { name: '主動啟用 HA 救援評估' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it.each([
  ['confirmed', haAssessment({ reviewStatus: 'multidisciplinary-review' }), '可送多專科審查'],
  ['saved incomplete', haAssessment({ reviewStatus: 'incomplete' }), '已保存未完成 HA 觀察'],
  ['missing', haAssessment({ governance: undefined }), '資料不足，HA 評估未完成'],
  ['failed', haAssessment({ adultConfirmed: false }), '不符合審查資格'],
] as const)('distinguishes %s without converting saved observations into eligibility', async (_name, assessment, expected) => {
  await seed({ hemoadsorptionAssessment: assessment }); mount();
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(expected));
  expect(document.body).not.toHaveTextContent('建議立即使用 HA');
  expect(document.body).not.toHaveTextContent('開始 HA 治療');
});

it('keeps EAA and IL-6 device-specific and shows independent KRT gate requirements for oXiris', async () => {
  await seed({ hemoadsorptionAssessment: haAssessment({ requestedDevice: 'polymyxin-B', targetAdsorbate: 'endotoxin', endotoxinPhenotype: true, suspectedGramNegativeInfection: true }), endotoxinActivityAssay: undefined });
  const view = mount(); const target = await screen.findByRole('region', { name: '目標門檻' });
  expect(target).toHaveTextContent('EAA'); expect(target).not.toHaveTextContent('必須 IL-6');
  expect(within(target).getByText(/未通過/)).toBeVisible();
  view.unmount(); await caseRepository.clearAll(); await seed({ hemoadsorptionAssessment: haAssessment({ requestedDevice: 'oXiris' }) }); mount();
  expect(await screen.findByRole('region', { name: '目標門檻' })).toHaveTextContent('CRRT');
});

it('keeps the empty HA route opt-in with warning and no fabricated eligibility', async () => {
  await caseRepository.createCase({ id: 'ha-case', anonymousCode: 'A-HA' }); mount();
  expect(await screen.findByRole('note', { name: 'HA 非常規治療警告' })).toBeVisible();
  expect(screen.getByText('尚未評估 HA；此路徑不會自動啟用。')).toBeVisible();
  expect(screen.queryByText('可送多專科審查')).not.toBeInTheDocument();
});

it('shows the engine safety veto in its gate and does not preserve confirmed review after a veto', async () => {
  const assessment = haAssessment({ reviewStatus: 'multidisciplinary-review' });
  assessment.safety!.uncontrolledBleeding = true;
  await seed({ hemoadsorptionAssessment: assessment }); mount();
  const safety = await screen.findByRole('region', { name: '安全門檻' });
  expect(safety).toHaveTextContent('Safety veto assessment: uncontrolledBleeding');
  expect(screen.getByRole('status')).toHaveTextContent('不符合審查資格');
  expect(screen.queryByText('可送多專科審查')).not.toBeInTheDocument();
});

it('integrates documented-exposure response safety and includes HA in the handoff only when assessed', async () => {
  const fixture = haResponseInput({ norepinephrineEquivalentMcgKgMin: 0.5 });
  await caseRepository.importCase({ schemaVersion: 1, case: { id: 'ha-case', anonymousCode: 'A-HA' }, snapshots: [fixture.baseline.previousSnapshot, fixture.baseline.snapshot, fixture.snapshot] });
  const user = userEvent.setup(); mount();
  expect(await screen.findByRole('article', { name: 'stop and reassess with the bedside multidisciplinary team' })).toHaveAttribute('data-severity', 'critical');
  await user.click(screen.getByRole('link', { name: '決策首頁' }));
  const textarea = await screen.findByLabelText('交班摘要') as HTMLTextAreaElement;
  expect(textarea.value).toContain('HA 狀態'); expect(textarea.value).toContain('ha-response-review');
  expect(textarea.value).not.toContain('vancomycin');
});
