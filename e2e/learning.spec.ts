import type { Page } from '@playwright/test';
import { expect, test } from './support/flow';

// These pages run in both the desktop and mobile projects, so compare against the viewport actually in use.
async function expectNoHorizontalOverflow(page: Page) {
  const { client, scroll } = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(scroll).toBe(client);
}

test('demo walkthrough and real dashboard stay usable without document overflow', async ({ page }) => {
  await page.goto('demo');
  await expect(page.getByRole('heading', { name: '示範病例', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('link', { name: /PLR 陽性但肺已滿/ }).click();
  for (const label of ['24 小時', '30 小時', '36 小時']) {
    await page.getByRole('navigation', { name: '病程時間點' }).getByRole('button', { name: label, exact: true }).click();
    await page.getByRole('button', { name: '看工具的判斷', exact: true }).click();
    await expect(page.getByRole('heading', { name: '為什麼', exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  await expect(page.getByText(/模型估算 23.8/)).toBeVisible();
  await page.getByRole('button', { name: '在決策首頁開啟完整結果', exact: true }).click();
  await expect(page.getByText('虛構示範病例，非真實病人。')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.reload();
  await expect(page.getByText('匿名病例 示範-T3', { exact: true })).toBeVisible();
});

test('a full 20-question exam reaches a scored review without document overflow', async ({ page }) => {
  await page.goto('quiz');
  await page.getByText('考試模式', { exact: true }).click();
  await page.getByRole('button', { name: '開始 20 題', exact: true }).click();
  await expect(page.getByText('高階', { exact: true })).toHaveCount(0);
  for (let index = 0; index < 20; index++) {
    await expect(page.getByText(`第 ${index + 1} / 20 題`, { exact: true })).toBeVisible();
    await page.locator('.quiz-option').first().click();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: index === 19 ? '交卷' : '下一題', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: /\d+ \/ 20 分/ })).toBeVisible();
  await expect(page.getByRole('region', { name: '難度得分' })).toContainText('高階');
  await expectNoHorizontalOverflow(page);
});
