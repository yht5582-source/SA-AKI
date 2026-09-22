import { createAnonymousCase, expect, expectNoHorizontalOverflow, fillObservation, saveObservation, step, test } from './support/flow';

test('390×844 eight-step wizard saves a real timepoint without document overflow', async ({ page }, testInfo) => {
  const created = await createAnonymousCase(page);
  await expectNoHorizontalOverflow(page);
  await page.getByLabel('距 Sepsis 起始時數', { exact: true }).fill('6');
  await page.getByRole('button', { name: '上一步：病例資料', exact: true }).click();
  await expect(page.getByRole('form', { name: '編輯匿名病例', exact: true })).toBeVisible();
  await page.getByLabel('基準 SCr', { exact: true }).fill('0.9');
  await page.getByRole('button', { name: '確認更新病例', exact: true }).click();
  await expect(page.getByRole('heading', { name: '感染／休克', exact: true })).toBeVisible();
  await expect(page.getByLabel('距 Sepsis 起始時數', { exact: true })).toHaveValue('6');
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: '前往填寫目前 SCr', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'AKI 評估', exact: true })).toBeVisible();
  await expect(page.getByLabel('目前 SCr', { exact: true })).toBeFocused();
  await fillObservation(page);
  for (const [index, label] of ['感染／休克', 'AKI 評估', '灌流／液體', 'KRT', '模式／ECMO', '處方', '選配 HA', '監測／脫離'].entries()) {
    await step(page, label);
    await expect(page.getByRole('progressbar', { name: '評估進度' })).toHaveAttribute('aria-valuenow', String(index + 1));
    await expectNoHorizontalOverflow(page);
  }
  await step(page, 'AKI 評估');
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: testInfo.outputPath('mobile-assessment-390x844.png'), fullPage: false });
  await saveObservation(page);
  await expectNoHorizontalOverflow(page);
  await page.getByRole('link', { name: '決策首頁', exact: true }).click();
  await expect(page.getByRole('article', { name: /KDIGO.*stage 2/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.reload();
  await expect(page.getByText(`匿名病例 ${created.code}`, { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
