import { createAnonymousCase, expect, expectNoHorizontalOverflow, fillObservation, saveObservation, step, test } from './support/flow';

test('390×844 eight-step wizard saves a real timepoint without document overflow', async ({ page }, testInfo) => {
  const created = await createAnonymousCase(page);
  await expectNoHorizontalOverflow(page);
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
