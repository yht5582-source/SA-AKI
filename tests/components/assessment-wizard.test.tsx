import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApplicationRoutes } from '../../src/app/routes';
import { caseRepository } from '../../src/data/caseRepository';
import { haInput } from '../clinical/haFixtures';

beforeEach(async () => { await caseRepository.clearAll(); sessionStorage.clear(); await caseRepository.createCase({ id: 'c1', anonymousCode: 'A-001' }); });
afterEach(() => vi.restoreAllMocks());
const mount = (suffix = '') => render(<MemoryRouter basename="/SA-AKI" initialEntries={['/SA-AKI/case/c1/assessment' + suffix]}><ApplicationRoutes /></MemoryRouter>);
const step = (name: string) => screen.getByRole('button', { name });

it('moves focus back to the current step heading when its stepper control is reselected', async () => {
  const user = userEvent.setup(); mount();
  const heading = await screen.findByRole('heading', { name: '感染／休克' });
  const currentStep = screen.getByRole('button', { name: '感染／休克' });

  await user.click(currentStep);

  expect(heading).toHaveFocus();
});

it('returns from the first assessment step to case editing and resumes the preserved draft after updating', async () => {
  const user = userEvent.setup(); mount();
  await screen.findByRole('heading', { name: '感染／休克' });
  await user.type(screen.getByLabelText('距 Sepsis 起始時數'), '6');

  await user.click(screen.getByRole('button', { name: '上一步：病例資料' }));

  expect(await screen.findByRole('form', { name: '編輯匿名病例' })).toBeVisible();
  await user.type(screen.getByLabelText('基準 SCr'), '1.1');
  await user.click(screen.getByRole('button', { name: '確認更新病例' }));

  expect(await screen.findByRole('heading', { name: '感染／休克' })).toBeVisible();
  expect(screen.getByLabelText('距 Sepsis 起始時數')).toHaveValue(6);
  expect((await caseRepository.getCase('c1'))?.case.baselineCreatinineMgDl).toBe(1.1);
});

it('lets the user jump from a missing-data prompt to the exact field that needs completion', async () => {
  const user = userEvent.setup(); mount();
  await screen.findByRole('heading', { name: '感染／休克' });
  const missingItem = screen.getByText('目前 SCr（臨床評估未完成）').closest('li');
  expect(missingItem).not.toBeNull();

  await user.click(within(missingItem!).getByRole('button', { name: '前往填寫目前 SCr' }));

  expect(screen.getByRole('heading', { name: 'AKI 評估' })).toBeVisible();
  expect(screen.getByLabelText('目前 SCr')).toHaveFocus();
});

it('navigates the eight ordered steps and preserves numeric zero separately from unknown across navigation and reload', async () => {
  const user = userEvent.setup(); const view = mount();
  await screen.findByRole('heading', { name: '感染／休克' });
  const nav = screen.getByRole('navigation', { name: '評估步驟' });
  expect(Array.from(nav.querySelectorAll('button')).map(button => button.textContent)).toEqual(['感染／休克', 'AKI 評估', '灌流／液體', 'KRT', '模式／ECMO', '處方', '選配 HA', '監測／脫離']);
  await user.click(step('AKI 評估'));
  expect(screen.getByLabelText('利尿劑使用')).toHaveValue('');
  await user.type(screen.getByLabelText('尿量'), '0');
  await user.type(screen.getByLabelText('目前 SCr'), '1.2');
  await user.click(screen.getByRole('button', { name: '下一步' }));
  await user.click(screen.getByRole('button', { name: '上一步' }));
  expect(screen.getByLabelText('尿量')).toHaveValue(0);
  view.unmount(); mount();
  await screen.findByRole('heading', { name: 'AKI 評估' });
  expect(screen.getByLabelText('目前 SCr')).toHaveValue(1.2);
  expect(screen.getByLabelText('利尿劑使用')).toHaveValue('');
});

it('shows numeric units/ranges and accessible errors without persisting an invalid draft', async () => {
  const user = userEvent.setup(); mount(); await screen.findByRole('heading', { name: '感染／休克' });
  await user.click(step('AKI 評估'));
  const weight = screen.getByLabelText('目前實際體重');
  expect(weight).toHaveAccessibleDescription(/kg.*500/);
  await user.type(weight, '-1');
  expect(weight).toHaveAttribute('aria-invalid', 'true');
  await user.click(screen.getByRole('button', { name: '檢視並確認' }));
  expect(screen.getByRole('heading', { name: '缺失資料' })).toBeVisible();
  expect(screen.getByRole('button', { name: '確認儲存時間點' })).toBeDisabled();
  expect((await caseRepository.getCase('c1'))?.snapshots).toEqual([]);
});

it('only saves after review confirmation and reopens a validated snapshot without silently setting clinical unknowns', async () => {
  const user = userEvent.setup(); const view = mount(); await screen.findByRole('heading', { name: '感染／休克' });
  expect(screen.getByText('未確認草稿以 sessionStorage 嘗試保留於目前分頁工作階段；尚未儲存至病例。儲存後會嘗試清除，若瀏覽器拒絕則顯示警示。')).toBeVisible();
  await user.type(screen.getByLabelText('距 Sepsis 起始時數'), '6');
  await user.type(screen.getByLabelText('評估時間（UTC）'), '2026-09-21T06:00');
  await user.click(step('AKI 評估')); await user.type(screen.getByLabelText('目前實際體重'), '70');
  await user.click(step('模式／ECMO')); await user.selectOptions(screen.getByLabelText('目前使用 ECMO'), 'false');
  await user.click(screen.getByRole('button', { name: '檢視並確認' }));
  expect(screen.getByText(/目前 SCr：未知/)).toBeVisible();
  expect((await caseRepository.getCase('c1'))?.snapshots).toEqual([]);
  expect(sessionStorage.getItem('sa-aki:assessment-draft:v1:c1')).not.toBeNull();
  await user.click(screen.getByRole('button', { name: '確認儲存時間點' }));
  await screen.findByText('時間點已儲存');
  expect(sessionStorage.getItem('sa-aki:assessment-draft:v1:c1')).toBeNull();
  const snapshots = (await caseRepository.getCase('c1'))!.snapshots;
  expect(snapshots).toHaveLength(1);
  expect(snapshots[0]).toMatchObject({ actualWeightKg: 70, onEcmo: false, hoursFromSepsisOnset: 6 });
  expect(snapshots[0].creatinineMgDl).toBeUndefined(); expect(snapshots[0].diureticExposure).toBeUndefined();
  await user.click(await screen.findByRole('link', { name: '新增時間點' }));
  expect(await screen.findByRole('heading', { name: '感染／休克' })).toBeVisible();
  expect(screen.getByLabelText('距 Sepsis 起始時數')).toHaveValue(null);
  view.unmount(); mount('/' + snapshots[0].id);
  expect(await screen.findByText('已儲存時間點（唯讀）')).toBeVisible();
  expect(screen.queryByRole('button', { name: '確認儲存時間點' })).not.toBeInTheDocument();
});

it('keeps a successful snapshot save and warns when session draft cleanup is denied', async () => {
  const user = userEvent.setup(); mount(); await screen.findByRole('heading', { name: '感染／休克' });
  await user.type(screen.getByLabelText('距 Sepsis 起始時數'), '6');
  await user.type(screen.getByLabelText('評估時間（UTC）'), '2026-09-21T06:00');
  await user.click(step('AKI 評估')); await user.type(screen.getByLabelText('目前實際體重'), '70');
  await user.click(step('模式／ECMO')); await user.selectOptions(screen.getByLabelText('目前使用 ECMO'), 'false');
  await user.click(screen.getByRole('button', { name: '檢視並確認' }));
  await waitFor(() => expect(sessionStorage.getItem('sa-aki:assessment-draft:v1:c1')).not.toBeNull());
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });

  await user.click(screen.getByRole('button', { name: '確認儲存時間點' }));

  expect(await screen.findByText('時間點已儲存')).toBeVisible();
  expect(screen.getByText('時間點已儲存，但瀏覽器無法清除目前分頁的評估草稿；草稿可能仍保留。請關閉分頁／瀏覽工作階段，並依機構政策確認或清除網站資料。')).toBeVisible();
  expect((await caseRepository.getCase('c1'))?.snapshots).toHaveLength(1);
  expect(sessionStorage.getItem('sa-aki:assessment-draft:v1:c1')).not.toBeNull();
});

it('hides HA inputs until explicit opt-in and fails closed when gates are missing or fail', async () => {
  const user = userEvent.setup(); mount(); await screen.findByRole('heading', { name: '感染／休克' });
  await user.click(step('選配 HA'));
  expect(screen.queryByLabelText('已確認成人')).not.toBeInTheDocument();
  await user.click(screen.getByRole('checkbox', { name: '主動啟用 HA 救援評估' }));
  await user.selectOptions(screen.getByLabelText('已確認成人'), 'false');
  expect(screen.getByText(/HA 尚未完成/)).toBeVisible();
  expect(screen.getByRole('button', { name: '完成 HA 多專科審查' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '檢視並確認' }));
  expect(screen.getByRole('button', { name: '確認儲存時間點' })).toBeDisabled();
  await waitFor(async () => expect((await caseRepository.getCase('c1'))?.snapshots).toHaveLength(0));
});

it('keeps HA hidden in final review when not opted in and provides required quantitative safety fields after opt-in', async () => {
  const user = userEvent.setup(); mount(); await screen.findByRole('heading', { name: '感染／休克' });
  await user.click(screen.getByRole('button', { name: '檢視並確認' }));
  expect(screen.queryByText(/IL-6：/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '返回編輯' })); await user.click(step('選配 HA'));
  await user.click(screen.getByRole('checkbox', { name: '主動啟用 HA 救援評估' }));
  expect(screen.getByLabelText('纖維蛋白原')).toHaveAccessibleDescription(/g\/L/);
  expect(screen.getByLabelText('MODS')).toHaveAccessibleDescription(/0–24/);
});

it('limits passing HA gates to multidisciplinary review and revokes completion when data change', async () => {
  const fixture = haInput();
  await caseRepository.saveSnapshot({ ...fixture.previousSnapshot, caseId: 'c1' });
  const values: Record<string, string> = {};
  const flatten = (object: object, prefix = '') => {
    for (const [key, value] of Object.entries(object)) {
      if (['id', 'caseId', 'optedIn', 'dDimerMgLFeu'].includes(key)) continue;
      const path = prefix + key;
      if (typeof value === 'object' && value !== null) flatten(value, path + '.');
      else values[path] = key.endsWith('Timestamp') || key === 'timestamp' ? String(value).slice(0, 16) : String(value);
    }
  };
  flatten(fixture.snapshot);
  sessionStorage.setItem('sa-aki:assessment-draft:v1:c1', JSON.stringify({ values, step: 6, haEnabled: true }));
  const user = userEvent.setup(); mount();
  const confirm = await screen.findByRole('button', { name: '完成 HA 多專科審查' });
  expect(confirm).toBeEnabled();
  expect(screen.getByText('可送多專科審查')).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('待確認多專科審查');
  expect(screen.queryByText(/不符合審查資格/)).not.toBeInTheDocument();
  await user.click(confirm);
  await user.click(screen.getByRole('button', { name: '檢視並確認' }));
  expect(screen.getByRole('button', { name: '確認儲存時間點' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: '返回編輯' }));
  await user.selectOptions(screen.getByLabelText('未控制出血'), 'true');
  expect(screen.getByRole('button', { name: '完成 HA 多專科審查' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '檢視並確認' }));
  expect(screen.getByRole('button', { name: '確認儲存時間點' })).toBeDisabled();
  expect((await caseRepository.getCase('c1'))!.snapshots).toHaveLength(1);
});

it('fails closed in the rendered HA wizard when the latest prior instant has conflicting duplicate observations', async () => {
  const fixture = haInput();
  const firstPrior = { ...fixture.previousSnapshot, caseId: 'c1', id: 'prior-a' };
  const conflictingPrior = { ...fixture.previousSnapshot, caseId: 'c1', id: 'prior-b', lactateMmolL: 9, sofaScore: 20, il6PgMl: 3000 };
  await caseRepository.saveSnapshot(firstPrior);
  await caseRepository.saveSnapshot(conflictingPrior);
  const values: Record<string, string> = {};
  const flatten = (object: object, prefix = '') => {
    for (const [key, value] of Object.entries(object)) {
      if (['id', 'caseId', 'optedIn', 'dDimerMgLFeu'].includes(key)) continue;
      const path = prefix + key;
      if (typeof value === 'object' && value !== null) flatten(value, path + '.');
      else values[path] = key.endsWith('Timestamp') || key === 'timestamp' ? String(value).slice(0, 16) : String(value);
    }
  };
  flatten(fixture.snapshot);
  sessionStorage.setItem('sa-aki:assessment-draft:v1:c1', JSON.stringify({ values, step: 6, haEnabled: true }));

  mount();

  expect(await screen.findByText('HA 尚未完成：必要資料或安全門檻未通過')).toBeVisible();
  expect(screen.getByRole('button', { name: '完成 HA 多專科審查' })).toBeDisabled();
  expect(screen.getByText(/Chronological same-case baseline/)).toBeInTheDocument();
});

it.each(['2026-09-21T06:00:30Z', '2026-09-21T06:00:00.375Z'])(
  'evaluates an imported immutable snapshot at exact precision: %s', async timestamp => {
    const onset = '2026-09-21T00:00:00.125Z';
    const fixture = haInput();
    const snapshot = { ...fixture.snapshot, id: 'precise', caseId: 'precise-case', timestamp, hoursFromSepsisOnset: (Date.parse(timestamp) - Date.parse(onset)) / 3_600_000, firstAntimicrobialTimestamp: timestamp };
    const priorTime = timestamp === '2026-09-21T06:00:30Z' ? '2026-09-21T06:00:15Z' : '2026-09-21T06:00:00.250Z';
    const previous = { ...fixture.previousSnapshot, caseId: 'precise-case', timestamp: priorTime, hoursFromSepsisOnset: (Date.parse(priorTime) - Date.parse(onset)) / 3_600_000 };
    await caseRepository.importCase({ schemaVersion: 1, case: { id: 'precise-case', anonymousCode: 'A-precise', sepsisOnsetTimestamp: onset }, snapshots: [previous, snapshot] });
    const user = userEvent.setup();
    render(<MemoryRouter basename="/SA-AKI" initialEntries={['/SA-AKI/case/precise-case/assessment/precise']}><ApplicationRoutes/></MemoryRouter>);
    await screen.findByText('已儲存時間點（唯讀）');
    expect(screen.getByText(`評估時間（UTC）：${timestamp}`)).toBeVisible();
    expect(screen.queryByText('時間點與病例時間關係不一致，請修正後儲存。')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '返回編輯' }));
    await user.click(step('選配 HA'));
    expect(screen.getByText('可送多專科審查')).toBeVisible();
    expect(screen.queryByText(/Chronological same-case baseline/)).not.toBeInTheDocument();
    expect((await caseRepository.exportCase('precise-case')).snapshots).toEqual([previous, snapshot]);
  },
);

it('does not promote a saved incomplete HA observation to an eligibility claim even if quantitative gates pass', async () => {
  const fixture = haInput();
  await caseRepository.saveSnapshot({ ...fixture.previousSnapshot, caseId: 'c1' });
  await caseRepository.saveSnapshot({ ...fixture.snapshot, id: 'incomplete', caseId: 'c1', hemoadsorptionAssessment: { ...fixture.snapshot.hemoadsorptionAssessment, reviewStatus: 'incomplete' } });
  const user = userEvent.setup(); mount('/incomplete');
  await screen.findByText('已儲存時間點（唯讀）');
  await user.click(screen.getByRole('button', { name: '返回編輯' })); await user.click(step('選配 HA'));
  expect(screen.getByText('已保存未完成 HA 觀察；未記錄審查完成。')).toBeVisible();
  expect(screen.queryByText('可送多專科審查')).not.toBeInTheDocument();
  expect(screen.queryByText('eligible for multidisciplinary review')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '完成 HA 多專科審查' })).toBeDisabled();
});

it('preserves validated HA measurements when the user opts out without creating an HA assessment', async () => {
  const user = userEvent.setup(); mount(); await screen.findByRole('heading', { name: '感染／休克' });
  await user.type(screen.getByLabelText('評估時間（UTC）'), '2026-09-21T04:00');
  await user.type(screen.getByLabelText('距 Sepsis 起始時數'), '4');
  await user.click(step('AKI 評估')); await user.type(screen.getByLabelText('目前實際體重'), '70');
  await user.click(step('模式／ECMO')); await user.selectOptions(screen.getByLabelText('目前使用 ECMO'), 'false');
  await user.click(step('選配 HA')); await user.click(screen.getByRole('checkbox', { name: '主動啟用 HA 救援評估' }));
  await user.type(screen.getByLabelText('IL-6'), '1200');
  await user.click(screen.getByRole('checkbox', { name: '主動啟用 HA 救援評估' }));
  await user.click(screen.getByRole('button', { name: '檢視並確認' }));
  expect(screen.getByText('IL-6：1200 pg/mL')).toBeVisible();
  await user.click(screen.getByRole('button', { name: '確認儲存時間點' }));
  await screen.findByText('時間點已儲存');
  const observation = (await caseRepository.getCase('c1'))!.snapshots[0];
  expect(observation.il6PgMl).toBe(1200);
  expect(observation.hemoadsorptionAssessment).toBeUndefined();
});
