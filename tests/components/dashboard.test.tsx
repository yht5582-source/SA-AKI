import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApplicationRoutes } from '../../src/app/routes';
import { caseRepository } from '../../src/data/caseRepository';
import type { ClinicalSnapshot } from '../../src/clinical/types';

const patient = { id: 'dashboard', anonymousCode: 'A-dashboard', baselineCreatinineMgDl: 1, baselineCreatinineSource: 'measured-outpatient' as const, baselineCreatinineConfidence: 'high' as const, baselineCreatinineTimestamp: '2026-09-20T00:00:00Z', sepsisOnsetTimestamp: '2026-09-21T00:00:00Z' };
const observation = (hour: number, patch: Partial<ClinicalSnapshot> = {}): ClinicalSnapshot => ({ id: `s${hour}`, caseId: patient.id, timestamp: new Date(Date.UTC(2026, 8, 21, hour)).toISOString(), hoursFromSepsisOnset: hour, actualWeightKg: 70, onEcmo: false, ...patch });
const mount = (path = '/SA-AKI/case/dashboard') => render(<MemoryRouter basename="/SA-AKI" initialEntries={[path]}><ApplicationRoutes/></MemoryRouter>);
beforeEach(async () => { await caseRepository.clearAll(); sessionStorage.clear(); });
afterEach(() => vi.restoreAllMocks());

it('integrates real engines, severity-sorts cards, and exposes every decision section', async () => {
  await caseRepository.importCase({ schemaVersion: 1, case: patient, snapshots: [observation(0, { creatinineMgDl: 1 }), observation(6, { creatinineMgDl: 3, potassiumMmolL: 6.5, refractoryHyperkalemia: true, onEcmo: true })] });
  mount();
  expect(await screen.findByRole('heading', { name: '決策首頁' })).toBeVisible();
  const cards = screen.getAllByRole('article');
  expect(cards[0]).toHaveAttribute('data-severity', 'critical');
  const order = { critical: 0, warning: 1, monitor: 2, stable: 3 };
  const ranks = cards.map(card => order[card.getAttribute('data-severity') as keyof typeof order]);
  expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  for (const card of cards) for (const name of ['判斷依據', '缺失資料', '下一步', '重評時間', '哪些變化會改變判斷？', '規則與來源']) expect(within(card).getByText(name)).toBeVisible();
  for (const id of ['aki-staging', 'sa-aki-timing', 'fluid-rose', 'krt-emergency-indications', 'krt-modality-selection', 'ecmo-krt-connection', 'crrt-prescription-safety', 'crrt-delivered-dose', 'crrt-anticoagulation', 'crrt-liberation-review', 'aki-prognosis-review']) expect(cards.some(card => card.getAttribute('data-rule-id') === id)).toBe(true);
  expect(screen.getAllByText(/本機規則.*非經驗證治療閾值/).length).toBeGreaterThan(0);
  expect(screen.queryByText('建議立即使用 HA')).not.toBeInTheDocument();
});

it('plots all eight measures with gaps, explicit baselines, normalized urine and genuine zero values', async () => {
  const user = userEvent.setup();
  await caseRepository.importCase({ schemaVersion: 1, case: patient, snapshots: [observation(0, { creatinineMgDl: 2, urineVolumeMl: 70, urineObservationHours: 2, urineNormalizationWeightKg: 70, urineWeightBasis: 'actual', lactateMmolL: 2, norepinephrineEquivalentMcgKgMin: 0, cumulativeFluidBalanceMl: 0, sofaScore: 4, deliveredEffluentMlKgHours: 20 }), observation(6), observation(12, { creatinineMgDl: 4 })] });
  mount();
  const trends = await screen.findByRole('region', { name: '0–72 小時病程' });
  for (const label of ['SCr', '標準化尿量', '乳酸', 'NE 等效劑量', '累積液體平衡', '實際體重', 'SOFA', '實際交付劑量']) expect(within(trends).getByRole('heading', { name: label })).toBeVisible();
  const scr = within(trends).getByRole('table', { name: 'SCr 數據' });
  expect(within(scr).getByRole('row', { name: /6 h.*缺值/ })).toBeVisible();
  expect(within(trends).getByRole('table', { name: '標準化尿量 數據' })).toHaveTextContent('0.5');
  expect(within(trends).getByRole('table', { name: 'NE 等效劑量 數據' })).toHaveTextContent('0');
  expect(within(trends).getByText('SCr 基準：1 mg/dL（病例基準）')).toBeVisible();
  await user.click(within(trends).getByRole('button', { name: '相對基準變化' }));
  expect(within(scr).getByRole('row', { name: /12 h.*3/ })).toBeVisible();
  expect(within(scr).getByRole('row', { name: /6 h.*缺值/ })).toBeVisible();
  const graph = within(trends).getByRole('img', { name: /SCr 趨勢/ });
  expect(graph.querySelectorAll('line[data-segment]')).toHaveLength(0);
});

it('copies an allowlisted non-order handoff and provides a manual fallback after clipboard rejection', async () => {
  const user = userEvent.setup();
  await caseRepository.importCase({ schemaVersion: 1, case: { ...patient, comorbidities: ['DO_NOT_COPY_FREE_TEXT'] }, snapshots: [observation(0)] });
  mount();
  const handoff = await screen.findByRole('region', { name: '床邊摘要' });
  const textarea = within(handoff).getByLabelText('交班摘要') as HTMLTextAreaElement;
  for (const label of ['評估時間', 'KDIGO / SA-AKI', '液體階段', 'KRT 狀態', '模式', '安全問題', '下次重評', '證據不確定性', '非自動醫囑']) expect(textarea.value).toContain(label);
  expect(textarea.value).not.toMatch(/DO_NOT_COPY_FREE_TEXT|A-dashboard|HA 狀態|姓名|病歷號|電話|地址/);
  const copied: string[] = [];
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async value => { copied.push(value); });
  await user.click(within(handoff).getByRole('button', { name: '複製交班摘要' }));
  expect(await within(handoff).findByText('已複製交班摘要')).toBeVisible();
  expect(copied).toEqual([textarea.value]);
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
  await user.click(within(handoff).getByRole('button', { name: '複製交班摘要' }));
  expect(await within(handoff).findByText('無法自動複製；請選取下方摘要手動複製。')).toBeVisible();
  expect(textarea).toHaveFocus();
});

it('handles deep routes, loading, empty cases, missing cases and storage errors without leaking another case', async () => {
  await caseRepository.createCase(patient);
  const view = mount();
  expect(screen.getByRole('status')).toHaveTextContent('讀取本機病例');
  expect(await screen.findByText('尚無時間點；請先新增評估。')).toBeVisible();
  expect(screen.getByRole('link', { name: '新增時間點' })).toHaveAttribute('href', '/SA-AKI/case/dashboard/assessment');
  view.unmount(); const missing = mount('/SA-AKI/case/other');
  expect(await screen.findByRole('alert')).toHaveTextContent('找不到病例');
  expect(screen.queryByText('A-dashboard')).not.toBeInTheDocument();
  missing.unmount(); vi.spyOn(caseRepository, 'getCase').mockRejectedValue(new Error('storage denied')); mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('無法讀取本機資料');
});

it('opens the dashboard from case overview and never uses later observations in a historical selection', async () => {
  const user = userEvent.setup();
  await caseRepository.importCase({ schemaVersion: 1, case: patient, snapshots: [observation(0, { creatinineMgDl: 1 }), observation(6, { creatinineMgDl: 4, potassiumMmolL: 6.8, refractoryHyperkalemia: true })] });
  mount('/SA-AKI/'); await user.click(await screen.findByRole('link', { name: '決策首頁 A-dashboard' }));
  await screen.findByRole('heading', { name: '決策首頁' });
  await user.selectOptions(screen.getByLabelText('評估時間點'), 's0');
  expect(screen.queryByRole('heading', { name: /urgent KRT evaluation/ })).not.toBeInTheDocument();
  expect(within(screen.getByRole('table', { name: 'SCr 數據' })).getByRole('row', { name: /6 h.*缺值/ })).toBeVisible();
  expect((screen.getByLabelText('交班摘要') as HTMLTextAreaElement).value).toContain('2026-09-21T00:00:00.000Z');
});

it('keeps a selected same-time observation aligned across dashboard input, diagnosis, and SOFA cards', async () => {
  const user = userEvent.setup();
  const prior = observation(0, { creatinineMgDl: 1, sofaScore: 4 });
  const severe = { ...observation(6, { creatinineMgDl: 3, sofaScore: 12 }), id: 'a-severe' };
  const normal = { ...observation(6, { creatinineMgDl: 1, sofaScore: 2 }), id: 'z-normal' };
  await caseRepository.importCase({ schemaVersion: 1, case: patient, snapshots: [prior, severe, normal] });
  mount(); await screen.findByRole('heading', { name: '決策首頁' });

  await user.selectOptions(screen.getByLabelText('評估時間點'), severe.id);
  expect(screen.getByText('目前 SCr').parentElement).toHaveTextContent('3 mg/dL');
  expect(screen.getByRole('article', { name: /KDIGO stage 3/ })).toBeVisible();
  expect(screen.getAllByRole('article').find(card => card.getAttribute('data-rule-id') === 'sepsis-assessment')).toHaveTextContent('目前 SOFA：12');

  await user.selectOptions(screen.getByLabelText('評估時間點'), normal.id);
  expect(screen.getByText('目前 SCr').parentElement).toHaveTextContent('1 mg/dL');
  expect(screen.getAllByRole('article').find(card => card.getAttribute('data-rule-id') === 'aki-staging')).not.toHaveTextContent('KDIGO stage 3');
  expect(screen.getAllByRole('article').find(card => card.getAttribute('data-rule-id') === 'sepsis-assessment')).toHaveTextContent('目前 SOFA：2');
});

it('renders prescription arithmetic and fails closed when measured perfusion conflicts with positive labels', async () => {
  const confirmations = { device: true, solutionComposition: true, weightBasis: true, anticoagulation: true, pharmacyDosing: true };
  await caseRepository.importCase({ schemaVersion: 1, case: patient, snapshots: [
    observation(0, { norepinephrineEquivalentMcgKgMin: 0.1, vasopressorTrend: 'unchanged', mapMmHg: 70, lactateMmolL: 1.5 }),
    observation(6, {
      actualWeightKg: 80,
      mapMmHg: 40,
      lactateMmolL: 6,
      norepinephrineEquivalentMcgKgMin: 0.4,
      vasopressorTrend: 'unchanged',
      crrtMode: 'CVVHDF',
      crrtDoseWeightKg: 80,
      crrtDoseWeightBasis: 'actual',
      crrtDowntimeHours: 0,
      crrtObservationHours: 6,
      ufNetMlHours: 150,
      anticoagulation: 'regional-citrate',
      prescriptionAssessment: {
        adultConfirmed: true,
        weightBasisReason: '目前實測體重經團隊確認',
        deliveredTargetMlKgHr: 25,
        dialysateMlHr: 1000,
        preReplacementMlHr: 0,
        postReplacementMlHr: 1000,
        preBloodPumpMlHr: 0,
        bloodFlowMlMin: 200,
        hematocritFraction: 0.3,
        perfusionAdequate: true,
        citrateContraindication: false,
        citrateProtocolAvailable: true,
        bleedingRiskReviewed: true,
        systemicAnticoagulationReviewed: true,
        device: 'PrisMax',
        confirmations,
      },
    }),
  ] });

  mount();
  await screen.findByRole('heading', { name: '決策首頁' });
  const card = screen.getAllByRole('article').find(item => item.getAttribute('data-rule-id') === 'crrt-prescription-safety')!;
  expect(card).toHaveTextContent('處方目標總 effluent：2000 mL/h');
  expect(card).toHaveTextContent('目前設定 effluent：2000 mL/h');
  expect(card).toHaveTextContent('Filtration fraction：11.9%');
  expect(card).toHaveTextContent('安全調整後 UFNET：0 mL/h');
  expect(card).toHaveTextContent('處方安全 checklist：incomplete');
  expect(card).toHaveTextContent('PrisMax');
  expect(card).toHaveTextContent('150 mL/min');
  expect(card).toHaveTextContent('量測與人工標記衝突');
  expect(card).toHaveTextContent('NE-equivalent 0.1 → 0.4');
  expect(card).toHaveTextContent('立即重新評估');
  expect(card).toHaveTextContent('非機器醫囑');
});
