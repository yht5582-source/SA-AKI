import { createAnonymousCase, expect, step, test } from './support/flow';

test('capture concept comparison surfaces at native desktop and both mobile reference sizes', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  await createAnonymousCase(page);
  await page.getByRole('link', { name: '決策首頁', exact: true }).click();
  await expect(page.getByRole('heading', { name: '決策首頁', exact: true })).toBeVisible();
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: testInfo.outputPath('desktop-command-center-1586x992.png'), fullPage: false });
  await page.getByRole('link', { name: '新增時間點', exact: true }).click();
  await step(page, 'AKI 評估');
  for (const { viewport, filename } of [
    { viewport: { width: 390, height: 844 }, filename: 'mobile-assessment-390x844.png' },
    { viewport: { width: 430, height: 764 }, filename: 'mobile-assessment-430x764.png' },
  ]) {
    await page.setViewportSize(viewport);
    await page.getByRole('heading', { name: 'AKI 評估', exact: true }).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(filename), fullPage: false });
  }
  // Screenshots are review evidence, not an automatic assertion of concept fidelity.
});
