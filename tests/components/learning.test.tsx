import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApplicationRoutes } from '../../src/app/routes';
import { caseRepository } from '../../src/data/caseRepository';
import { questions } from '../../src/features/quiz/questions';

const mount = (path: string) => render(<MemoryRouter basename="/SA-AKI" initialEntries={[`/SA-AKI${path}`]}><ApplicationRoutes/></MemoryRouter>);
beforeEach(async () => { await caseRepository.clearAll(); sessionStorage.clear(); });

const optionFor = (index: number) => {
  const question = questions[index];
  const group = screen.getByRole('group', { name: question.stem });
  return (text: string) => within(group).getByRole('radio', { name: new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
};

it('the home page offers demo and quiz entries and keeps data tools collapsed but reachable', async () => {
  mount('/');
  expect(await screen.findByRole('link', { name: /示範病例.*6 個虛構/ })).toHaveAttribute('href', '/SA-AKI/demo');
  expect(screen.getByRole('link', { name: /測驗 20 題.*10 題基礎/ })).toHaveAttribute('href', '/SA-AKI/quiz');
  expect(screen.getByText('匯入、匯出與清除資料').closest('details')).not.toHaveAttribute('open');
});

it('lists six demo cases and hides the engine result until the learner asks', async () => {
  const user = userEvent.setup(); mount('/demo');
  expect(screen.getAllByRole('listitem')).toHaveLength(6);
  await user.click(screen.getByRole('link', { name: /KDIGO 第 3 期/ }));
  expect(screen.queryByText('工具的判斷')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '看工具的判斷' }));
  expect(screen.getByText('工具的判斷')).toBeVisible();
  expect(screen.getByText(/可考慮小量監測 fluid challenge/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: '下一個時間點：30 小時' }));
  expect(screen.queryByText('工具的判斷')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '看工具的判斷' }));
  expect(screen.getByText(/目前不建議開始透析/)).toBeVisible();
});

it('opens a demo in the real dashboard, labels it fictional and restores edited data', async () => {
  const user = userEvent.setup(); mount('/demo/demo-t2');
  await user.click(screen.getByRole('button', { name: '在決策首頁開啟完整結果' }));
  expect(await screen.findByRole('heading', { name: '決策首頁' })).toBeVisible();
  expect(screen.getByText('虛構示範病例，非真實病人。')).toBeVisible();
  const stored = await caseRepository.getCase('demo-t2');
  expect(stored?.snapshots).toHaveLength(2);
  expect(screen.getByRole('region', { name: '是否進行透析' })).toHaveTextContent('建議立即評估啟動透析');
  await user.click(screen.getByRole('button', { name: /只看需處理/ }));
  for (const card of screen.getAllByRole('article')) expect(['critical', 'warning']).toContain(card.getAttribute('data-severity'));
  await user.click(screen.getByRole('link', { name: '回到教學說明' }));
  await caseRepository.deleteCase('demo-t2');
  await caseRepository.importCase({ schemaVersion: 1, case: { ...stored!.case }, snapshots: stored!.snapshots.slice(0, 1) });
  await user.click(await screen.findByRole('button', { name: '還原示範資料' }));
  expect(await screen.findByText('已還原為原始示範資料。')).toBeVisible();
  expect((await caseRepository.getCase('demo-t2'))?.snapshots).toHaveLength(2);
});

it('reports an unknown demo instead of crashing', () => {
  mount('/demo/nope');
  expect(screen.getByRole('alert')).toHaveTextContent('找不到示範病例');
});

it('practice mode requires confirmation, locks the answer and explains every option', async () => {
  const user = userEvent.setup(); mount('/quiz');
  expect(screen.getByText(/10 題基礎，10 題高階/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: '開始 20 題' }));
  expect(screen.getByRole('button', { name: '確認答案' })).toBeDisabled();
  const question = questions[0];
  await user.click(optionFor(0)(question.options[question.answer].text));
  await user.click(screen.getByRole('button', { name: '確認答案' }));
  expect(screen.getByRole('status')).toHaveTextContent('答對了');
  for (const option of question.options) expect(screen.getByText(option.why, { exact: false })).toBeVisible();
  expect(screen.getByRole('group', { name: question.stem })).toBeDisabled();
});

it('exam mode hides feedback, warns about blanks, then scores by level', async () => {
  const user = userEvent.setup(); mount('/quiz');
  await user.click(screen.getByRole('radio', { name: /考試模式/ }));
  await user.click(screen.getByRole('button', { name: '開始 20 題' }));
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    if (index < 10) await user.click(optionFor(index)(question.options[question.answer].text));
    expect(screen.queryByText(question.explanation)).not.toBeInTheDocument();
    if (index < questions.length - 1) await user.click(screen.getByRole('button', { name: '下一題' }));
  }
  await user.click(screen.getByRole('button', { name: '交卷' }));
  expect(screen.getByRole('alert')).toHaveTextContent('還有 10 題未作答');
  await user.click(screen.getByRole('button', { name: '交卷' }));
  expect(screen.getByRole('heading', { name: '10 / 20 分' })).toBeVisible();
  expect(screen.getByText(/未通過：需答對 16 題/)).toBeVisible();
  const levels = screen.getByRole('region', { name: '難度得分' });
  expect(within(levels).getByText('基礎').closest('div')).toHaveTextContent('10 / 10');
  expect(within(levels).getByText('高階').closest('div')).toHaveTextContent('0 / 10');
  await user.click(screen.getByRole('button', { name: '只看錯題' }));
  expect(screen.queryByText(questions[0].stem)).not.toBeInTheDocument();
  expect(screen.getByText(questions[10].stem)).toBeVisible();
});

it('can run the advanced set alone and resumes after a remount', async () => {
  const user = userEvent.setup(); const view = mount('/quiz');
  await user.click(screen.getByRole('radio', { name: /高階 10 題/ }));
  await user.click(screen.getByRole('button', { name: '開始 10 題' }));
  expect(screen.getByText('第 1 / 10 題')).toBeVisible();
  expect(screen.getByRole('group', { name: questions[10].stem })).toBeVisible();
  view.unmount(); mount('/quiz');
  expect(screen.getByText('第 1 / 10 題')).toBeVisible();
});

it('shuffles option order between attempts without changing the correct answer', async () => {
  const user = userEvent.setup(); mount('/quiz');
  const orders = new Set<string>();
  for (let attempt = 0; attempt < 12; attempt++) {
    await user.click(screen.getByRole('button', { name: '開始 20 題' }));
    orders.add(within(screen.getByRole('group', { name: questions[0].stem })).getAllByRole('radio').map(radio => radio.closest('label')!.textContent).join('|'));
    await user.click(screen.getByRole('button', { name: '放棄並重來' }));
  }
  expect(orders.size).toBeGreaterThan(1);
});
