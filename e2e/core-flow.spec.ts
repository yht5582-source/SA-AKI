import { readFile } from 'node:fs/promises';
import { createAnonymousCase, expect, fillObservation, importDemo, saveObservation, step, test } from './support/flow';

test('anonymous creation, two timepoints, KDIGO/SA-AKI, fluid/KRT and identifier-free export/handoff', async ({ page }) => {
  const created = await createAnonymousCase(page);
  await fillObservation(page, 6);
  await step(page, '選配 HA');
  await expect(page.getByRole('checkbox', { name: '主動啟用 HA 救援評估' })).not.toBeChecked();
  await saveObservation(page);
  await page.getByRole('link', { name: '決策首頁', exact: true }).click();
  await expect(page.getByRole('article', { name: /KDIGO.*stage 2/ })).toBeVisible();
  await page.getByRole('link', { name: '新增時間點', exact: true }).click();
  await fillObservation(page, 12);
  await saveObservation(page);
  await page.getByRole('link', { name: '決策首頁', exact: true }).click();

  const times = page.getByLabel('評估時間點', { exact: true });
  await expect(times.getByRole('option')).toHaveCount(2);
  await expect(page.getByRole('article', { name: /KDIGO.*stage 3/ })).toBeVisible();
  await expect(page.getByRole('article', { name: /SA-AKI.*early/ })).toBeVisible();
  const fluid = page.getByRole('article', { name: /^不可直接追加輸液/ });
  await expect(fluid).toContainText('缺失資料');
  await expect(fluid).toContainText('停止');
  const krt = page.getByRole('article', { name: /^urgent KRT evaluation/ });
  await expect(krt).toContainText('有相符高血鉀且已確認對適當治療難治');
  await expect(page.getByRole('article', { name: /HA.*門檻|血液淨化非常規/ })).toHaveCount(0);

  await page.getByRole('link', { name: '床邊摘要', exact: true }).click();
  const handoff = await page.getByLabel('交班摘要', { exact: true }).inputValue();
  expect(handoff).toContain('stage 3');
  expect(handoff).toContain('early');
  expect(handoff).toContain('非自動醫囑');
  expect(handoff).not.toContain(created.code);
  expect(handoff).not.toMatch(/patientName|medicalRecordNumber|dateOfBirth|姓名|病歷號|電話|地址/);
  await page.getByRole('button', { name: '複製交班摘要', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(/已複製交班摘要|請選取下方摘要手動複製/);

  await page.goto('./');
  await page.getByRole('button', { name: `匯出 ${created.code}`, exact: true }).click();
  const json = await page.getByLabel('匯出 JSON', { exact: true }).inputValue();
  const exported = JSON.parse(json);
  expect(exported.schemaVersion).toBe(1);
  expect(exported.snapshots).toHaveLength(2);
  expect(exported.snapshots.map((snapshot: { creatinineMgDl: number }) => snapshot.creatinineMgDl)).toEqual([2, 3]);
  expect(exported.snapshots.every((snapshot: { hemoadsorptionAssessment?: unknown }) => snapshot.hemoadsorptionAssessment === undefined)).toBe(true);
  expect(json).not.toMatch(/patientName|medicalRecordNumber|dateOfBirth|fullName|address|phone/);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: '下載 JSON', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('anonymous-case-v1.json');
  const path = await download.path();
  expect(path).not.toBeNull();
  expect(JSON.parse(await readFile(path!, 'utf8'))).toEqual(exported);
});

test('HA requires explicit opt-in and refuses completion when the four safety gates are incomplete', async ({ page }) => {
  const { code } = await createAnonymousCase(page);
  await fillObservation(page);
  await step(page, '選配 HA');
  const optIn = page.getByRole('checkbox', { name: '主動啟用 HA 救援評估' });
  await expect(optIn).not.toBeChecked();
  await expect(page.getByRole('button', { name: '完成 HA 多專科審查' })).toHaveCount(0);
  await optIn.check();
  await expect(page.getByRole('button', { name: '完成 HA 多專科審查' })).toBeDisabled();
  await expect(page.getByText('HA 尚未完成：必要資料或安全門檻未通過', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '檢視並確認', exact: true }).click();
  await expect(page.getByRole('button', { name: '確認儲存時間點' })).toBeDisabled();
  await page.getByRole('checkbox', { name: '僅儲存未完成 HA 觀察（不代表符合資格）' }).check();
  await page.getByRole('button', { name: '確認儲存時間點' }).click();
  await expect(page.getByRole('status').filter({ hasText: '時間點已儲存' })).toBeVisible();
  await page.getByRole('link', { name: '決策首頁', exact: true }).click();
  await page.getByRole('link', { name: 'HA 救援評估', exact: true }).click();
  for (const name of ['臨床門檻', '目標門檻', '安全門檻', '治理門檻']) {
    await expect(page.getByRole('region', { name, exact: true })).toContainText('未通過');
  }
  await page.goto('./');
  await page.getByRole('button', { name: `匯出 ${code}`, exact: true }).click();
  const exported = JSON.parse(await page.getByLabel('匯出 JSON').inputValue());
  expect(exported.snapshots[0].hemoadsorptionAssessment).toMatchObject({ optedIn: true, reviewStatus: 'incomplete' });
});

test('DEMO-001 is created through validated import, while direct identifier fields are rejected', async ({ page }) => {
  await page.goto('./');
  await importDemo(page);
  await page.getByRole('button', { name: '匯出 DEMO-001', exact: true }).click();
  const exported = JSON.parse(await page.getByLabel('匯出 JSON').inputValue());
  expect(exported.case).toEqual({ id: 'demo-001', anonymousCode: 'DEMO-001' });
  await page.getByLabel('匯入 JSON').fill(JSON.stringify({ ...exported, case: { ...exported.case, id: 'rejected', patientName: 'TEST-ONLY-NOT-A-PERSON' } }));
  await page.getByRole('button', { name: '驗證並匯入', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('匯入失敗');
  await expect(page.getByRole('link', { name: '開啟 DEMO-001', exact: true })).toHaveCount(1);
});

test('keyboard skip-link activation focuses the main landmark', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: '跳至主要內容', exact: true });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  const outline = await skip.evaluate(element => getComputedStyle(element).outlineWidth);
  expect(parseFloat(outline)).toBeGreaterThanOrEqual(2);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});
