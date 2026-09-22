import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

afterEach(() => vi.unstubAllGlobals());

// These viewport fixtures verify the shared rendered safety boundary. Actual
// CSS reflow/contrast remains part of the deferred Task 13 browser gate.
describe.each([
  ['desktop', 1586],
  ['mobile', 430],
] as const)('%s safety boundary', (_surface, width) => {
  beforeEach(() => vi.stubGlobal('innerWidth', width));

  it('explicitly excludes pediatric, neonatal, and pregnant-patient use', () => {
    render(<App />);
    expect(screen.getByText('不適用於兒科、孕婦及新生兒')).toBeVisible();
  });

  it('explicitly retains bedside clinical judgment rather than replacing it', () => {
    render(<App />);
    expect(screen.getByText('不可取代臨床判斷')).toBeVisible();
    expect(screen.getByText('臨床決策支援，非自動醫囑')).toBeVisible();
  });
});

it('renders the clinician-only safety boundary', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /SA-AKI Clinical Navigator/i })).toBeVisible();
  expect(screen.getByText(/臨床決策支援，非自動醫囑/)).toBeVisible();
  expect(screen.getByText(/成人醫護人員/)).toBeVisible();
});

it('keeps incomplete inputs explicitly provisional', () => {
  render(<App />);
  expect(screen.getByText('資料不足，尚無法完成分期')).toBeVisible();
  expect(screen.getByRole('heading', { name: '缺失資料' })).toBeVisible();
  expect(screen.getByRole('heading', { name: '下一步' })).toBeVisible();
  expect(screen.getByLabelText('目前 SCr')).toHaveValue(null);
});

it('retains an edited measurement without inventing a completed diagnosis', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByLabelText('目前 SCr'), '1.2');
  expect(screen.getByLabelText('目前 SCr')).toHaveValue(1.2);
  expect(screen.getByText('資料不足，尚無法完成分期')).toBeVisible();
});

it('does not pretend unimplemented case creation or persistence is available', () => {
  render(<App />);
  expect(screen.getAllByRole('button', { name: '新增匿名病例' }).every(button => button.hasAttribute('disabled'))).toBe(true);
});

it('opens the missing-data explanation with a keyboard-accessible disclosure', async () => {
  const user = userEvent.setup();
  render(<App />);
  const disclosure = screen.getByText('哪些變化會改變判斷？');
  await user.click(disclosure);
  expect(disclosure.closest('details')).toHaveAttribute('open');
});
