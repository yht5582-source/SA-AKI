import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApplicationRoutes } from '../../src/app/routes';
import { caseRepository } from '../../src/data/caseRepository';
import { evaluateDashboard } from '../../src/features/dashboard/evaluateDashboard';
import { haInput } from '../clinical/haFixtures';

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const mount = (suffix = '') => render(<MemoryRouter initialEntries={['/case/c1/assessment' + suffix]}><ApplicationRoutes/></MemoryRouter>);
beforeEach(async () => { await caseRepository.clearAll(); sessionStorage.clear(); await caseRepository.createCase({ id: 'c1', anonymousCode: 'A-001' }); });
async function base() {
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: '感染／休克' });
  fill('評估時間（UTC）', '2026-09-21T12:00'); fill('距 Sepsis 起始時數', '12');
  await user.click(screen.getByRole('button', { name: 'AKI 評估' })); fill('目前實際體重', '70');
  await user.click(screen.getByRole('button', { name: '模式／ECMO' })); fill('目前使用 ECMO', 'false');
  return user;
}
async function save(user: ReturnType<typeof userEvent.setup>, incompleteHa = false) {
  await user.click(screen.getByRole('button', { name: '檢視並確認' }));
  if (incompleteHa) await user.click(screen.getByRole('checkbox', { name: '僅儲存未完成 HA 觀察（不代表符合資格）' }));
  expect(screen.getByRole('button', { name: '確認儲存時間點' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: '確認儲存時間點' })); await screen.findByText('時間點已儲存');
  return (await caseRepository.getCase('c1'))!;
}

it('reaches an explicitly assessed fluid-tolerance branch with typed VExUS zero, respiratory support and signed interval balance', async () => {
  mount(); const user = await base();
  await user.click(screen.getByRole('button', { name: '灌流／液體' }));
  expect(screen.getByLabelText('VExUS 分級')).toHaveValue('');
  fill('VExUS 分級', '0'); fill('肺部 B-lines', 'absent'); fill('區間淨液體平衡', '-250');
  await user.click(screen.getByRole('button', { name: 'KRT' }));
  fill('呼吸支持', 'room-air'); fill('肺水腫', 'false');
  const stored = await save(user);
  expect(stored.snapshots[0]).toMatchObject({ vexusGrade: 0, intervalNetFluidBalanceMl: -250, respiratorySupport: 'room-air' });
  expect(stored.snapshots[0].uremicManifestations).toBeUndefined();
  expect(evaluateDashboard(stored.case, stored.snapshots).find(result => result.id === 'fluid-tolerance')?.conclusion).toContain('目前未見肺／靜脈不耐受訊號');
});

it('reaches pulmonary-edema and multiple uremic KRT branches plus explicit ECMO/CRRT anticoagulation overlap', async () => {
  const view = mount(); const user = await base();
  await user.click(screen.getByRole('button', { name: 'KRT' }));
  fill('呼吸支持', 'high-flow-nasal-oxygen'); fill('P/F 比值', '100'); fill('肺水腫', 'true'); fill('難治性肺水腫', 'true');
  await user.click(screen.getByRole('checkbox', { name: '尿毒性腦病變' }));
  await user.click(screen.getByRole('checkbox', { name: '尿毒性心包炎' }));
  await user.click(screen.getByRole('button', { name: '模式／ECMO' }));
  for (const [label, value] of Object.entries({ '目前使用 ECMO': 'true', 'ECMO 抗凝': 'systemic-heparin', 'ECMO 連接方式': 'integrated-circuit', 'ECMO 進入壓力': '150', 'ECMO 回流壓力': '120', 'ECMO 空氣風險已審查': 'true', 'ECMO 壓力相容已審查': 'true', 'ECMO 流量': '4' })) fill(label, value);
  await user.click(screen.getByRole('button', { name: '處方' })); fill('抗凝', 'regional-citrate');
  const stored = await save(user);
  expect(stored.snapshots[0].uremicManifestations).toEqual(['encephalopathy', 'pericarditis']);
  const results = evaluateDashboard(stored.case, stored.snapshots);
  const krt = results.find(result => result.id === 'krt-emergency-indications')!;
  expect(krt.severity).toBe('critical');
  expect(krt.evidence).toContain('肺水腫／低氧血症對醫療與呼吸支持無反應已確認');
  expect(krt.evidence).toContain('明確尿毒併發症：encephalopathy'); expect(krt.evidence).toContain('明確尿毒併發症：pericarditis');
  expect(results.find(result => result.id === 'ecmo-krt-connection')?.missingData).toEqual([]);
  view.unmount(); mount('/' + stored.snapshots[0].id);
  await screen.findByText('已儲存時間點（唯讀）');
  await user.click(screen.getByRole('button', { name: '返回編輯' })); await user.click(screen.getByRole('button', { name: 'KRT' }));
  expect(screen.getByRole('checkbox', { name: '尿毒性心包炎' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: '尿毒性腦病變' })).toBeDisabled();
  expect((await caseRepository.exportCase('c1')).snapshots).toEqual(stored.snapshots);
});

it('lets an explicit negative uremic assessment differ from unknown', async () => {
  mount(); const user = await base();
  await user.click(screen.getByRole('button', { name: 'KRT' }));
  await user.click(screen.getByRole('button', { name: '尿毒併發症：已評估未見' }));
  const stored = await save(user);
  expect(stored.snapshots[0].uremicManifestations).toEqual([]);
  expect(evaluateDashboard(stored.case, stored.snapshots).find(result => result.id === 'krt-emergency-indications')?.missingData).not.toContain('明確尿毒併發症評估');
});

it('records an ongoing HA exposure with typed repeatable drug/TDM/events and keeps its complete read-only round trip', async () => {
  const fixture = haInput();
  await caseRepository.saveSnapshot({ ...fixture.previousSnapshot, caseId: 'c1' });
  await caseRepository.saveSnapshot({ ...fixture.snapshot, caseId: 'c1' });
  const view = mount(); const user = await base();
  await user.click(screen.getByRole('button', { name: '感染／休克' })); fill('NE 等效劑量', '0.6');
  await user.click(screen.getByRole('button', { name: '選配 HA' })); await user.click(screen.getByRole('checkbox', { name: '主動啟用 HA 救援評估' }));
  for (const [label, value] of Object.entries({ 'HA 暴露裝置': 'CytoSorb', 'HA 暴露目標': 'cytokines', 'HA 暴露開始（UTC）': '2026-09-21T06:00', 'HA 血流量': '150', 'HA 累積處理血量': '20', 'HA 記錄反應': 'worsening', 'HA 反應審查時間（UTC）': '2026-09-21T12:00' })) fill(label, value);
  const drugs = [{ drugName: 'vancomycin', administeredTimestamp: '2026-09-21T07:00:00Z', doseMg: 1500 }, { drugName: 'meropenem', administeredTimestamp: '2026-09-21T09:00:00Z', doseMg: 1000 }];
  const tdm = [{ drugName: 'vancomycin', sampledTimestamp: '2026-09-21T11:00:00Z', concentrationMgL: 12 }];
  const events = [{ timestamp: '2026-09-21T11:00:00Z', kind: 'hypotension', severity: 'severe' }];
  fill('HA 給藥紀錄（JSON 陣列）', JSON.stringify(drugs)); fill('HA TDM（JSON 陣列）', JSON.stringify(tdm)); fill('HA 不良事件（JSON 陣列）', JSON.stringify(events));
  fill('HA 換匣時間（JSON 陣列）', '["2026-09-21T10:00:00Z"]');
  const stored = await save(user, true);
  const exposure = stored.snapshots.at(-1)!.hemoadsorptionExposures![0];
  expect(exposure).toMatchObject({ device: 'CytoSorb', targetAdsorbate: 'cytokines', startedTimestamp: '2026-09-21T06:00:00.000Z', bloodFlowMlMin: 150, cumulativeProcessedBloodVolumeL: 20, response: 'worsening', responseReviewedTimestamp: '2026-09-21T12:00:00.000Z', drugExposures: drugs, therapeuticDrugMonitoring: tdm, adverseEvents: events });
  expect(exposure.stoppedTimestamp).toBeUndefined();
  const response = evaluateDashboard(stored.case, stored.snapshots).find(result => result.id === 'ha-response-review');
  expect(response?.severity).toBe('critical'); expect(response?.evidence.join(' ')).toContain('Rising NE-equivalent');
  view.unmount(); mount('/' + stored.snapshots.at(-1)!.id); await screen.findByText('已儲存時間點（唯讀）');
  expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument();
  expect(screen.getByText(/HA 反應審查時間（UTC）：2026-09-21T12:00/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: '返回編輯' })); await user.click(screen.getByRole('button', { name: '選配 HA' }));
  expect(JSON.parse((screen.getByLabelText('HA 給藥紀錄（JSON 陣列）') as HTMLTextAreaElement).value)).toEqual(drugs);
  expect(screen.getByLabelText('HA 給藥紀錄（JSON 陣列）')).toBeDisabled();
  expect((await caseRepository.exportCase('c1')).snapshots).toEqual(stored.snapshots);
});

it.each(['not-json', '[{"drugName":"vancomycin","administeredTimestamp":"2026-09-21T07:00:00Z","doseMg":"1500"}]', '[{"drugName":"vancomycin","administeredTimestamp":"2026-09-21T07:00:00Z","patientName":"forbidden"}]'])('blocks malformed/coerced/identifying HA subrecords: %s', async raw => {
  mount(); const user = await base(); await user.click(screen.getByRole('button', { name: '選配 HA' }));
  await user.click(screen.getByRole('checkbox', { name: '主動啟用 HA 救援評估' }));
  fill('HA 暴露裝置', 'CytoSorb'); fill('HA 暴露開始（UTC）', '2026-09-21T06:00'); fill('HA 給藥紀錄（JSON 陣列）', raw);
  expect(screen.getByLabelText('HA 給藥紀錄（JSON 陣列）')).toHaveAttribute('aria-invalid', 'true');
  await user.click(screen.getByRole('button', { name: '檢視並確認' }));
  await user.click(screen.getByRole('checkbox', { name: '僅儲存未完成 HA 觀察（不代表符合資格）' }));
  expect(screen.getByRole('button', { name: '確認儲存時間點' })).toBeDisabled();
  expect((await caseRepository.getCase('c1'))!.snapshots).toEqual([]);
});
