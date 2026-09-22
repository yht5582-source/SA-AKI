import { Link } from 'react-router-dom';
import { evaluateHaEligibility } from '../../clinical/ha';
import { CaseWorkspaceLoader } from '../../components/CaseWorkspaceLoader';
import { DecisionCard } from '../../components/DecisionCard';
import type { StoredCase } from '../../data/caseRepository';
import { evaluateDashboard } from '../dashboard/evaluateDashboard';
import { HaWarning } from './HaWarning';
import { haStatusLabel } from './haPresentation';
import { orderSnapshots, strictlyEarlierSnapshot } from '../dashboard/snapshotContext';

export function HaWorkspace() { return <CaseWorkspaceLoader>{stored => <HaReview stored={stored}/>}</CaseWorkspaceLoader>; }
function HaReview({ stored }: { stored: StoredCase }) {
  const ordered = orderSnapshots(stored.snapshots);
  const snapshot = ordered.at(-1), previousSnapshot = snapshot ? strictlyEarlierSnapshot(snapshot, ordered) : undefined, assessment = snapshot?.hemoadsorptionAssessment;
  const evaluation = snapshot ? evaluateHaEligibility({ snapshot, previousSnapshot }) : undefined;
  const gateResult = evaluation?.results.find(result => result.id === 'ha-gated-review');
  let results;
  try { results = snapshot ? evaluateDashboard(stored.case, ordered).filter(result => /^(ha-|pmx-)/.test(result.id) || result.id === 'snapshot-time-provenance') : []; }
  catch { return <p role="alert">無法完成評估；請核對時間點與病例資料。</p>; }
  return <section className="ha-workspace"><h2>HA 救援評估</h2><HaWarning/>
    <nav className="workflow-actions" aria-label="HA 工作區導覽"><Link to={`/case/${encodeURIComponent(stored.case.id)}`}>決策首頁</Link><Link className="button" to={`/case/${encodeURIComponent(stored.case.id)}/assessment?step=ha`}>輸入新的 HA 評估</Link></nav>
    <p>匿名病例 {stored.case.anonymousCode} · 評估時間 {snapshot?.timestamp ?? '尚無時間點'}</p>
    <p role="status">{haStatusLabel(evaluation, assessment)}</p>
    <p>以下門檻為目前資料的規則重算；已保存未完成觀察不會自動轉為完成審查。任何新失敗門檻均需重新評估。</p>
    <div className="ha-gates">{([['clinical', '臨床門檻'], ['target', '目標門檻'], ['safety', '安全門檻'], ['governance', '治理門檻']] as const).map(([gate, label]) => <section key={gate} aria-label={label}><h3>{label}</h3><p>{evaluation?.gates[gate] ? '✓ 門檻通過（非治療授權）' : '△ 未通過／資料待確認'}</p>
      {gate === 'clinical' && <p>成人感染性休克、標準照護、可逆特徵與連續休克病程需明確確認。</p>}
      {gate === 'target' && <><p>裝置：{assessment?.requestedDevice ?? '尚未選擇'}；目標：{assessment?.targetAdsorbate ?? '尚未記錄'}。</p><p>{assessment?.requestedDevice === 'polymyxin-B' ? 'polymyxin-B：EAA 與內毒素表型／Gram-negative 評估；IL-6 不可替代 EAA。' : assessment?.requestedDevice === 'oXiris' ? 'oXiris：依目標評估 EAA／連續 IL-6；必須另行確認獨立 CRRT 適應症。' : 'CytoSorb／HA330／HA380：連續定量 IL-6 與已確認高發炎表型；EAA 不可替代 IL-6。其他裝置無預設通過路徑。'}</p><p>EAA：{snapshot?.endotoxinActivityAssay ?? '未知'}（無單位）；IL-6：{snapshot?.il6PgMl ?? '未知'} pg/mL。</p></>}
      {gate === 'safety' && <p>血小板、凝血、白蛋白、器官功能、電解質、通路、抗凝、管路及藥物移除計畫；出血、不可逆性與照護目標否決需排除。</p>}
      {gate === 'governance' && <p>重症、腎臟、感染團隊及藥師；治理場域、同意、監測、重評與停止計畫。不得以裝置可用性通過。</p>}
      <ul>{[...gateResult?.missingData ?? [], ...gateResult?.evidence ?? []].filter(item => item.startsWith(gate + ':')).map(item => <li key={item}>{item}</li>)}</ul>
    </section>)}</div>
    <h2>目前判斷</h2>{results.map(result => <DecisionCard key={result.id} result={result}/>)}
  </section>;
}
