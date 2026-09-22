import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export function WorkflowLayout({ children }: { children: ReactNode }) {
  return <div className="app-shell workflow-shell">
    <a className="skip-link" href="#main-content">跳至主要內容</a>
    <aside className="sidebar desktop-only"><div className="workflow-brand">SA-AKI</div><nav className="workflow-sidebar-nav" aria-label="主要導覽"><NavLink end to="/">病例總覽</NavLink><NavLink to="/evidence">證據與版本</NavLink><NavLink to="/privacy">隱私與資料</NavLink><NavLink to="/about">關於與治理</NavLink><NavLink to="/changelog">版本紀錄</NavLink><NavLink to="/offline">離線使用</NavLink></nav><p className="workflow-local">資料只存在本機</p></aside>
    <div className="workspace"><header className="top-header"><div className="title-group"><h1>SA-AKI Clinical Navigator</h1><p>成人醫護人員專用</p></div></header>
      <div className="case-toolbar"><Link className="mobile-only" to="/">病例總覽</Link><p className="safety"><ShieldCheck aria-hidden="true"/><span className="safety-copy"><strong>臨床決策支援，非自動醫囑</strong><small><span>不適用於兒科、孕婦及新生兒</span>；<span>不可取代臨床判斷</span></small></span></p><nav className="governance-mobile-nav mobile-only" aria-label="治理導覽"><NavLink to="/evidence">證據</NavLink><NavLink to="/privacy">隱私</NavLink><NavLink to="/about">治理</NavLink><NavLink to="/changelog">版本</NavLink><NavLink to="/offline">離線</NavLink></nav></div>
      <main id="main-content" className="workflow-main" tabIndex={-1}>{children}</main><footer className="desktop-footer">成人專用｜匿名資料｜臨床內容尚待專業審查</footer>
    </div>
  </div>;
}
