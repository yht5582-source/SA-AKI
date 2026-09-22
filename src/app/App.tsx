import { ArrowRight, Check, Circle, Clock3, FileText, Menu, Plus, ShieldCheck, SquarePlus, TriangleAlert } from 'lucide-react';
import { ClinicalInputs } from './ClinicalInputs';
import { DecisionPanel } from './DecisionPanel';
import { Navigation } from './Navigation';
import { TrajectoryPanel } from './TrajectoryPanel';

export function App() {
  return <div className="app-shell">
    <Navigation />
    <div className="workspace">
      <header className="top-header">
        <button className="icon-button mobile-only" aria-label="主要導覽" disabled><Menu aria-hidden="true" /></button>
        <div className="title-group"><h1>SA-AKI Clinical Navigator</h1><p>成人醫護人員專用</p></div>
        <button className="button primary desktop-only" disabled><Plus aria-hidden="true" />新增匿名病例</button>
        <button className="icon-button mobile-only" aria-label="新增匿名病例" disabled><SquarePlus aria-hidden="true" /></button>
      </header>
      <div className="case-toolbar">
        <div className="case-identity"><FileText className="desktop-only" aria-hidden="true" /><strong>匿名病例 A-001</strong></div>
        <div className="timepoint desktop-only"><Clock3 aria-hidden="true" />評估時間點 0 h</div>
        <button className="new-case-mobile mobile-only" disabled><Plus aria-hidden="true" />新增匿名病例</button>
        <p className="safety"><ShieldCheck aria-hidden="true" /><span className="safety-copy"><strong>臨床決策支援，非自動醫囑</strong><small><span>不適用於兒科、孕婦及新生兒</span>；<span>不可取代臨床判斷</span></small></span></p>
        <button className="button time-button desktop-only" disabled><Clock3 aria-hidden="true" />新增時間點</button>
      </div>
      <main id="decision">
        <div className="page-heading desktop-only"><h2>決策首頁</h2><div className="status-legend" aria-label="狀態說明"><span className="critical"><Circle fill="currentColor" aria-hidden="true" />立即處理</span><span className="warning"><TriangleAlert aria-hidden="true" />需重評</span><span className="monitor"><Circle aria-hidden="true" />持續監測</span><span className="stable"><Check aria-hidden="true" />穩定</span></div></div>
        <div className="wizard-progress mobile-only"><span>步驟 2 / 8</span><div role="progressbar" aria-label="評估進度" aria-valuemin={0} aria-valuemax={8} aria-valuenow={2}>{Array.from({length:8}, (_, i) => <i key={i} className={i < 2 ? 'filled' : ''} />)}</div><span>AKI 評估</span></div>
        <div className="clinical-workspace"><ClinicalInputs /><DecisionPanel /><TrajectoryPanel /></div>
      </main>
      <footer className="desktop-footer desktop-only"><span>成人專用｜匿名資料｜臨床內容尚待專業審查</span><span>概念示意 · 非真實病例</span></footer>
      <footer className="mobile-footer mobile-only"><div><button className="button outline" disabled>上一步</button><button className="button primary" disabled>儲存並繼續<ArrowRight aria-hidden="true" /></button></div><small>資料只存在本機 · 概念示意</small></footer>
    </div>
  </div>;
}
