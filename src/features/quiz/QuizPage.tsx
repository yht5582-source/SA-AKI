import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { evidenceSources } from '../../clinical/sources';
import { demoCases } from '../demo/demoCases';
import { passMark, questions, quizDomains, type QuizLevel, type QuizQuestion } from './questions';

type Mode = 'practice' | 'exam';
type Scope = 'all' | QuizLevel;
interface Attempt {
  mode: Mode;
  ids: string[];
  /** Per-question option order, so option position carries no information. */
  orders: Record<string, number[]>;
  answers: Record<string, number>;
  /** Practice mode locks an answer once confirmed. */
  confirmed: string[];
  index: number;
  finished: boolean;
}

const STORAGE_KEY = 'sa-aki:quiz:v1';
const letters = ['A', 'B', 'C', 'D'];
const byId = (id: string) => questions.find(question => question.id === id)!;
function shuffled(values: number[]) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function startAttempt(mode: Mode, scope: Scope): Attempt {
  const chosen = questions.filter(question => scope === 'all' || question.level === scope);
  return { mode, ids: chosen.map(question => question.id), orders: Object.fromEntries(chosen.map(question => [question.id, shuffled([0, 1, 2, 3])])), answers: {}, confirmed: [], index: 0, finished: false };
}
function loadAttempt(): Attempt | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const attempt = JSON.parse(stored) as Attempt;
    return attempt.ids.every(id => questions.some(question => question.id === id)) ? attempt : null;
  } catch { return null; }
}
function saveAttempt(attempt: Attempt | null) {
  try {
    if (attempt) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attempt));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* A lost in-progress attempt is acceptable; the quiz still works without storage. */ }
}

export function QuizPage() {
  const [attempt, setAttempt] = useState<Attempt | null>(loadAttempt);
  useEffect(() => saveAttempt(attempt), [attempt]);
  if (!attempt) return <QuizIntro onStart={(mode, scope) => setAttempt(startAttempt(mode, scope))}/>;
  if (attempt.finished) return <QuizResults attempt={attempt} onRestart={() => setAttempt(null)}/>;
  return <QuizRunner attempt={attempt} onChange={setAttempt} onQuit={() => setAttempt(null)}/>;
}

function QuizIntro({ onStart }: { onStart: (mode: Mode, scope: Scope) => void }) {
  const [mode, setMode] = useState<Mode>('practice');
  const [scope, setScope] = useState<Scope>('all');
  const count = (level: QuizLevel) => questions.filter(question => question.level === level).length;
  const total = scope === 'all' ? questions.length : count(scope);
  return <section className="learning-page" aria-labelledby="quiz-heading">
    <div className="learning-intro">
      <h2 id="quiz-heading">SA-AKI 測驗</h2>
      <p>共 {questions.length} 題單選題：{count('基礎')} 題基礎，{count('高階')} 題高階。高階題考多步驟整合、資料矛盾與計算陷阱。答對 80% 視為通過。</p>
      <p className="learning-note">自我學習用，不是認證考試。答案依本工具規則與所列來源；部分閾值是本工具的操作性慣例，內容尚待專業審查。</p>
    </div>
    <div className="quiz-setup">
      <fieldset><legend>範圍</legend>
        {([['all', `全部 ${questions.length} 題`, '基礎在前，高階在後'], ['基礎', `基礎 ${count('基礎')} 題`, '定義、適應症與基本計算'], ['高階', `高階 ${count('高階')} 題`, '整合判斷、矛盾資料與多步驟計算']] as const).map(([value, label, hint]) => <label key={value}><input type="radio" name="quiz-scope" checked={scope === value} onChange={() => setScope(value)}/><span><strong>{label}</strong><small>{hint}</small></span></label>)}
      </fieldset>
      <fieldset><legend>模式</legend>
        {([['practice', '練習模式', '每題作答後立即看解析'], ['exam', '考試模式', '全部交卷後才看成績與解析']] as const).map(([value, label, hint]) => <label key={value}><input type="radio" name="quiz-mode" checked={mode === value} onChange={() => setMode(value)}/><span><strong>{label}</strong><small>{hint}</small></span></label>)}
      </fieldset>
    </div>
    <button className="button primary" onClick={() => onStart(mode, scope)}>開始 {total} 題</button>
    <p className="learning-next">想先複習？<Link to="/demo">看示範病例</Link></p>
  </section>;
}

function Sources({ question }: { question: QuizQuestion }) {
  const demo = demoCases.findIndex(item => item.id === question.demoId);
  return <p className="quiz-sources">來源：{question.sourceIds.map((id, index) => {
    const source = evidenceSources[id];
    return <span key={id}>{index > 0 && '、'}{source.status === 'local' ? '本工具操作規則（非指引）' : source.url ? <a href={source.url} target="_blank" rel="noreferrer">{id.replaceAll('_', ' ')}</a> : id.replaceAll('_', ' ')}</span>;
  })}{demo >= 0 && <>｜<Link to={`/demo/${question.demoId}`}>相關示範病例 T{demo + 1}</Link></>}</p>;
}

function Feedback({ question, order, selected }: { question: QuizQuestion; order: number[]; selected: number | undefined }) {
  const right = selected === question.answer;
  return <div className={`quiz-feedback ${right ? 'right' : 'wrong'}`}>
    <p className="quiz-verdict" role="status">{selected === undefined ? '未作答' : right ? '答對了' : '答錯了'}；正確答案是 {letters[order.indexOf(question.answer)]}。</p>
    <p>{question.explanation}</p>
    <ul className="quiz-why">{order.map((optionIndex, position) => <li key={optionIndex} className={optionIndex === question.answer ? 'is-answer' : undefined}><strong>{letters[position]}.</strong> {question.options[optionIndex].why}</li>)}</ul>
    <Sources question={question}/>
  </div>;
}

function QuizRunner({ attempt, onChange, onQuit }: { attempt: Attempt; onChange: (attempt: Attempt) => void; onQuit: () => void }) {
  const stem = useRef<HTMLHeadingElement>(null);
  const [pending, setPending] = useState<number | undefined>(undefined);
  const [warnUnanswered, setWarnUnanswered] = useState(false);
  const question = byId(attempt.ids[attempt.index]);
  const order = attempt.orders[question.id];
  const practice = attempt.mode === 'practice';
  const locked = practice && attempt.confirmed.includes(question.id);
  const selected = practice && !locked ? pending : attempt.answers[question.id];
  const last = attempt.index === attempt.ids.length - 1;
  const unanswered = attempt.ids.filter(id => attempt.answers[id] === undefined).length;

  useEffect(() => { stem.current?.focus(); }, [attempt.index]);
  const go = (index: number) => { setPending(undefined); setWarnUnanswered(false); onChange({ ...attempt, index }); };
  const choose = (optionIndex: number) => {
    if (practice) setPending(optionIndex);
    else onChange({ ...attempt, answers: { ...attempt.answers, [question.id]: optionIndex } });
    setWarnUnanswered(false);
  };
  const confirm = () => {
    if (pending === undefined) return;
    setPending(undefined);
    onChange({ ...attempt, answers: { ...attempt.answers, [question.id]: pending }, confirmed: [...attempt.confirmed, question.id] });
  };
  const finish = () => {
    if (!practice && unanswered > 0 && !warnUnanswered) { setWarnUnanswered(true); return; }
    onChange({ ...attempt, finished: true });
  };

  return <section className="learning-page quiz-runner" aria-label="測驗進行中">
    <div className="quiz-progress">
      <span>第 {attempt.index + 1} / {attempt.ids.length} 題</span>
      <span className={`quiz-level level-${question.level === '高階' ? 'advanced' : 'basic'}`}>{question.level}</span>
      <span className="quiz-domain">{question.domain}</span>
      <div role="progressbar" aria-label="測驗進度" aria-valuemin={0} aria-valuemax={attempt.ids.length} aria-valuenow={attempt.index + 1}><i style={{ width: `${(attempt.index + 1) / attempt.ids.length * 100}%` }}/></div>
    </div>
    <fieldset className="quiz-question" disabled={locked}>
      <legend><h2 ref={stem} tabIndex={-1}>{question.stem}</h2></legend>
      {order.map((optionIndex, position) => {
        const state = locked ? optionIndex === question.answer ? 'correct' : optionIndex === selected ? 'incorrect' : '' : '';
        return <label key={optionIndex} className={`quiz-option ${selected === optionIndex ? 'selected' : ''} ${state}`}>
          <input type="radio" name={`quiz-${question.id}`} checked={selected === optionIndex} onChange={() => choose(optionIndex)}/>
          <span className="quiz-letter">{letters[position]}</span><span>{question.options[optionIndex].text}</span>
        </label>;
      })}
    </fieldset>
    {locked && <Feedback question={question} order={order} selected={attempt.answers[question.id]}/>}
    {warnUnanswered && <p role="alert">還有 {unanswered} 題未作答，未作答以錯誤計。再按一次「交卷」即送出。</p>}
    <div className="quiz-actions">
      <button className="button" disabled={attempt.index === 0} onClick={() => go(attempt.index - 1)}>上一題</button>
      {practice && !locked
        ? <button className="button primary" disabled={pending === undefined} onClick={confirm}>確認答案</button>
        : last ? <button className="button primary" onClick={finish}>{practice ? '看成績' : '交卷'}</button>
          : <button className="button primary" onClick={() => go(attempt.index + 1)}>下一題</button>}
      <button className="button quiz-quit" onClick={onQuit}>放棄並重來</button>
    </div>
  </section>;
}

function QuizResults({ attempt, onRestart }: { attempt: Attempt; onRestart: () => void }) {
  const [wrongOnly, setWrongOnly] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const asked = attempt.ids.map(byId);
  const isRight = (question: QuizQuestion) => attempt.answers[question.id] === question.answer;
  const score = asked.filter(isRight).length;
  const needed = passMark(asked.length);
  const passed = score >= needed;
  const tally = (subset: QuizQuestion[]) => `${subset.filter(isRight).length} / ${subset.length}`;
  const levels = (['基礎', '高階'] as const).map(level => [level, asked.filter(question => question.level === level)] as const).filter(([, subset]) => subset.length > 0);
  const domains = quizDomains.map(domain => [domain, asked.filter(question => question.domain === domain)] as const).filter(([, subset]) => subset.length > 0);
  const listed = wrongOnly ? asked.filter(question => !isRight(question)) : asked;
  return <section className="learning-page" aria-labelledby="quiz-result-heading">
    <div className={`quiz-score ${passed ? 'passed' : 'failed'}`}>
      <h2 id="quiz-result-heading" ref={heading} tabIndex={-1}>{score} / {asked.length} 分</h2>
      <p>{passed ? '通過' : `未通過：需答對 ${needed} 題`}。這是自我學習結果，不代表臨床能力認證。</p>
    </div>
    <div className="quiz-breakdown">
      <section aria-label="難度得分"><h3>依難度</h3><dl>{levels.map(([level, subset]) => <div key={level}><dt>{level}</dt><dd>{tally(subset)}</dd></div>)}</dl></section>
      <section aria-label="主題得分"><h3>依主題</h3><dl>{domains.map(([domain, subset]) => <div key={domain}><dt>{domain}</dt><dd>{tally(subset)}</dd></div>)}</dl></section>
    </div>
    <div className="workflow-actions">
      <button className="button primary" onClick={onRestart}>再測一次</button>
      <button className="button" aria-pressed={wrongOnly} onClick={() => setWrongOnly(value => !value)}>{wrongOnly ? '顯示全部題目' : '只看錯題'}</button>
      <Link className="button" to="/demo">複習示範病例</Link>
    </div>
    <h3 className="quiz-review-heading">逐題解析</h3>
    {listed.length === 0 && <p>全部答對，沒有錯題。</p>}
    <ol className="quiz-review">{listed.map(question => {
      const order = attempt.orders[question.id];
      const selected = attempt.answers[question.id];
      return <li key={question.id}>
        <p className="quiz-review-meta"><span className={`quiz-level level-${question.level === '高階' ? 'advanced' : 'basic'}`}>{question.level}</span>第 {attempt.ids.indexOf(question.id) + 1} 題・{question.domain}</p>
        <p className="quiz-review-stem">{question.stem}</p>
        <ul className="quiz-review-options">{order.map((optionIndex, position) => <li key={optionIndex} className={optionIndex === question.answer ? 'correct' : optionIndex === selected ? 'incorrect' : undefined}>{letters[position]}. {question.options[optionIndex].text}{optionIndex === selected && '（你的答案）'}</li>)}</ul>
        <Feedback question={question} order={order} selected={selected}/>
      </li>;
    })}</ol>
  </section>;
}
