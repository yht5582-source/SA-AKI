import { createAnonymousCase, expect, fillObservation, importDemo, saveObservation, step, test, waitForOfflineReady } from './support/flow';
import { startPagesServer } from './support/pages-server';

test('first install precaches root, existing case and unvisited evidence routes for offline reloads', async ({ page, context }) => {
  const created = await createAnonymousCase(page);
  await fillObservation(page);
  await saveObservation(page);
  await page.getByRole('link', { name: '決策首頁', exact: true }).click();
  const caseURL = page.url();
  await waitForOfflineReady(page);
  const serviceWorker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return { scope: new URL(registration.scope).pathname, script: new URL(registration.active!.scriptURL).pathname };
  });
  expect(serviceWorker).toEqual({ scope: '/SA-AKI/', script: '/SA-AKI/sw.js' });
  await page.goto('./');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('link', { name: `開啟 ${created.code}`, exact: true })).toBeVisible();
  await page.goto(caseURL);
  await page.reload();
  await expect(page.getByRole('article', { name: /KDIGO.*stage 2/ })).toBeVisible();
  // Deliberately not visited online: this needs the precached app-shell fallback.
  await page.goto('./evidence');
  await page.reload();
  await expect(page.getByRole('heading', { name: '證據與版本', exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(23);
  await expect(page.getByText('TIGRIS 未驗證：不可執行，且不得用來啟用門檻或療效主張。', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '開啟主要來源', exact: true }).first()).toHaveAttribute('href', /^https:\/\//);
});

test('fresh GitHub Pages-style 404 deep links load the app without prior service worker installation', async ({ browser }) => {
  const server = await startPagesServer();
  const fresh = await browser.newContext({ serviceWorkers: 'block' });
  const page = await fresh.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    for (const [route, heading] of [['evidence', '證據與版本'], ['privacy', '隱私與資料'], ['offline', '離線使用']]) {
      const response = await page.goto(server.url + route);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await expect(page).toHaveURL(server.url + route);
    }
    await page.goto(server.url + 'case/missing');
    await expect(page.getByRole('alert')).toContainText('找不到病例');
    await page.goto(server.url + 'not-a-route');
    await expect(page.getByRole('alert')).toContainText('找不到頁面');
    expect(errors).toEqual([]);
  } finally { await fresh.close(); await server.close(); }
});

test('a byte-changed service worker activates automatically without losing confirmed cases or the current draft', async ({ page }) => {
  const server = await startPagesServer();
  try {
    await page.goto(server.url);
    await importDemo(page);
    await waitForOfflineReady(page);
    const workerVersion = () => page.evaluate(() => new Promise<number>((resolveVersion, reject) => {
      const channel = new MessageChannel();
      const timeout = setTimeout(() => reject(new Error('Worker version probe timed out')), 5000);
      channel.port1.onmessage = event => { clearTimeout(timeout); resolveVersion(event.data); channel.port1.close(); };
      navigator.serviceWorker.controller!.postMessage('e2e-version', [channel.port2]);
    }));
    expect(await workerVersion()).toBe(1);
    await page.getByRole('link', { name: '開啟 DEMO-001', exact: true }).click();
    await step(page, 'AKI 評估');
    await page.getByLabel('目前 SCr', { exact: true }).fill('2.2');
    server.update();
    // The production auto-update registration reloads after activation; no test skipWaiting message.
    const reload = page.waitForEvent('domcontentloaded');
    await page.evaluate(() => { void navigator.serviceWorker.getRegistration().then(registration => registration!.update()); });
    await reload;
    await waitForOfflineReady(page);
    await expect.poll(workerVersion).toBe(2);
    await expect(page.getByLabel('目前 SCr', { exact: true })).toHaveValue('2.2');
    await page.goto(server.url);
    await expect(page.getByRole('link', { name: '開啟 DEMO-001', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '匯出 DEMO-001', exact: true }).click();
    expect(JSON.parse(await page.getByLabel('匯出 JSON').inputValue()).snapshots).toHaveLength(1);
  } finally { await page.goto('about:blank'); await server.close(); }
});
