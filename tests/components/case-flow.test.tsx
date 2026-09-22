import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApplicationRoutes } from '../../src/app/routes';
import { caseRepository } from '../../src/data/caseRepository';

beforeEach(async () => { await caseRepository.clearAll(); sessionStorage.clear(); });
afterEach(() => vi.restoreAllMocks());
const mount = (path = '/SA-AKI/') => render(<MemoryRouter basename="/SA-AKI" initialEntries={[path]}><ApplicationRoutes /></MemoryRouter>);

it('creates an anonymous case by keyboard without identifier fields and reopens its assessment', async () => {
  const user = userEvent.setup(); mount();
  await user.click(await screen.findByRole('button', { name: '新增匿名病例' }));
  const form = screen.getByRole('form', { name: '建立匿名病例' });
  expect(within(form).queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/姓名|病歷號|出生日期|電話|地址/)).not.toBeInTheDocument();
  screen.getByRole('button', { name: '建立病例' }).focus(); await user.keyboard('{Enter}');
  expect(await screen.findByRole('heading', { name: '感染／休克' })).toBeVisible();
  const cases = await caseRepository.listCases(); expect(cases).toHaveLength(1);
  expect(cases[0].anonymousCode).toMatch(/^A-/);
  await user.click(screen.getAllByRole('link', { name: '病例總覽' })[0]);
  await user.click(await screen.findByRole('link', { name: /開啟 A-/ }));
  expect(await screen.findByRole('heading', { name: '感染／休克' })).toBeVisible();
});

it('exports versioned JSON and rejects invalid imports without changing the list or data', async () => {
  await caseRepository.createCase({ id: 'existing', anonymousCode: 'A-existing' });
  const user = userEvent.setup(); mount();
  await user.click(await screen.findByRole('button', { name: '匯出 A-existing' }));
  const exported = JSON.parse((await screen.findByLabelText('匯出 JSON') as HTMLTextAreaElement).value);
  expect(exported).toEqual({ schemaVersion: 1, case: { id: 'existing', anonymousCode: 'A-existing' }, snapshots: [] });
  await user.click(screen.getByLabelText('匯入 JSON')); await user.paste('{"schemaVersion":999}');
  await user.click(screen.getByRole('button', { name: '驗證並匯入' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('匯入失敗');
  expect(screen.getByRole('link', { name: '開啟 A-existing' })).toBeVisible();
  expect(await caseRepository.listCases()).toEqual([{ id: 'existing', anonymousCode: 'A-existing' }]);
});

it('imports a validated versioned case and confirms deletion and clear-all before mutating storage', async () => {
  const user = userEvent.setup(); mount();
  expect(screen.getByText('已確認病例與時間點存於 IndexedDB；未確認評估草稿另存於目前分頁的 sessionStorage。刪除／清除會嘗試移除目前分頁草稿，若失敗會警示。')).toBeVisible();
  const input = screen.getByLabelText('匯入 JSON');
  await user.click(input); await user.paste(JSON.stringify({ schemaVersion: 1, case: { id: 'imported', anonymousCode: 'A-imported' }, snapshots: [] }));
  await user.click(screen.getByRole('button', { name: '驗證並匯入' }));
  sessionStorage.setItem('sa-aki:assessment-draft:v1:imported', JSON.stringify({ values: { creatinineMgDl: '1.2' }, step: 1, haEnabled: false }));
  sessionStorage.setItem('unrelated-session-data', 'keep');
  await user.click(await screen.findByRole('button', { name: '刪除 A-imported' }));
  expect(await caseRepository.listCases()).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: '取消' }));
  expect(await caseRepository.listCases()).toHaveLength(1);
  expect(sessionStorage.getItem('sa-aki:assessment-draft:v1:imported')).not.toBeNull();
  await user.click(screen.getByRole('button', { name: '刪除 A-imported' }));
  await user.click(screen.getByRole('button', { name: '確認刪除' }));
  await waitFor(async () => expect(await caseRepository.listCases()).toHaveLength(0));
  expect(sessionStorage.getItem('sa-aki:assessment-draft:v1:imported')).toBeNull();
  await caseRepository.createCase({ id: 'next', anonymousCode: 'A-next' });
  sessionStorage.setItem('sa-aki:assessment-draft:v1:next', JSON.stringify({ values: {}, step: 0, haEnabled: false }));
  sessionStorage.setItem('sa-aki:assessment-draft:v1:orphan', JSON.stringify({ values: {}, step: 0, haEnabled: false }));
  await user.click(screen.getByRole('button', { name: '清除全部本機資料' }));
  expect(await caseRepository.listCases()).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: '取消' }));
  await user.click(screen.getByRole('button', { name: '清除全部本機資料' }));
  await user.click(screen.getByRole('button', { name: '確認清除全部' }));
  await waitFor(async () => expect(await caseRepository.listCases()).toHaveLength(0));
  expect(sessionStorage.getItem('sa-aki:assessment-draft:v1:next')).toBeNull();
  expect(sessionStorage.getItem('sa-aki:assessment-draft:v1:orphan')).toBeNull();
  expect(sessionStorage.getItem('unrelated-session-data')).toBe('keep');
});

it('keeps successful case deletion and warns when current-tab draft cleanup is denied', async () => {
  await caseRepository.createCase({ id: 'delete-denied', anonymousCode: 'A-delete' });
  sessionStorage.setItem('sa-aki:assessment-draft:v1:delete-denied', JSON.stringify({ values: {}, step: 0, haEnabled: false }));
  const user = userEvent.setup(); mount();
  await user.click(await screen.findByRole('button', { name: '刪除 A-delete' }));
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });

  await user.click(screen.getByRole('button', { name: '確認刪除' }));

  await waitFor(async () => expect(await caseRepository.getCase('delete-denied')).toBeUndefined());
  expect(screen.getByRole('status')).toHaveTextContent('病例已從 IndexedDB 刪除，但瀏覽器無法清除目前分頁的評估草稿；草稿可能仍保留。請關閉分頁／瀏覽工作階段，並依機構政策確認或清除網站資料。');
  expect(sessionStorage.getItem('sa-aki:assessment-draft:v1:delete-denied')).not.toBeNull();
});

it('keeps successful clear-all and warns when current-tab draft cleanup is denied', async () => {
  await caseRepository.createCase({ id: 'clear-denied', anonymousCode: 'A-clear' });
  sessionStorage.setItem('sa-aki:assessment-draft:v1:clear-denied', JSON.stringify({ values: {}, step: 0, haEnabled: false }));
  const user = userEvent.setup(); mount();
  await user.click(await screen.findByRole('button', { name: '清除全部本機資料' }));
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });

  await user.click(screen.getByRole('button', { name: '確認清除全部' }));

  await waitFor(async () => expect(await caseRepository.listCases()).toHaveLength(0));
  expect(screen.getByRole('status')).toHaveTextContent('病例與時間點已從 IndexedDB 清除，但瀏覽器無法清除目前分頁的評估草稿；草稿可能仍保留。請關閉分頁／瀏覽工作階段，並依機構政策確認或清除網站資料。');
  expect(sessionStorage.getItem('sa-aki:assessment-draft:v1:clear-denied')).not.toBeNull();
});

it('handles a missing case deep link safely beneath /SA-AKI/', async () => {
  mount('/SA-AKI/case/missing/assessment');
  expect(await screen.findByRole('alert')).toHaveTextContent('找不到病例');
  expect(screen.getAllByRole('link', { name: '病例總覽' })[0]).toHaveAttribute('href', '/SA-AKI');
});

it('validates anonymous baseline/provenance fields during case creation', async () => {
  const user = userEvent.setup(); mount();
  await user.click(await screen.findByRole('button', { name: '新增匿名病例' }));
  await user.type(screen.getByLabelText('基準 SCr'), '-1');
  await user.click(screen.getByRole('button', { name: '建立病例' }));
  expect(screen.getByLabelText('基準 SCr')).toHaveAttribute('aria-invalid', 'true');
  expect(await caseRepository.listCases()).toHaveLength(0);
  await user.clear(screen.getByLabelText('基準 SCr')); await user.type(screen.getByLabelText('基準 SCr'), '0.8');
  await user.selectOptions(screen.getByLabelText('基準 SCr 來源'), 'measured-outpatient');
  await user.selectOptions(screen.getByLabelText('基準 SCr 可信度'), 'high');
  await user.type(screen.getByLabelText('Sepsis 起始時間（UTC）'), '2026-09-21T00:00');
  await user.click(screen.getByRole('button', { name: '建立病例' }));
  await screen.findByRole('heading', { name: '感染／休克' });
  expect((await caseRepository.listCases())[0]).toMatchObject({ baselineCreatinineMgDl: 0.8, baselineCreatinineSource: 'measured-outpatient', baselineCreatinineConfidence: 'high', sepsisOnsetTimestamp: '2026-09-21T00:00:00.000Z' });
});

it('corrects anonymous metadata, cancels without mutation, and reopens with snapshots preserved', async () => {
  const patient = { id: 'editable', anonymousCode: 'A-edit', baselineCreatinineMgDl: 1, sepsisOnsetTimestamp: '2026-09-21T00:00:00.125Z' };
  const snapshot = { id: 's1', caseId: 'editable', timestamp: '2026-09-21T06:00:00.125Z', hoursFromSepsisOnset: 6, actualWeightKg: 70, onEcmo: false };
  await caseRepository.importCase({ schemaVersion: 1, case: patient, snapshots: [snapshot] });
  const user = userEvent.setup(); const view = mount();
  await user.click(await screen.findByRole('button', { name: '編輯 A-edit' }));
  expect(screen.queryByLabelText(/姓名|病歷號|出生日期|電話|地址/)).not.toBeInTheDocument();
  await user.clear(screen.getByLabelText('基準 SCr')); await user.type(screen.getByLabelText('基準 SCr'), '0.8');
  await user.click(screen.getByRole('button', { name: '取消' }));
  expect(await caseRepository.getCase('editable')).toEqual({ case: patient, snapshots: [snapshot] });
  await user.click(screen.getByRole('button', { name: '編輯 A-edit' }));
  expect(screen.getByLabelText('基準 SCr')).toHaveValue(1);
  await user.clear(screen.getByLabelText('基準 SCr')); await user.type(screen.getByLabelText('基準 SCr'), '0.8');
  await user.selectOptions(screen.getByLabelText('基準 SCr 來源'), 'measured-outpatient');
  await user.click(screen.getByRole('button', { name: '確認更新病例' }));
  await screen.findByText('病例資料已更新');
  expect(await caseRepository.getCase('editable')).toEqual({ case: { ...patient, baselineCreatinineMgDl: 0.8, baselineCreatinineSource: 'measured-outpatient' }, snapshots: [snapshot] });
  view.unmount(); mount();
  await user.click(await screen.findByRole('button', { name: '編輯 A-edit' }));
  expect(screen.getByLabelText('基準 SCr')).toHaveValue(0.8);
  expect(screen.getByLabelText('Sepsis 起始時間（UTC）')).toHaveValue('2026-09-21T00:00:00.125');
});

it('rejects conflicting case metadata updates atomically and retains the prior case and snapshots', async () => {
  const patient = { id: 'editable', anonymousCode: 'A-edit', baselineCreatinineMgDl: 1, sepsisOnsetTimestamp: '2026-09-21T00:00:00.000Z', shockOnsetTimestamp: '2026-09-21T02:00:00.000Z' };
  const snapshot = { id: 's1', caseId: 'editable', timestamp: '2026-09-21T06:00:00.000Z', hoursFromSepsisOnset: 6, actualWeightKg: 70, onEcmo: false };
  await caseRepository.importCase({ schemaVersion: 1, case: patient, snapshots: [snapshot] });
  const user = userEvent.setup(); mount();
  await user.click(await screen.findByRole('button', { name: '編輯 A-edit' }));
  await user.clear(screen.getByLabelText('基準 SCr')); await user.type(screen.getByLabelText('基準 SCr'), '0.7');
  await user.clear(screen.getByLabelText('Sepsis 起始時間（UTC）')); await user.type(screen.getByLabelText('Sepsis 起始時間（UTC）'), '2026-09-21T01:00');
  await user.click(screen.getByRole('button', { name: '確認更新病例' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('更新失敗');
  expect(await caseRepository.getCase('editable')).toEqual({ case: patient, snapshots: [snapshot] });
  await user.clear(screen.getByLabelText('休克起始時間（UTC）')); await user.type(screen.getByLabelText('休克起始時間（UTC）'), '2026-09-20T23:00');
  expect(screen.getByLabelText('休克起始時間（UTC）')).toHaveAttribute('aria-invalid', 'true');
  await user.click(screen.getByRole('button', { name: '確認更新病例' }));
  expect(await caseRepository.getCase('editable')).toEqual({ case: patient, snapshots: [snapshot] });
});

it('builds an HA baseline and a serial multidisciplinary review using only case and assessment UI', async () => {
  const user = userEvent.setup(); mount();
  await user.click(screen.getByRole('button', { name: '新增匿名病例' }));
  await user.click(screen.getByRole('button', { name: '建立病例' }));
  async function enterObservation(hour: number, ne: string, lactate: string, sofa: string, il6: string) {
    await screen.findByRole('heading', { name: '感染／休克' });
    await user.type(screen.getByLabelText('評估時間（UTC）'), `2026-09-21T0${hour}:00`);
    await user.type(screen.getByLabelText('距 Sepsis 起始時數'), String(hour));
    await user.type(screen.getByLabelText('NE 等效劑量'), ne);
    await user.type(screen.getByLabelText('乳酸'), lactate);
    await user.type(screen.getByLabelText('SOFA'), sofa);
    await user.selectOptions(screen.getByLabelText('感染源控制'), 'achieved');
    await user.type(screen.getByLabelText('首次抗菌藥時間（UTC）'), '2026-09-21T01:00');
    await user.click(screen.getByRole('button', { name: 'AKI 評估' }));
    await user.type(screen.getByLabelText('目前實際體重'), '70');
    await user.type(screen.getByLabelText('尿量'), '60');
    await user.type(screen.getByLabelText('觀察時數'), '2');
    await user.click(screen.getByRole('button', { name: '灌流／液體' }));
    await user.type(screen.getByLabelText('MAP'), '62');
    await user.type(screen.getByLabelText('微血管回填時間'), '4');
    await user.click(screen.getByRole('button', { name: '模式／ECMO' }));
    await user.selectOptions(screen.getByLabelText('目前使用 ECMO'), 'false');
    await user.click(screen.getByRole('button', { name: '選配 HA' }));
    await user.click(screen.getByRole('checkbox', { name: '主動啟用 HA 救援評估' }));
    await user.type(screen.getByLabelText('IL-6'), il6);
  }
  await enterObservation(4, '0.2', '3.5', '11', '1200');
  await user.click(screen.getByRole('button', { name: '檢視並確認' }));
  expect(screen.getByText('資料不足，HA 評估未完成。')).toBeVisible();
  await user.click(screen.getByRole('checkbox', { name: '僅儲存未完成 HA 觀察（不代表符合資格）' }));
  await user.click(screen.getByRole('button', { name: '確認儲存時間點' }));
  await screen.findByText('已儲存時間點（唯讀）');
  expect(await screen.findByText('IL-6：1200 pg/mL')).toBeVisible();
  expect(screen.getByText('已保存未完成 HA 觀察；未記錄審查完成。')).toBeVisible();
  await user.click(screen.getByRole('link', { name: '新增時間點' }));
  await enterObservation(6, '0.3', '4', '12', '1800');
  for (const label of ['已確認成人', '已確認感染性休克', '可逆特徵', '抗菌藥標準照護已評估', '感染源控制已評估', '液體已評估', '升壓劑已評估', '類固醇已評估', '高發炎表型', '目標仍存在', '血小板可接受', '凝血可接受', '白蛋白可接受', '肝腎已審查', '電解質已審查', '血管通路已審查', '抗凝已審查', '管路相容', '藥物移除計畫', '照護目標相容', '重症團隊審查', '腎臟團隊審查', '感染團隊審查', '藥師暴露計畫', 'HA 監測計畫', 'HA 停止計畫', '裝置規範已審查']) await user.selectOptions(screen.getByLabelText(label), 'true');
  for (const label of ['免疫麻痺', '低 HLA-DR', '未控制出血', '不可逆器官衰竭']) await user.selectOptions(screen.getByLabelText(label), 'false');
  for (const [label, value] of [['待審查裝置', 'CytoSorb'], ['目標吸附物', 'cytokines'], ['休克病程', 'worsening'], ['治理場域', 'registry'], ['同意程序', 'obtained']]) await user.selectOptions(screen.getByLabelText(label), value);
  for (const [label, value] of [['血小板', '150'], ['纖維蛋白原', '3'], ['白蛋白', '28'], ['HA 重評時限', '6']]) await user.type(screen.getByLabelText(label), value);
  expect(screen.getByText('可送多專科審查')).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('待確認多專科審查');
  await user.click(screen.getByRole('button', { name: '完成 HA 多專科審查' }));
  await user.click(screen.getByRole('button', { name: '檢視並確認' }));
  await user.click(screen.getByRole('button', { name: '確認儲存時間點' }));
  await screen.findByText('已儲存時間點（唯讀）');
  expect(await screen.findByText('IL-6：1800 pg/mL')).toBeVisible();
  expect(screen.getByText('HA 多專科審查已記錄；非治療資格或自動醫囑。')).toBeVisible();
  expect(screen.getByRole('link', { name: '4 h · 2026-09-21T04:00:00.000Z' })).toBeVisible();
  expect(screen.getByRole('link', { name: '6 h · 2026-09-21T06:00:00.000Z' })).toBeVisible();
}, 20000);
