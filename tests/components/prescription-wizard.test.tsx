import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApplicationRoutes } from '../../src/app/routes';
import { caseRepository } from '../../src/data/caseRepository';
import { calculatePrescription } from '../../src/clinical/prescription';
import { evaluateDashboard, prescriptionInput } from '../../src/features/dashboard/evaluateDashboard';

beforeEach(async () => { await caseRepository.clearAll(); sessionStorage.clear(); await caseRepository.createCase({ id: 'c1', anonymousCode: 'A-001' }); });

it('creates a complete non-order CRRT/RCA review through accessible controls and retains explicit zero flows', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/case/c1/assessment']}><ApplicationRoutes/></MemoryRouter>);
  await screen.findByRole('heading', { name: '感染／休克' });
  const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fill('評估時間（UTC）', '2026-09-21T12:00'); fill('距 Sepsis 起始時數', '12'); fill('升壓劑趨勢', 'unchanged');
  await user.click(screen.getByRole('button', { name: 'AKI 評估' })); fill('目前實際體重', '80');
  await user.click(screen.getByRole('button', { name: '模式／ECMO' })); fill('目前使用 ECMO', 'false');
  await user.click(screen.getByRole('button', { name: '處方' }));
  expect(screen.getByText(/處方算式與 RCA.*非機器醫囑/)).toBeVisible();
  expect(screen.getByLabelText('處方評估：已確認成人')).toHaveValue('');
  expect(screen.getByLabelText('Hct 比例')).toHaveAccessibleDescription(/0.*1.*0.30/);
  expect(screen.getByLabelText('PBP／citrate 獨立流量')).toHaveAccessibleDescription(/mL\/h.*0/);
  for (const [label, value] of Object.entries({ 'CRRT 模式': 'CVVHDF', '劑量體重': '80', '劑量體重基準': 'actual', '劑量體重選擇理由': '目前實測體重經團隊確認', '停機時數': '0', 'CRRT 觀察時數': '6', 'UFNET': '0', '抗凝': 'regional-citrate', '處方評估：已確認成人': 'true', '交付劑量目標': '25', '透析液流量': '1000', '前稀釋置換流量': '0', '後稀釋置換流量': '1000', 'PBP／citrate 獨立流量': '0', '病人全血流量 Qb': '200', 'Hct 比例': '0.3', '灌流已確認足夠': 'true', 'Citrate 禁忌／代謝風險已判定存在': 'false', '具備本地 citrate 規範與監測團隊': 'true', '出血／凝血／HIT 風險已審查': 'true', '既有全身抗凝與重疊已審查': 'true', 'CRRT 裝置': 'PrisMax', '確認裝置與濾器': 'true', '確認溶液成分': 'true', '確認劑量體重基準': 'true', '確認抗凝計畫': 'true', '確認藥師劑量／TDM': 'true' })) fill(label, value);
  await user.click(screen.getByRole('button', { name: '檢視並確認' }));
  expect(screen.getByRole('button', { name: '確認儲存時間點' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: '確認儲存時間點' })); await screen.findByText('時間點已儲存');
  const stored = (await caseRepository.getCase('c1'))!;
  expect(stored.snapshots[0].prescriptionAssessment?.preBloodPumpMlHr).toBe(0);
  expect(calculatePrescription(prescriptionInput(stored.case, stored.snapshots[0]))).toMatchObject({ totalEffluentMlHr: 2000, checklistComplete: true });
  expect(evaluateDashboard(stored.case, stored.snapshots).find(result => result.id === 'crrt-anticoagulation')?.conclusion).toContain('Conditional RCA review');
});
