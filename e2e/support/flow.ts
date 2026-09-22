import { expect, test as base, type Page } from '@playwright/test';

type ConsoleDiagnosticMessage = {
  type(): string;
  text(): string;
  location(): { url: string; lineNumber: number; columnNumber: number };
};

export function formatConsoleDiagnostic(message: ConsoleDiagnosticMessage) {
  const { url, lineNumber, columnNumber } = message.location();
  return `[console.${message.type()}] ${message.text()} (${url}:${lineNumber}:${columnNumber})`;
}

export const test = base.extend<{ consoleHealth: void }>({
  consoleHealth: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' || message.type() === 'warning') errors.push(formatConsoleDiagnostic(message));
    });
    await use();
    expect(errors, 'no uncaught application or console errors').toEqual([]);
  }, { auto: true }],
});
export { expect };

export async function createAnonymousCase(page: Page) {
  await page.goto('./');
  await expect(page).toHaveTitle(/SA-AKI Clinical Navigator/);
  await page.getByRole('button', { name: '新增匿名病例', exact: true }).click();
  await expect(page.getByLabel(/姓名|病歷號|出生日期|電話|地址/)).toHaveCount(0);
  await page.getByLabel('成人年齡區間', { exact: true }).selectOption('40-64');
  await page.getByLabel('基準 SCr', { exact: true }).fill('1');
  await page.getByLabel('基準 SCr 來源', { exact: true }).selectOption('measured-outpatient');
  await page.getByLabel('基準 SCr 可信度', { exact: true }).selectOption('high');
  await page.getByLabel('基準 SCr 時間（UTC）', { exact: true }).fill('2026-09-21T00:00');
  await page.getByLabel('Sepsis 起始時間（UTC）', { exact: true }).fill('2026-09-21T00:00');
  await page.getByLabel('休克起始時間（UTC）', { exact: true }).fill('2026-09-21T00:00');
  await page.getByRole('button', { name: '建立病例', exact: true }).click();
  await expect(page.getByRole('heading', { name: '感染／休克', exact: true })).toBeVisible();
  const title = await page.getByRole('heading', { name: /^匿名病例 A-/ }).innerText();
  return { code: title.replace('匿名病例 ', ''), assessmentURL: page.url() };
}

export async function step(page: Page, name: string) {
  await page.getByRole('navigation', { name: '評估步驟' }).getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeFocused();
}

export async function fillObservation(page: Page, hour: 6 | 12 = 6) {
  await step(page, '感染／休克');
  await page.getByLabel('評估時間（UTC）', { exact: true }).fill(`2026-09-21T${String(hour).padStart(2, '0')}:00`);
  await page.getByLabel('距 Sepsis 起始時數', { exact: true }).fill(String(hour));
  await page.getByLabel('感染源控制', { exact: true }).selectOption('achieved');
  await page.getByLabel('首次抗菌藥時間（UTC）', { exact: true }).fill('2026-09-21T00:00');
  await page.getByLabel('SOFA', { exact: true }).fill('10');
  await page.getByLabel('NE 等效劑量', { exact: true }).fill(hour === 6 ? '0.3' : '0.4');
  await page.getByLabel('升壓劑趨勢', { exact: true }).selectOption('worsening');
  await page.getByLabel('乳酸', { exact: true }).fill(hour === 6 ? '4' : '5');
  await step(page, 'AKI 評估');
  await page.getByLabel('目前 SCr', { exact: true }).fill(hour === 6 ? '2' : '3');
  await page.getByLabel('尿量', { exact: true }).fill('100');
  await page.getByLabel('觀察時數', { exact: true }).fill(String(hour));
  await page.getByLabel('目前實際體重', { exact: true }).fill('70');
  await page.getByLabel('尿量標準化體重', { exact: true }).fill('70');
  await page.getByLabel('尿量體重基準', { exact: true }).selectOption('actual');
  await page.getByLabel('利尿劑使用', { exact: true }).selectOption('false');
  await step(page, '灌流／液體');
  await page.getByLabel('MAP', { exact: true }).fill('60');
  await page.getByLabel('微血管回填時間', { exact: true }).fill('4');
  await page.getByLabel('被動抬腿反應', { exact: true }).selectOption('responsive');
  await page.getByLabel('VTI 變化', { exact: true }).fill('15');
  await step(page, 'KRT');
  await page.getByLabel('鉀', { exact: true }).fill('6.8');
  await page.getByLabel('動脈 pH', { exact: true }).fill('7.15');
  await page.getByLabel('難治性高血鉀', { exact: true }).selectOption('true');
  await step(page, '模式／ECMO');
  await page.getByLabel('目前使用 ECMO', { exact: true }).selectOption('false');
}

export async function saveObservation(page: Page) {
  await page.getByRole('button', { name: '檢視並確認', exact: true }).click();
  await expect(page.getByRole('button', { name: '確認儲存時間點', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '確認儲存時間點', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '時間點已儲存' })).toBeVisible();
  await expect(page.getByText('已儲存時間點（唯讀）', { exact: true })).toBeVisible();
}

export async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth })))
    .toEqual({ width: 390, scroll: 390 });
}

export async function waitForOfflineReady(page: Page) {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state)).toBe('activated');
}

export const demoCase = {
  schemaVersion: 1,
  case: { id: 'demo-001', anonymousCode: 'DEMO-001' },
  snapshots: [{ id: 'demo-s1', caseId: 'demo-001', timestamp: '2026-09-21T06:00:00Z', hoursFromSepsisOnset: 6, actualWeightKg: 70, onEcmo: false }],
};

export async function importDemo(page: Page) {
  await page.getByLabel('匯入 JSON', { exact: true }).fill(JSON.stringify(demoCase));
  await page.getByRole('button', { name: '驗證並匯入', exact: true }).click();
  await expect(page.getByRole('link', { name: '開啟 DEMO-001', exact: true })).toBeVisible();
}
