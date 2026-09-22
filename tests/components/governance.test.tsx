import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApplicationRoutes } from '../../src/app/routes';
import { evidenceSources } from '../../src/clinical/sources';

const mount = (path: string) => render(
  <MemoryRouter basename="/SA-AKI" initialEntries={[`/SA-AKI${path}`]}>
    <ApplicationRoutes />
  </MemoryRouter>,
);

const statusLabels = {
  guideline: '指南',
  draft: '公開審查草案',
  consensus: '共識',
  trial: '試驗',
  position: '立場聲明',
  observational: '觀察性研究',
  local: '本機操作規範',
  unverified: '未驗證',
} as const;

it('renders every evidence source with provenance, scope, and execution eligibility', () => {
  mount('/evidence');

  // Catches a source silently disappearing from both the registry and its rendered loop.
  const expectedSourceIds = [
    'ADQI_28', 'ADQI_30', 'APP_CRRT_PRESCRIPTION_V1', 'APP_FLUID_SAFETY_V1',
    'APP_HA_REVIEW_V1', 'APP_KRT_SAFETY_V1', 'APP_LIBERATION_V1', 'APP_SA_AKI_TIMING_V1',
    'APP_TRAJECTORY_V1', 'CRRTNET_WEIGHT_2026', 'ELSO_FLUID_AKI_2022', 'EUPHRATES_POSTHOC_2018',
    'IMMUNOSEP_2026', 'KDIGO_2012', 'KDIGO_2026_DRAFT', 'MAKE_DEFINITIONS_2024',
    'MOLNAR_2026', 'NSI_CRRT_2016', 'PHIND_2026', 'SEPSIS_3_2016', 'SSC_2026', 'STARRT_AKI_2020', 'TIGRIS_2026',
  ];
  expect(Object.keys(evidenceSources).sort()).toEqual(expectedSourceIds);
  expect(screen.getAllByRole('article')).toHaveLength(23);

  for (const source of Object.values(evidenceSources)) {
    const article = screen.getByRole('article', { name: source.title });
    expect(within(article).getByRole('heading', { name: source.title, level: 3 })).toBeVisible();
    expect(within(article).getByText(statusLabels[source.status])).toBeVisible();
    expect(within(article).getByText(source.year === undefined ? '年份：未確認' : `年份：${source.year}`)).toBeVisible();
    expect(within(article).getByText(source.verification === 'verified' ? '查核狀態：已查核' : '查核狀態：未驗證')).toBeVisible();

    if (source.url) {
      expect(within(article).getByRole('link', { name: '開啟主要來源' })).toHaveAttribute('href', source.url);
    } else {
      expect(within(article).getByText('主要來源：本機操作規範，無外部連結')).toBeVisible();
    }
    if (source.doi) expect(within(article).getByText(`DOI：${source.doi}`)).toBeVisible();

    for (const claim of source.supportedClaims) {
      expect(within(article).getByText(claim.scope)).toBeVisible();
    }

    const executable = source.verification === 'verified'
      && source.status !== 'draft'
      && source.supportedClaims.length > 0;
    expect(within(article).getByText(executable ? '執行資格：僅限列出的規則與範圍' : '執行資格：不可執行')).toBeVisible();
    expect(within(article).getByText('不確定性：僅限列明範圍；不可外推為未列出的診斷、閾值或治療效益。')).toBeVisible();
    if (source.supportedClaims.length === 0) {
      expect(within(article).getByText('範圍：背景脈絡；沒有可執行的支援主張')).toBeVisible();
    }
  }
});

it('makes draft, unverified, and hemoadsorption uncertainty visible without disclosure controls', () => {
  mount('/evidence');
  expect(screen.getByText('公開審查草案（Public Review Draft）：非最終指引，不可執行。')).toBeVisible();
  expect(screen.getByText('TIGRIS 未驗證：不可執行，且不得用來啟用門檻或療效主張。')).toBeVisible();
  expect(screen.getByText('SSC 2026 為條件式反對成人敗血症／敗血性休克常規使用血液淨化及 polymyxin B hemoperfusion（PMX）；HA 僅限受限制的實驗性輔助措施，以及研究、登錄或核准協議脈絡。')).toBeVisible();
  expect(screen.getByText('以上狀態不是只靠顏色表達；草案、未驗證及不可執行均有文字標示。')).toBeVisible();
  expect(screen.getByText(/SSC 2026 為條件式反對/).closest('details')).toBeNull();
});

it('states the complete local privacy and JSON threat model without claiming app encryption', () => {
  mount('/privacy');
  for (const statement of [
    '已確認儲存的匿名病例與時間點存放於此瀏覽器設定檔的 IndexedDB。',
    '尚未確認的評估草稿值存放於目前分頁／瀏覽工作階段的 sessionStorage，尚未寫入病例或時間點。',
    'sessionStorage 草稿通常可在同一分頁重新載入後恢復；關閉分頁或瀏覽工作階段、清除網站資料或瀏覽器自動清理可能使草稿消失。是否在工作階段還原後保留由瀏覽器決定。',
    '時間點成功儲存後，應用程式會嘗試清除該病例在目前分頁的評估草稿。',
    '病例刪除成功後會從 IndexedDB 永久刪除該病例與時間點，並嘗試清除該病例在目前分頁的草稿；「清除全部本機資料」成功後會從 IndexedDB 清除所有病例與時間點，並嘗試清除目前分頁的所有 SA-AKI 評估草稿。',
    '上述 sessionStorage 清除僅為盡力而為；瀏覽器或儲存體拒絕／錯誤可能使草稿仍留在目前分頁。使用共用裝置時，完成後請關閉分頁／瀏覽工作階段，並依機構政策確認或清除網站資料。',
    '離開評估頁、返回病例清單、取消刪除或取消清除全部，都不會清除評估草稿；目前沒有獨立的「捨棄草稿」按鈕。',
    '其他已開啟分頁有各自的 sessionStorage；本分頁的刪除或清除動作不能清除其他分頁的草稿。',
    '本應用程式沒有後端、帳號、分析或遙測服務。',
    '只可使用匿名病例代碼；禁止輸入姓名、病歷號、電話、地址或其他可直接識別個人的資料。',
    'JSON 匯出檔可能包含敏感健康資料；使用者須自行負責安全儲存、傳送、匯入及刪除。',
    '能存取此裝置、瀏覽器設定檔或仍開啟之分頁工作階段的人，可能讀取已儲存病例、未確認草稿與匯出檔。',
    '刪除應用程式內病例不會刪除已下載、複製、備份或分享的 JSON 檔。',
    '清除瀏覽器網站資料、使用私人瀏覽或瀏覽器自動清理，可能永久移除本機資料。',
    '本應用程式不宣稱提供應用層加密；請使用受管理、已加密且有存取控制的裝置。',
  ]) expect(screen.getByText(statement)).toBeVisible();
});

it('states clinician population, exclusions, emergency boundary, local conventions, and discrepancy reporting', () => {
  mount('/about');
  expect(screen.getByRole('heading', { name: '關於與治理', level: 2 })).toBeVisible();
  expect(screen.getByText('僅供成人醫護人員使用；不適用於兒科、孕婦及新生兒。')).toBeVisible();
  expect(screen.getByText('本應用程式不是緊急服務、不是自動醫囑，也不能取代臨床判斷。')).toBeVisible();
  expect(screen.getByText('臨床內容版本：0.1.0；證據查核日期：2026-09-21。')).toBeVisible();
  expect(screen.getByText('所有本機操作閾值與時間上限都必須視為保守的工作流程慣例，不是經驗證的治療閾值。')).toBeVisible();
  expect(screen.getByRole('heading', { name: '已知排除與限制', level: 3 })).toBeVisible();
  expect(screen.getByRole('heading', { name: '回報差異', level: 3 })).toBeVisible();
  expect(screen.getByRole('link', { name: '在 GitHub 回報證據或安全差異' })).toHaveAttribute('href', 'https://github.com/yht5582-source/SA-AKI/issues');
});

it('publishes unreleased and 0.1.0 evidence and safety changes', () => {
  mount('/changelog');
  expect(screen.getByRole('heading', { name: '未發布', level: 3 })).toBeVisible();
  expect(screen.getByRole('heading', { name: '0.1.0 — 2026-09-21', level: 3 })).toBeVisible();
  expect(screen.getByText(/KDIGO 2012、KDIGO 2026 Public Review Draft、SSC 2026/)).toBeVisible();
  expect(screen.getByText(/新增草案與未驗證來源的不可執行防線/)).toBeVisible();
  expect(screen.getByText(/新增成人限定、兒科／孕婦／新生兒排除與非緊急服務警示/)).toBeVisible();
  expect(screen.getByText(/更正儲存揭露：區分 IndexedDB 已確認病例／時間點與目前分頁 sessionStorage 未確認評估草稿.*清除為盡力而為/)).toBeVisible();
});

it('truthfully separates offline capabilities from network-only links', () => {
  mount('/offline');
  expect(screen.getByRole('heading', { name: '離線使用', level: 2 })).toBeVisible();
  expect(screen.getByText('完成首次載入及安裝後，已快取的應用程式介面、治理頁面與此裝置 IndexedDB 中的既有病例可離線開啟。')).toBeVisible();
  expect(screen.getByText('離線時仍可在本機建立或編輯匿名病例及匯出 JSON；變更不會同步到任何伺服器。')).toBeVisible();
  expect(screen.getByText('首次載入、應用程式更新及外部證據／DOI 連結需要網際網路。')).toBeVisible();
  expect(screen.getByText('離線快取不是備份；瀏覽器可能清除網站資料，私人瀏覽也可能不保留資料。')).toBeVisible();
});

it.each([
  ['/evidence', '證據與版本'],
  ['/privacy', '隱私與資料'],
  ['/about', '關於與治理'],
  ['/changelog', '版本紀錄'],
  ['/offline', '離線使用'],
] as const)('supports direct navigation to %s with semantic landmarks', (path, heading) => {
  mount(path);
  expect(screen.getByRole('navigation', { name: '主要導覽' })).toBeVisible();
  expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  expect(screen.getByRole('heading', { name: 'SA-AKI Clinical Navigator', level: 1 })).toBeVisible();
  expect(screen.getByRole('heading', { name: heading, level: 2 })).toBeVisible();
});

it('provides governance navigation and a keyboard-focusable skip link', async () => {
  const user = userEvent.setup();
  mount('/evidence');
  const nav = screen.getByRole('navigation', { name: '主要導覽' });
  expect(within(nav).getByRole('link', { name: '證據與版本' })).toHaveAttribute('href', '/SA-AKI/evidence');
  expect(within(nav).getByRole('link', { name: '隱私與資料' })).toHaveAttribute('href', '/SA-AKI/privacy');
  expect(within(nav).getByRole('link', { name: '關於與治理' })).toHaveAttribute('href', '/SA-AKI/about');
  expect(within(nav).getByRole('link', { name: '版本紀錄' })).toHaveAttribute('href', '/SA-AKI/changelog');
  expect(within(nav).getByRole('link', { name: '離線使用' })).toHaveAttribute('href', '/SA-AKI/offline');

  await user.tab();
  expect(screen.getByRole('link', { name: '跳至主要內容' })).toHaveFocus();
  expect(screen.getByRole('link', { name: '跳至主要內容' })).toHaveAttribute('href', '#main-content');
  const target = screen.getByRole('main');
  expect(target).toHaveAttribute('tabindex', '-1');
  target.focus();
  expect(target).toHaveFocus();
  // Native fragment activation is exercised in Chromium; jsdom does not implement it.
});
