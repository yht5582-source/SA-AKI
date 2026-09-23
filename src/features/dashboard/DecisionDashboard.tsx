import { useState } from 'react';
import { Link } from 'react-router-dom';
import { evaluateHaEligibility } from '../../clinical/ha';
import { CaseWorkspaceLoader } from '../../components/CaseWorkspaceLoader';
import { DecisionCard } from '../../components/DecisionCard';
import type { StoredCase } from '../../data/caseRepository';
import { haStatusLabel } from '../ha/haPresentation';
import { evaluateDashboard } from './evaluateDashboard';
import { HandoffSummary } from './HandoffSummary';
import { KrtPathway } from './KrtPathway';
import { TrendCharts } from './TrendCharts';
import { orderSnapshots, strictlyEarlierSnapshot } from './snapshotContext';

export function DecisionDashboard() { return <CaseWorkspaceLoader>{stored => <Dashboard stored={stored}/>}</CaseWorkspaceLoader>; }
function Dashboard({ stored }: { stored: StoredCase }) {
  const ordered = orderSnapshots(stored.snapshots);
  const [selectedId, setSelectedId] = useState(ordered.at(-1)?.id);
  const index = ordered.findIndex(snapshot => snapshot.id === selectedId);
  const current = ordered[index]; const series = current ? ordered.filter(snapshot => Date.parse(snapshot.timestamp) <= Date.parse(current.timestamp)) : [];
  let decisions;
  try { decisions = evaluateDashboard(stored.case, series, selectedId); }
  catch { return <p role="alert">無法完成評估；請核對時間點與病例資料。</p>; }
  const haStatus = current?.hemoadsorptionAssessment?.optedIn ? haStatusLabel(evaluateHaEligibility({ snapshot: current, previousSnapshot: strictlyEarlierSnapshot(current, series) }), current.hemoadsorptionAssessment) : undefined;
  return <section className="decision-dashboard"><div className="page-heading"><h2>決策首頁</h2><span>匿名病例 {stored.case.anonymousCode}</span></div>
    <nav className="workflow-actions" aria-label="病例工作區導覽"><Link className="button" to={`/case/${encodeURIComponent(stored.case.id)}/assessment`}>新增時間點</Link><a href="#trajectory">病程趨勢</a><a href="#handoff">床邊摘要</a><Link to={`/case/${encodeURIComponent(stored.case.id)}/ha`}>HA 救援評估</Link></nav>
    {!current ? <p>尚無時間點；請先新增評估。</p> : <><label htmlFor="dashboard-time">評估時間點</label><select id="dashboard-time" value={selectedId} onChange={event => setSelectedId(event.target.value)}>{ordered.map(snapshot => <option key={snapshot.id} value={snapshot.id}>{snapshot.hoursFromSepsisOnset} h · {snapshot.timestamp}</option>)}</select>
      <KrtPathway decisions={decisions} caseId={stored.case.id}/>
      <div className="dashboard-columns"><aside className="dashboard-input"><h2>目前輸入</h2><p>評估時間：{current.timestamp}</p><dl>{[['目前 SCr', current.creatinineMgDl, 'mg/dL'], ['尿量', current.urineVolumeMl, 'mL'], ['觀察時數', current.urineObservationHours, 'h'], ['MAP', current.mapMmHg, 'mmHg'], ['乳酸', current.lactateMmolL, 'mmol/L']].map(([label, value, unit]) => <div key={label}><dt>{label}</dt><dd>{value ?? '未知'} {unit}</dd></div>)}</dl><Link to={`/case/${encodeURIComponent(stored.case.id)}/assessment/${encodeURIComponent(current.id)}`}>查看完整輸入（唯讀）</Link><p>HA 非常規治療路徑；僅由使用者主動進入救援評估。</p></aside>
        <section className="dashboard-decisions" aria-label="目前判斷"><h2>目前判斷</h2>{haStatus && <p role="status">HA：{haStatus}；非治療資格或自動醫囑。</p>}{decisions.map(result => <DecisionCard key={result.id} result={result}/>)}</section>
        <aside className="dashboard-trends"><TrendCharts patient={stored.case} snapshots={series}/></aside></div>
      <HandoffSummary key={current.id} snapshot={current} decisions={decisions} haStatus={haStatus}/></>}
  </section>;
}
