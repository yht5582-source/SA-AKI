import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvidenceBadge } from '../../src/components/EvidenceBadge';
import { DecisionCard } from '../../src/components/DecisionCard';
import { TrendCharts } from '../../src/features/dashboard/TrendCharts';
import { sortDecisions } from '../../src/features/dashboard/evaluateDashboard';
import type { ClinicalSnapshot, DecisionResult } from '../../src/clinical/types';

const decision: DecisionResult = { id: 'aki-staging', severity: 'stable', conclusion: '需核實的結論', evidence: ['已量測依據'], missingData: ['缺少比較值'], actions: ['床邊重評'], counterfactuals: ['新量測可改變判斷'], sourceIds: ['KDIGO_2012'] };
const observation = (hour: number, patch: Partial<ClinicalSnapshot> = {}): ClinicalSnapshot => ({ id: `s${hour}`, caseId: 'c', timestamp: new Date(Date.UTC(2026, 8, 21, hour)).toISOString(), hoursFromSepsisOnset: hour, actualWeightKg: 70, onEcmo: false, ...patch });

it.each([
  ['KDIGO_2026_DRAFT', '草案｜不可作為可執行規則', '文獻核實：已核實'],
  ['TIGRIS_2026', '未核實｜不可作為可執行規則', '文獻核實：未核實'],
  ['MISSING', '未知來源｜不可作為可執行規則', '文獻核實：未核實'],
])('does not present %s as usable rule support even if a rule is supplied', (sourceId, label, verification) => {
  render(<EvidenceBadge sourceId={sourceId} ruleId="aki-staging"/>);
  expect(screen.getByText(new RegExp(label.replaceAll('|', '\\|')))).toBeVisible();
  expect(screen.getByText(/僅供背景查閱；不支持此可執行規則/)).toBeVisible();
  expect(screen.getByText(new RegExp(verification))).toBeVisible();
  expect(screen.queryByText(/來源適用範圍已對應/)).not.toBeInTheDocument();
});

it('discloses evidence, counterfactuals, reassessment and icon+text severity without mutating sort input', async () => {
  const results = ['stable', 'monitor', 'warning', 'critical'].map(severity => ({ ...decision, severity } as DecisionResult));
  expect(sortDecisions(results).map(result => result.severity)).toEqual(['critical', 'warning', 'monitor', 'stable']);
  expect(results[0].severity).toBe('stable');
  const user = userEvent.setup(); render(<DecisionCard result={{ ...decision, reassessWithinHours: 0 }}/>);
  expect(screen.getByText('穩定')).toBeVisible(); expect(screen.getByText('立即重評')).toBeVisible();
  expect(screen.getByRole('article').querySelector('svg')).not.toBeNull();
  await user.click(screen.getByText('哪些變化會改變判斷？'));
  expect(screen.getByText('新量測可改變判斷')).toBeVisible();
  expect(screen.getByText('已量測依據')).toBeVisible();
});

it.each([['KDIGO_2012', 'aki-staging'], ['SEPSIS_3_2016', 'sepsis-assessment'], ['ADQI_28', 'sa-aki-timing'], ['APP_SA_AKI_TIMING_V1', 'sa-aki-timing']])('maps engine presentation ids to their verified claim ids: %s / %s', (sourceId, ruleId) => {
  render(<EvidenceBadge sourceId={sourceId} ruleId={ruleId}/>);
  expect(screen.getByText('來源適用範圍已對應；仍非自動醫囑')).toBeVisible();
});

it('keeps missing baseline unknown in delta view and excludes other cases and out-of-window samples', async () => {
  const user = userEvent.setup(); render(<TrendCharts patient={{ id: 'c', anonymousCode: 'A-c' }} snapshots={[observation(0), observation(6, { lactateMmolL: 4 }), observation(-1, { lactateMmolL: 111 }), observation(73, { lactateMmolL: 222 }), observation(12, { caseId: 'other', lactateMmolL: 333 })]}/>);
  const table = screen.getByRole('table', { name: '乳酸 數據' });
  expect(table).toHaveTextContent('4'); expect(table).not.toHaveTextContent(/111|222|333/);
  await user.click(screen.getByRole('button', { name: '相對基準變化' }));
  expect(within(table).getByRole('row', { name: /6 h.*缺值/ })).toBeVisible();
  expect(screen.getByText('乳酸 基準：未知 mmol/L（首個時間點 0 h）')).toBeVisible();
});

it('does not calculate a delta from an ambiguous duplicated baseline', async () => {
  const user = userEvent.setup(); render(<TrendCharts patient={{ id: 'c', anonymousCode: 'A-c' }} snapshots={[observation(0, { lactateMmolL: 2 }), observation(0, { id: 'duplicate', lactateMmolL: 3 }), observation(6, { lactateMmolL: 4 })]}/>);
  await user.click(screen.getByRole('button', { name: '相對基準變化' }));
  expect(within(screen.getByRole('table', { name: '乳酸 數據' })).getByRole('row', { name: /6 h.*缺值/ })).toBeVisible();
});

it('withholds delta comparisons across changed normalization bases', async () => {
  const user = userEvent.setup(); render(<TrendCharts patient={{ id: 'c', anonymousCode: 'A-c' }} snapshots={[observation(0, { urineVolumeMl: 70, urineObservationHours: 1, urineNormalizationWeightKg: 70, urineWeightBasis: 'actual', deliveredEffluentMlKgHours: 20, crrtDoseWeightKg: 70, crrtDoseWeightBasis: 'actual' }), observation(6, { urineVolumeMl: 70, urineObservationHours: 1, urineNormalizationWeightKg: 50, urineWeightBasis: 'ideal', deliveredEffluentMlKgHours: 25, crrtDoseWeightKg: 50, crrtDoseWeightBasis: 'ideal' })]}/>);
  await user.click(screen.getByRole('button', { name: '相對基準變化' }));
  for (const name of ['標準化尿量 數據', '實際交付劑量 數據']) expect(within(screen.getByRole('table', { name })).getByRole('row', { name: /6 h.*缺值/ })).toBeVisible();
});
