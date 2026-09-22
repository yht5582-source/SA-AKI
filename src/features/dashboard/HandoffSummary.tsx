import { useRef, useState } from 'react';
import type { ClinicalSnapshot, DecisionResult } from '../../clinical/types';
import { evidenceSources } from '../../clinical/sources';

/** Allowlisted generated conclusions only. Never serialize patient data, free text, actions or medication evidence. */
function buildHandoff(snapshot: ClinicalSnapshot, decisions: DecisionResult[], haStatus?: string): string {
  const conclusion = (id: string) => decisions.find(result => result.id === id)?.conclusion ?? '資料不足，待評估';
  const times = decisions.flatMap(result => result.reassessWithinHours === undefined ? [] : [result.reassessWithinHours]);
  const next = times.length ? Math.min(...times) : undefined;
  const sources = [...new Set(decisions.flatMap(result => result.sourceIds))];
  return [
    '臨床交班摘要｜臨床決策支援，非自動醫囑；不可取代臨床判斷。',
    `評估時間：${snapshot.timestamp}（距 Sepsis ${snapshot.hoursFromSepsisOnset} h）`,
    `KDIGO / SA-AKI：${conclusion('aki-staging')}；${conclusion('sa-aki-timing')}`,
    `液體階段：${conclusion('fluid-rose')}`,
    `KRT 狀態：${conclusion('krt-emergency-indications')}；${conclusion('crrt-liberation-review')}`,
    `模式：${conclusion('krt-modality-selection')}；已記錄模式 ${snapshot.crrtMode ?? '未知'}。`,
    `安全問題：${decisions.filter(result => result.severity === 'critical' || result.severity === 'warning').map(result => `[${result.id}] ${result.conclusion}`).join('；') || '尚未辨識；不代表已排除。'}`,
    ...(haStatus ? [`HA 狀態：${haStatus}；非常規路徑，非治療資格。`] : []),
    `下次重評：${next === undefined ? '待臨床確認' : next === 0 ? '立即' : `至遲 ${next} 小時內（自上述評估時間起算）`}；惡化時立即重評，不等待排程。`,
    `證據不確定性：臨床內容尚待專業審查；缺失資料共 ${new Set(decisions.flatMap(result => result.missingData)).size} 項，未知不代表正常；本機操作性規則非經驗證治療閾值。來源：${sources.map(id => `${id} (${evidenceSources[id]?.status ?? 'unverified'})`).join(', ')}。來源核實不等同病人適用性或治療授權。`,
  ].join('\n\n');
}
export function HandoffSummary({ snapshot, decisions, haStatus }: { snapshot: ClinicalSnapshot; decisions: DecisionResult[]; haStatus?: string }) {
  const [message, setMessage] = useState(''); const textarea = useRef<HTMLTextAreaElement>(null);
  const summary = buildHandoff(snapshot, decisions, haStatus);
  return <section className="handoff-summary" aria-label="床邊摘要" id="handoff"><h2>床邊摘要</h2><p>僅包含評估摘要，不包含直接識別資料、自由文字病史或可執行醫囑。複製前請核對評估時間。</p>
    <button className="button" onClick={async () => {
      try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(summary); setMessage('已複製交班摘要'); }
      catch { setMessage('無法自動複製；請選取下方摘要手動複製。'); textarea.current?.focus(); textarea.current?.select(); }
    }}>複製交班摘要</button>
    {message && <p role="status">{message}</p>}<label htmlFor="handoff-text">交班摘要</label><textarea id="handoff-text" ref={textarea} readOnly value={summary}/>
  </section>;
}
