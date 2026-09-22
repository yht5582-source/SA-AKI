import { Circle, CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import type { DecisionResult } from '../clinical/types';
import { EvidenceBadge } from './EvidenceBadge';

const states = { critical: [CircleAlert, '立即處理'], warning: [TriangleAlert, '需重評'], monitor: [Circle, '持續監測'], stable: [CircleCheck, '穩定'] } as const;
function Items({ items, empty }: { items: string[]; empty: string }) {
  return items.length ? <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>{empty}</p>;
}
export function DecisionCard({ result }: { result: DecisionResult }) {
  const [Icon, label] = states[result.severity];
  return <article className={`decision-card severity-${result.severity}`} data-rule-id={result.id} data-severity={result.severity} aria-label={result.conclusion}>
    <header><span className="decision-severity"><Icon size={19} aria-hidden="true"/>{label}</span><h3>{result.conclusion}</h3></header>
    <h4>判斷依據</h4><Items items={result.evidence} empty="尚無記錄依據；需臨床核實。"/>
    <h4>缺失資料</h4><Items items={result.missingData} empty="此規則未列額外缺項；不代表資料全面完整。"/>
    <h4>下一步</h4><Items items={result.actions} empty="由臨床團隊確認後續評估。"/>
    <h4>重評時間</h4><p>{result.reassessWithinHours === undefined ? '待臨床確認；惡化時立即重評。' : result.reassessWithinHours === 0 ? '立即重評' : `至遲 ${result.reassessWithinHours} 小時內；惡化時立即重評。`}</p>
    <details><summary>哪些變化會改變判斷？</summary><Items items={result.counterfactuals} empty="此規則未列額外條件；新資料需重新評估。"/></details>
    <h4>規則與來源</h4><p className="rule-id">{result.id} · 內容審查：待專業確認</p>
    {result.sourceIds.map(sourceId => <EvidenceBadge key={sourceId} sourceId={sourceId} ruleId={result.id}/>)}
    {result.sourceIds.length === 0 && <p>未提供來源；不可視為已核實規則。</p>}
  </article>;
}
